import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAnalysisSchema, insertDialogueSchema } from "@shared/schema";
import { LLMService, LLMProvider } from "./services/llmService";
import { FileProcessor, upload } from "./services/fileProcessor";
import { AnalysisEngine, AnalysisType } from "./services/analysisEngine";
import { setupAuth } from "./auth";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  const llmService = new LLMService();
  const analysisEngine = new AnalysisEngine();

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

      // Create analysis record, optionally associated with logged-in user
      const analysis = await storage.createAnalysis({
        ...validation.data,
        userId: req.isAuthenticated() ? req.user!.id : null
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

        // Update analysis with final results
        await storage.updateAnalysisResults(id, results, "completed");
        
        // Send completion event
        res.write(`data: ${JSON.stringify({ type: 'complete', data: { analysisId: id } })}\n\n`);
        
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

      // Create new analysis with concerns incorporated, maintaining user association
      const newAnalysis = await storage.createAnalysis({
        analysisType: analysis.analysisType,
        llmProvider: analysis.llmProvider,
        inputText: analysis.inputText,
        additionalContext: `${analysis.additionalContext || ''}\n\nUser concerns from previous analysis: ${concerns}`,
        userId: req.isAuthenticated() ? req.user!.id : null
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

  // Payment system health check
  app.get("/api/payment-health", async (req, res) => {
    res.json({
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET_MINDPROBE,
      authenticated: req.isAuthenticated(),
      user: req.user ? { id: req.user.id, username: req.user.username, credits: req.user.credits } : null
    });
  });

  // Stripe payment endpoints
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      console.log("Payment intent request received, authenticated:", req.isAuthenticated(), "user:", req.user?.username);
      
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Must be logged in to purchase credits" });
      }

      const { credits } = req.body;
      console.log("Creating payment intent for", credits, "credits for user", req.user!.username);
      
      const creditAmount = parseInt(credits);
      if (!creditAmount || creditAmount <= 0 || creditAmount > 1000) {
        return res.status(400).json({ error: "Invalid credit amount (must be 1-1000)" });
      }

      // Calculate amount based on credits (e.g., $1 per credit)
      const amount = creditAmount * 100; // $1.00 per credit in cents

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          userId: req.user!.id,
          credits: creditAmount.toString()
        }
      });

      console.log("Payment intent created:", paymentIntent.id);
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Payment intent error:", error);
      res.status(500).json({ error: "Error creating payment intent: " + error.message });
    }
  });

  // Verify payment endpoint (for client-side payment confirmation)
  app.post("/api/verify-payment", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Must be logged in" });
      }

      const { paymentIntentId } = req.body;
      
      if (!paymentIntentId) {
        return res.status(400).json({ error: "Payment intent ID required" });
      }

      console.log("Verifying payment intent:", paymentIntentId, "for user:", req.user!.username);

      // Retrieve the payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.json({ success: false, status: paymentIntent.status });
      }

      // Extract metadata
      const userId = paymentIntent.metadata.userId;
      const credits = parseInt(paymentIntent.metadata.credits || '0');

      // Verify this payment belongs to the authenticated user
      if (userId !== req.user!.id) {
        return res.status(403).json({ error: "Payment does not belong to this user" });
      }

      if (credits > 0) {
        // Record the purchase (with idempotency check)
        const wasNewPurchase = await storage.recordCreditPurchase({
          userId,
          stripeSessionId: paymentIntent.id,
          stripePaymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          credits,
          status: 'completed'
        });

        // Only add credits if purchase was newly recorded (prevents duplicate crediting)
        if (wasNewPurchase) {
          await storage.addCreditsToUser(userId, credits);
          console.log(`Verified payment: Added ${credits} credits to user ${req.user!.username}`);
        } else {
          console.log(`Verified payment: Payment ${paymentIntentId} already processed for user ${req.user!.username}`);
        }
      }

      res.json({ success: true, credits });
    } catch (error: any) {
      console.error("Payment verification error:", error);
      res.status(500).json({ error: "Error verifying payment: " + error.message });
    }
  });

  // Stripe webhook endpoint (needs raw body for signature verification)
  app.post("/api/stripe-webhook", async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET_MINDPROBE) {
      return res.status(400).send('Webhook signature verification failed');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET_MINDPROBE
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata.userId;
        const credits = parseInt(paymentIntent.metadata.credits || '0');

        if (userId && credits > 0) {
          try {
            // Record the purchase first (with idempotency check)
            const wasNewPurchase = await storage.recordCreditPurchase({
              userId,
              stripeSessionId: paymentIntent.id,
              stripePaymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount,
              credits,
              status: 'completed'
            });

            // Only add credits if purchase was newly recorded (prevents duplicate crediting)
            if (wasNewPurchase) {
              await storage.addCreditsToUser(userId, credits);
              console.log(`Added ${credits} credits to user ${userId}`);
            } else {
              console.log(`Skipped crediting user ${userId} - payment already processed`);
            }
          } catch (error) {
            console.error('Error processing successful payment:', error);
          }
        }
        break;

      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
