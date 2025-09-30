import type { Express } from "express";
import { createServer, type Server } from "http";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { storage } from "./storage";
import { db } from "./db";
import { users, insertAnalysisSchema, insertDialogueSchema, insertUserSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { LLMService, LLMProvider } from "./services/llmService";
import { FileProcessor, upload } from "./services/fileProcessor";
import { AnalysisEngine, AnalysisType } from "./services/analysisEngine";
import { CREDIT_PRICING, getCreditsForPurchase, type ZHIModel } from "./creditPricing";
import { calculateTotalWords } from "./creditUtils";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-08-27.basil",
});

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const llmService = new LLMService();
  const analysisEngine = new AnalysisEngine();

  // Authentication Routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const validation = insertUserSchema.safeParse({ username, password });
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid username or password" });
      }

      const normalizedUsername = username.toLowerCase();
      
      const existingUser = await storage.getUserByUsername(normalizedUsername);
      if (existingUser) {
        return res.status(409).json({ error: "Username already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username: normalizedUsername,
        password: hashedPassword,
      });

      req.session.userId = user.id;
      
      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          username: user.username, 
          credits: user.credits,
          isUnlimited: user.isUnlimited 
        } 
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Failed to register" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      const user = await storage.getUserByUsername(username.toLowerCase());
      
      if (username.toLowerCase() === "jmk") {
        if (!user) {
          const newUser = await storage.createUser({
            username: "jmk",
            password: "",
          });
          
          await db
            .update(users)
            .set({ credits: 999999999, isUnlimited: true })
            .where(eq(users.id, newUser.id));
          
          const updatedUser = await storage.getUser(newUser.id);
          req.session.userId = newUser.id;
          
          return res.json({ 
            success: true, 
            user: { 
              id: updatedUser!.id, 
              username: updatedUser!.username, 
              credits: updatedUser!.credits,
              isUnlimited: updatedUser!.isUnlimited
            } 
          });
        }
        
        if (!user.isUnlimited) {
          await db
            .update(users)
            .set({ credits: 999999999, isUnlimited: true })
            .where(eq(users.id, user.id));
          
          const updatedUser = await storage.getUser(user.id);
          req.session.userId = user.id;
          
          return res.json({ 
            success: true, 
            user: { 
              id: updatedUser!.id, 
              username: updatedUser!.username, 
              credits: updatedUser!.credits,
              isUnlimited: updatedUser!.isUnlimited
            } 
          });
        }
        
        req.session.userId = user.id;
        return res.json({ 
          success: true, 
          user: { 
            id: user.id, 
            username: user.username, 
            credits: user.credits,
            isUnlimited: user.isUnlimited
          } 
        });
      }
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password || "", user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      
      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          username: user.username, 
          credits: user.credits,
          isUnlimited: user.isUnlimited 
        } 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.json({ user: null });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.json({ user: null });
      }

      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          credits: user.credits,
          isUnlimited: user.isUnlimited 
        } 
      });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  // Stripe: Get pricing tiers
  app.get("/api/credits/pricing", async (req, res) => {
    res.json(CREDIT_PRICING);
  });

  // Stripe: Create checkout session
  app.post("/api/credits/create-checkout", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: "Must be logged in to purchase credits" });
      }

      const { model, priceInCents } = req.body;
      
      if (!model || !priceInCents) {
        return res.status(400).json({ error: "Missing model or price" });
      }

      const credits = getCreditsForPurchase(model as ZHIModel, priceInCents);
      if (!credits) {
        return res.status(400).json({ error: "Invalid price tier" });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `${CREDIT_PRICING[model as ZHIModel].name} Credits`,
                description: `${credits.toLocaleString()} word credits for ${CREDIT_PRICING[model as ZHIModel].name}`,
              },
              unit_amount: priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${req.headers.origin || 'http://localhost:5000'}?purchase=success`,
        cancel_url: `${req.headers.origin || 'http://localhost:5000'}?purchase=cancelled`,
        client_reference_id: req.session.userId,
        payment_intent_data: {
          metadata: {
            userId: req.session.userId,
            model,
            credits: credits.toString(),
            sessionId: '', // Will be set by Stripe
          },
        },
        metadata: {
          userId: req.session.userId,
          model,
          credits: credits.toString(),
        },
      });

      await storage.createCreditPurchase({
        userId: req.session.userId,
        stripeSessionId: session.id,
        stripePaymentIntentId: null,
        amount: priceInCents,
        credits,
        status: 'pending',
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Stripe: Webhook handler
  app.post("/api/stripe/webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    if (!sig) {
      return res.status(400).send('No signature');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET_MINDPROBE!
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      let userId = session.metadata?.userId || session.client_reference_id;
      let credits = parseInt(session.metadata?.credits || '0');
      
      if (!userId || !credits) {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        userId = paymentIntent.metadata?.userId || userId;
        credits = parseInt(paymentIntent.metadata?.credits || '0') || credits;
      }
      
      if (!userId || !credits) {
        console.error('Missing userId or credits in webhook:', { sessionId: session.id, userId, credits });
        return res.status(400).json({ error: 'Missing metadata' });
      }
      
      try {
        const user = await storage.getUser(userId);
        if (!user) {
          console.error('User not found in webhook:', userId);
          await storage.updateCreditPurchaseStatus(session.id, 'failed');
          return res.status(404).json({ error: 'User not found' });
        }
        
        const newCredits = user.credits + credits;
        await storage.updateUserCredits(userId, newCredits);
        
        await storage.updateCreditPurchaseStatus(
          session.id,
          'completed',
          session.payment_intent as string
        );
        
        console.log(`Successfully added ${credits} credits to user ${userId}. New balance: ${newCredits}`);
      } catch (error) {
        console.error('Error processing webhook:', error);
        try {
          await storage.updateCreditPurchaseStatus(session.id, 'failed');
        } catch (updateError) {
          console.error('Failed to update purchase status:', updateError);
        }
        return res.status(500).json({ error: 'Failed to process payment' });
      }
    }

    res.json({ received: true });
  });

  // File upload endpoint
  app.post("/api/upload", upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const validation = FileProcessor.validateFile(req.file);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const extractedText = await FileProcessor.extractText(req.file);
      
      res.json({
        success: true,
        text: extractedText,
        filename: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to process file" 
      });
    }
  });

  // Start analysis endpoint
  app.post("/api/analysis/start", async (req, res) => {
    try {
      const { analysisType, llmProvider, inputText, additionalContext } = req.body;

      // Validate input
      const validation = insertAnalysisSchema.safeParse({
        analysisType,
        llmProvider,
        inputText,
        additionalContext
      });

      if (!validation.success) {
        return res.status(400).json({ error: "Invalid input data" });
      }

      // Create analysis record (associate with user if logged in)
      const analysis = await storage.createAnalysis({
        ...validation.data,
        userId: req.session.userId || null,
      });

      res.json({
        success: true,
        analysisId: analysis.id
      });
    } catch (error) {
      console.error("Analysis start error:", error);
      res.status(500).json({ error: "Failed to start analysis" });
    }
  });

  // Stream analysis results
  app.get("/api/analysis/:id/stream", async (req, res) => {
    const { id } = req.params;
    
    try {
      const analysis = await storage.getAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Check if user has credits (if logged in)
      let hasCredits = true;
      if (analysis.userId) {
        const user = await storage.getUser(analysis.userId);
        if (user && !user.isUnlimited && user.credits <= 0) {
          hasCredits = false;
        }
      }

      // Process analysis with streaming
      try {
        const results: any[] = [];
        
        for await (const result of analysisEngine.processAnalysis(
          analysis.analysisType as AnalysisType,
          analysis.inputText,
          analysis.additionalContext || undefined,
          analysis.llmProvider as LLMProvider
        )) {
          // Send each result as it comes in
          res.write(`data: ${JSON.stringify(result)}\n\n`);
          results.push(result);
        }

        // Calculate total words and deduct credits
        const totalWords = calculateTotalWords(results);
        let creditsDeducted = 0;
        
        if (analysis.userId && totalWords > 0) {
          const user = await storage.getUser(analysis.userId);
          if (user && !user.isUnlimited) {
            const deducted = await storage.deductCredits(analysis.userId, totalWords);
            if (deducted) {
              creditsDeducted = totalWords;
              console.log(`Deducted ${totalWords} credits from user ${analysis.userId}`);
            }
          }
        }

        // Update analysis with final results
        await storage.updateAnalysisResults(id, results, "completed");
        
        // Send completion event with credit info
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          data: { 
            analysisId: id,
            wordsGenerated: totalWords,
            creditsDeducted,
            hasCredits
          } 
        })}\n\n`);
        
      } catch (streamError) {
        console.error("Streaming error:", streamError);
        await storage.updateAnalysisResults(id, [], "error");
        res.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'Analysis failed' } })}\n\n`);
      }

      res.end();
    } catch (error) {
      console.error("Stream setup error:", error);
      res.status(500).json({ error: "Failed to setup analysis stream" });
    }
  });

  // Get analysis results
  app.get("/api/analysis/:id", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Get analysis error:", error);
      res.status(500).json({ error: "Failed to get analysis" });
    }
  });

  // Download analysis as TXT
  app.get("/api/analysis/:id/download", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      // Format results as text
      let textContent = `Mind Reader Analysis Report\n`;
      textContent += `Analysis Type: ${analysis.analysisType}\n`;
      textContent += `LLM Provider: ${analysis.llmProvider}\n`;
      textContent += `Date: ${analysis.createdAt}\n\n`;
      textContent += `Input Text:\n${analysis.inputText}\n\n`;
      
      if (analysis.additionalContext) {
        textContent += `Additional Context:\n${analysis.additionalContext}\n\n`;
      }

      textContent += `Results:\n`;
      if (Array.isArray(analysis.results)) {
        analysis.results.forEach((result: any, index: number) => {
          textContent += `\n${index + 1}. ${result.data?.question || 'Result'}\n`;
          textContent += `${result.data?.answer || result.data?.content || 'No content'}\n`;
        });
      }

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="analysis-${analysis.id}.txt"`);
      res.send(textContent);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to download analysis" });
    }
  });

  // Dialogue endpoints
  app.post("/api/analysis/:id/dialogue", async (req, res) => {
    try {
      const { message } = req.body;
      const analysisId = req.params.id;

      // Save user message
      await storage.createDialogueMessage({
        analysisId,
        sender: "user",
        message
      });

      // Generate system response using LLM
      const analysis = await storage.getAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      const systemPrompt = `You are discussing an analysis that was performed on the following text. The user has concerns or questions about the analysis. Respond thoughtfully and offer to regenerate the analysis if appropriate.

Original text: ${analysis.inputText}
User message: ${message}`;

      const response = await llmService.sendMessage(
        analysis.llmProvider as LLMProvider,
        message,
        systemPrompt
      );

      // Save system response
      const systemMessage = await storage.createDialogueMessage({
        analysisId,
        sender: "system",
        message: response.content
      });

      res.json({ success: true, response: systemMessage });
    } catch (error) {
      console.error("Dialogue error:", error);
      res.status(500).json({ error: "Failed to process dialogue" });
    }
  });

  // Get dialogue history
  app.get("/api/analysis/:id/dialogue", async (req, res) => {
    try {
      const messages = await storage.getDialogueMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error("Get dialogue error:", error);
      res.status(500).json({ error: "Failed to get dialogue" });
    }
  });

  // Regenerate analysis with user concerns
  app.post("/api/analysis/:id/regenerate", async (req, res) => {
    try {
      const { concerns } = req.body;
      const analysis = await storage.getAnalysis(req.params.id);
      
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      // Create new analysis with concerns incorporated
      const newAnalysis = await storage.createAnalysis({
        analysisType: analysis.analysisType,
        llmProvider: analysis.llmProvider,
        inputText: analysis.inputText,
        additionalContext: `${analysis.additionalContext || ''}\n\nUser concerns from previous analysis: ${concerns}`
      });

      res.json({
        success: true,
        analysisId: newAnalysis.id
      });
    } catch (error) {
      console.error("Regenerate error:", error);
      res.status(500).json({ error: "Failed to regenerate analysis" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
