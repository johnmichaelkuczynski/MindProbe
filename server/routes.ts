import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAnalysisSchema, insertDialogueSchema } from "@shared/schema";
import { LLMService, LLMProvider } from "./services/llmService";
import { FileProcessor, upload } from "./services/fileProcessor";
import { AnalysisEngine, AnalysisType } from "./services/analysisEngine";
import { AdvancedAnalysisEngine } from "./services/advancedAnalysisEngine";

export async function registerRoutes(app: Express): Promise<Server> {
  const llmService = new LLMService();
  const analysisEngine = new AnalysisEngine();
  const advancedAnalysisEngine = new AdvancedAnalysisEngine();

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

      // Create analysis record
      const analysis = await storage.createAnalysis(validation.data);

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

  // Advanced Analysis Routes
  app.post("/api/advanced-analysis/start", async (req, res) => {
    try {
      const { analysisType, llmProvider, inputText, additionalContext } = req.body;

      // Create analysis record with advanced type
      const analysis = await storage.createAnalysis({
        analysisType: analysisType, // Store as string in existing table
        llmProvider,
        inputText,
        additionalContext
      });

      res.json({
        success: true,
        analysisId: analysis.id
      });
    } catch (error) {
      console.error("Advanced analysis start error:", error);
      res.status(500).json({ error: "Failed to start advanced analysis" });
    }
  });

  // Stream advanced analysis results
  app.get("/api/advanced-analysis/:id/stream", async (req, res) => {
    const { id } = req.params;
    
    try {
      const analysis = await storage.getAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ error: "Analysis not found" });
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Process advanced analysis
      await advancedAnalysisEngine.processAdvancedAnalysis(
        analysis.analysisType as any,
        analysis.llmProvider,
        analysis.inputText,
        analysis.additionalContext || undefined,
        (event) => {
          sendEvent(event);
        }
      );

      // Mark analysis as complete
      await storage.updateAnalysisResults(id, []);
      sendEvent({ type: 'complete', data: { message: 'Analysis completed' } });
      
      res.end();
    } catch (error) {
      console.error("Advanced analysis stream error:", error);
      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      sendEvent({ type: 'error', data: { error: error instanceof Error ? error.message : 'Unknown error' } });
      res.end();
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
