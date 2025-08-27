import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Upload, Brain, FileText, Download, Play, Square } from "lucide-react";
import { TextChunkingService, type TextChunk } from "@shared/textUtils";

type AnalysisMode = 'cognitive-short' | 'cognitive-long' | 'psychological-short' | 'psychological-long' | 'psychopathological-short' | 'psychopathological-long';
type LLMProvider = 'zhi1' | 'zhi2' | 'zhi3' | 'zhi4';

interface QuestionResponse {
  question: string;
  answer: string;
  score: number;
}

interface AnalysisResult {
  summary: string;
  category: string;
  responses: QuestionResponse[];
  finalScore: number;
  phase: number;
  complete: boolean;
}

export default function MindReader() {
  const [inputText, setInputText] = useState("");
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>('cognitive-short');
  const [selectedLLM, setSelectedLLM] = useState<LLMProvider>('zhi1');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chunks, setChunks] = useState<TextChunk[]>([]);
  const [showChunks, setShowChunks] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [streamingMessages, setStreamingMessages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const analysisTypes = [
    { value: 'cognitive-short', label: 'Cognitive (Normal)' },
    { value: 'cognitive-long', label: 'Cognitive (Comprehensive)' },
    { value: 'psychological-short', label: 'Psychological (Normal)' },
    { value: 'psychological-long', label: 'Psychological (Comprehensive)' },
    { value: 'psychopathological-short', label: 'Psychopathological (Normal)' },
    { value: 'psychopathological-long', label: 'Psychopathological (Comprehensive)' }
  ];

  const llmProviders = [
    { value: 'zhi1', label: 'ZHI 1 (OpenAI)' },
    { value: 'zhi2', label: 'ZHI 2 (Anthropic)' },
    { value: 'zhi3', label: 'ZHI 3 (DeepSeek)' },
    { value: 'zhi4', label: 'ZHI 4 (Perplexity)' }
  ];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      handleTextInput(data.text);
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleTextInput = (text: string) => {
    setInputText(text);
    
    if (TextChunkingService.needsChunking(text)) {
      const newChunks = TextChunkingService.createChunks(text);
      setChunks(newChunks);
      setShowChunks(true);
    } else {
      setChunks([]);
      setShowChunks(false);
    }
  };

  const toggleChunk = (chunkId: string) => {
    setChunks(chunks.map(chunk => 
      chunk.id === chunkId ? { ...chunk, selected: !chunk.selected } : chunk
    ));
  };

  const getTextToAnalyze = () => {
    if (showChunks && chunks.length > 0) {
      return TextChunkingService.getSelectedChunksText(chunks);
    }
    return inputText;
  };

  const stopAnalysis = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsAnalyzing(false);
    setProgressMessage("");
  };

  const startAnalysis = async () => {
    const textToAnalyze = getTextToAnalyze();
    if (!textToAnalyze.trim()) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setStreamingMessages([]);
    setProgressMessage("Connecting to analysis engine...");

    try {
      eventSourceRef.current = new EventSource('/api/mind-reader/analyze', {
        
      });

      // Send the analysis request
      const response = await fetch('/api/mind-reader/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToAnalyze,
          mode: selectedMode,
          llmProvider: selectedLLM,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis request failed');
      }

      // Handle the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  setProgressMessage(data.message);
                  setStreamingMessages(prev => [...prev, data.message]);
                } else if (data.type === 'result') {
                  setAnalysisResult(data.data);
                } else if (data.type === 'complete') {
                  setIsAnalyzing(false);
                  setProgressMessage("Analysis complete!");
                } else if (data.type === 'error') {
                  throw new Error(data.message);
                }
              } catch (parseError) {
                console.error('Parse error:', parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setProgressMessage("Analysis failed. Please try again.");
      setIsAnalyzing(false);
    }
  };

  const downloadResults = () => {
    if (!analysisResult) return;

    let content = `Mind Reader Analysis Report\n`;
    content += `Analysis Type: ${selectedMode}\n`;
    content += `LLM Provider: ${selectedLLM}\n`;
    content += `Date: ${new Date().toISOString()}\n\n`;
    content += `Summary: ${analysisResult.summary}\n\n`;
    content += `Category: ${analysisResult.category}\n\n`;
    content += `Final Score: ${analysisResult.finalScore}/100\n\n`;
    content += `Questions and Responses:\n\n`;

    analysisResult.responses.forEach((response, index) => {
      content += `${index + 1}. ${response.question}\n`;
      content += `Score: ${response.score}/100\n`;
      content += `Answer: ${response.answer}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mind-reader-analysis-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-3">
            <Brain className="h-10 w-10 text-blue-600" />
            Mind Reader
          </h1>
          <p className="text-lg text-gray-600">
            Advanced Cognitive, Psychological & Psychopathological Analysis
          </p>
        </div>

        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Text Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
                data-testid="upload-file-button"
              >
                <Upload className="h-4 w-4" />
                Upload File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <Textarea
              placeholder="Paste or type your text here..."
              value={inputText}
              onChange={(e) => handleTextInput(e.target.value)}
              className="min-h-[200px]"
              data-testid="text-input"
            />

            {inputText && (
              <div className="text-sm text-gray-600">
                Word count: {TextChunkingService.getWordCount(inputText)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chunking Section */}
        {showChunks && (
          <Card>
            <CardHeader>
              <CardTitle>Text Chunks (Select which to analyze)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      chunk.selected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'
                    }`}
                    onClick={() => toggleChunk(chunk.id)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <Badge variant={chunk.selected ? "default" : "secondary"}>
                        Chunk {chunk.id.split('-')[1]} ({chunk.wordCount} words)
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {chunk.text.substring(0, 150)}...
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Analysis Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Analysis Type</label>
                <Select value={selectedMode} onValueChange={(value: AnalysisMode) => setSelectedMode(value)}>
                  <SelectTrigger data-testid="analysis-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {analysisTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">LLM Provider</label>
                <Select value={selectedLLM} onValueChange={(value: LLMProvider) => setSelectedLLM(value)}>
                  <SelectTrigger data-testid="llm-provider-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {llmProviders.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4">
              {!isAnalyzing ? (
                <Button
                  onClick={startAnalysis}
                  disabled={!getTextToAnalyze().trim()}
                  className="flex items-center gap-2"
                  data-testid="start-analysis-button"
                >
                  <Play className="h-4 w-4" />
                  Start Analysis
                </Button>
              ) : (
                <Button
                  onClick={stopAnalysis}
                  variant="destructive"
                  className="flex items-center gap-2"
                  data-testid="stop-analysis-button"
                >
                  <Square className="h-4 w-4" />
                  Stop Analysis
                </Button>
              )}

              {analysisResult && (
                <Button
                  onClick={downloadResults}
                  variant="outline"
                  className="flex items-center gap-2"
                  data-testid="download-results-button"
                >
                  <Download className="h-4 w-4" />
                  Download Results
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progress */}
        {isAnalyzing && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current Status</span>
                  <span className="font-medium">{progressMessage}</span>
                </div>
                <Progress value={streamingMessages.length * 10} className="w-full" />
              </div>

              <ScrollArea className="h-32 w-full border rounded p-2">
                <div className="space-y-1">
                  {streamingMessages.map((message, index) => (
                    <div key={index} className="text-xs text-gray-600">
                      {message}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {analysisResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Analysis Results
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {analysisResult.finalScore}/100
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Summary</h4>
                  <p className="text-sm text-gray-600">{analysisResult.summary}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Category</h4>
                  <Badge>{analysisResult.category}</Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Question Responses</h4>
                {analysisResult.responses.map((response, index) => (
                  <div key={index} className="border rounded p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <h5 className="font-medium text-sm flex-1 pr-4">
                        {index + 1}. {response.question}
                      </h5>
                      <Badge variant={response.score >= 95 ? "default" : response.score >= 80 ? "secondary" : "destructive"}>
                        {response.score}/100
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{response.answer}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}