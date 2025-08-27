import { useState, useEffect } from "react";
import { AnalysisSelector } from "@/components/AnalysisSelector";
import { InputSection } from "@/components/InputSection";
import { ControlPanel } from "@/components/ControlPanel";
import { RealTimeResults } from "@/components/RealTimeResults";
import { DialogueSystem } from "@/components/DialogueSystem";
import { ChunkSelector } from "@/components/ChunkSelector";
import { AnalysisType, LLMProvider } from "@/types/analysis";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useToast } from "@/hooks/use-toast";
import { Brain, HelpCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextChunkingService, TextChunk } from "@shared/textUtils";
import { Navigation } from "@/components/Navigation";

export default function Home() {
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<AnalysisType>('cognitive');
  const [selectedLLM, setSelectedLLM] = useState<LLMProvider>('zhi1');
  const [inputText, setInputText] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [questionsProcessed, setQuestionsProcessed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState("Ready");
  const [textChunks, setTextChunks] = useState<TextChunk[]>([]);
  const [showChunkSelector, setShowChunkSelector] = useState(false);
  
  const { toast } = useToast();
  const {
    currentAnalysisId,
    startAnalysis,
    uploadFile,
    dialogue,
    sendDialogue,
    regenerateAnalysis,
    downloadAnalysis,
    isStarting,
    isUploading,
  } = useAnalysis();

  const totalQuestions = 18; // This would vary based on analysis type

  const handleStartAnalysis = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Text required",
        description: "Please enter text or upload a file before starting analysis",
        variant: "destructive",
      });
      return;
    }

    // Check if text needs chunking
    if (TextChunkingService.needsChunking(inputText)) {
      const chunks = TextChunkingService.createChunks(inputText);
      setTextChunks(chunks);
      setShowChunkSelector(true);
      return;
    }

    // Proceed with analysis
    await performAnalysis(inputText);
  };

  const performAnalysis = async (textToAnalyze: string) => {
    try {
      await startAnalysis.mutateAsync({
        analysisType: selectedAnalysisType,
        llmProvider: selectedLLM,
        inputText: textToAnalyze,
        additionalContext: additionalContext || undefined,
      });
      
      setIsAnalyzing(true);
      setProgress(0);
      setQuestionsProcessed(0);
      setCurrentPhase("Starting Analysis");
      
      toast({
        title: "Analysis started",
        description: "Your analysis is now running. Watch the real-time results below.",
      });
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: "Failed to start analysis. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleChunksProceed = async () => {
    const selectedText = TextChunkingService.getSelectedChunksText(textChunks);
    setShowChunkSelector(false);
    await performAnalysis(selectedText);
  };

  const handleChunksCancel = () => {
    setShowChunkSelector(false);
    setTextChunks([]);
  };

  const handleFileUpload = async (file: File) => {
    try {
      const result = await uploadFile.mutateAsync(file);
      setInputText(result.text);
      toast({
        title: "File uploaded",
        description: `Successfully extracted text from ${file.name}`,
      });

      // Check if uploaded text needs chunking
      if (TextChunkingService.needsChunking(result.text)) {
        toast({
          title: "Large file detected",
          description: "The uploaded text is longer than 1000 words. You'll need to select chunks before analysis.",
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSendDialogue = async (message: string) => {
    if (!currentAnalysisId) return;
    
    try {
      await sendDialogue.mutateAsync({
        analysisId: currentAnalysisId,
        message,
      });
    } catch (error) {
      toast({
        title: "Message failed",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRegenerateAnalysis = async (concerns: string) => {
    if (!currentAnalysisId) return;
    
    try {
      await regenerateAnalysis.mutateAsync({
        analysisId: currentAnalysisId,
        concerns,
      });
      
      toast({
        title: "Analysis regenerating",
        description: "A new analysis is being generated with your concerns addressed.",
      });
    } catch (error) {
      toast({
        title: "Regeneration failed",
        description: "Failed to regenerate analysis. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async () => {
    if (!currentAnalysisId) return;
    
    try {
      await downloadAnalysis(currentAnalysisId);
      toast({
        title: "Download started",
        description: "Your analysis report is being downloaded.",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download analysis. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Simulate progress updates (in real implementation, this would come from SSE)
  useEffect(() => {
    if (isAnalyzing && questionsProcessed < totalQuestions) {
      const interval = setInterval(() => {
        setQuestionsProcessed(prev => {
          const next = Math.min(prev + 1, totalQuestions);
          setProgress((next / totalQuestions) * 100);
          
          if (next === totalQuestions) {
            setIsAnalyzing(false);
            setCurrentPhase("Complete");
          } else {
            setCurrentPhase(`Processing Question ${next + 1}`);
          }
          
          return next;
        });
      }, 5000); // Simulate 5 seconds per question
      
      return () => clearInterval(interval);
    }
  }, [isAnalyzing, questionsProcessed, totalQuestions]);

  const estimatedTimeRemaining = isAnalyzing 
    ? `${Math.ceil(((totalQuestions - questionsProcessed) * 5) / 60)} min`
    : "--";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navigation />
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Original 6-Mode System: Cognitive, psychological, and psychopathological profiler using advanced AI analysis
          </p>
        </div>
        
        {/* Chunk Selector Modal */}
        {showChunkSelector && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <ChunkSelector
              chunks={textChunks}
              onChunksChange={setTextChunks}
              onProceed={handleChunksProceed}
              onCancel={handleChunksCancel}
            />
          </div>
        )}
        
        {/* Analysis Selector */}
        <div className="mb-8">
          <AnalysisSelector
            selectedType={selectedAnalysisType}
            onTypeSelect={setSelectedAnalysisType}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="xl:col-span-2">
            <InputSection
              inputText={inputText}
              onTextChange={setInputText}
              additionalContext={additionalContext}
              onContextChange={setAdditionalContext}
              onFileUpload={handleFileUpload}
              isUploading={isUploading}
            />
          </div>

          {/* Control Panel */}
          <div>
            <ControlPanel
              selectedLLM={selectedLLM}
              onLLMSelect={setSelectedLLM}
              onStartAnalysis={handleStartAnalysis}
              onPauseAnalysis={() => setIsAnalyzing(false)}
              onStopAnalysis={() => {
                setIsAnalyzing(false);
                setProgress(0);
                setQuestionsProcessed(0);
                setCurrentPhase("Stopped");
              }}
              onDownload={handleDownload}
              isAnalyzing={isStarting || isAnalyzing}
              progress={progress}
              questionsProcessed={questionsProcessed}
              totalQuestions={totalQuestions}
              currentPhase={currentPhase}
              estimatedTime={estimatedTimeRemaining}
              canDownload={!isAnalyzing && questionsProcessed > 0}
            />
          </div>
        </div>

        {/* Real-Time Results */}
        <div className="mt-8">
          <RealTimeResults
            analysisId={currentAnalysisId}
            isStreaming={isAnalyzing}
          />
        </div>

        {/* Dialogue System */}
        <div className="mt-8">
          <DialogueSystem
            analysisId={currentAnalysisId}
            messages={dialogue || []}
            onSendMessage={handleSendDialogue}
            onRegenerateAnalysis={handleRegenerateAnalysis}
            isSending={sendDialogue.isPending}
          />
        </div>
      </div>
    </div>
  );
}
