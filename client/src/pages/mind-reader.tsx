import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Brain, Upload, Download, Play, StopCircle, FileText, X, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TextChunkingService, TextChunk } from "@shared/textUtils";

type AnalysisMode = 'cognitive-short' | 'cognitive-long' | 'psychological-short' | 'psychological-long' | 'psychopathological-short' | 'psychopathological-long';
type LLMProvider = 'zhi1' | 'zhi2' | 'zhi3' | 'zhi4';

interface AnalysisResults {
  summary: string;
  category: string;
  responses: Array<{
    question: string;
    answer: string;
    score: number;
  }>;
  finalScore: number;
  phase: number;
  complete: boolean;
}

export default function MindReader() {
  const [selectedMode, setSelectedMode] = useState<AnalysisMode>('cognitive-short');
  const [selectedLLM, setSelectedLLM] = useState<LLMProvider>('zhi1');
  const [inputText, setInputText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [textChunks, setTextChunks] = useState<TextChunk[]>([]);
  const [showChunkSelector, setShowChunkSelector] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const modeLabels = {
    'cognitive-short': 'Cognitive Analysis (Normal)',
    'cognitive-long': 'Cognitive Analysis (Comprehensive)',
    'psychological-short': 'Psychological Analysis (Normal)',
    'psychological-long': 'Psychological Analysis (Comprehensive)',
    'psychopathological-short': 'Psychopathological Analysis (Normal)',
    'psychopathological-long': 'Psychopathological Analysis (Comprehensive)'
  };

  const llmLabels = {
    'zhi1': 'ZHI 1 (OpenAI)',
    'zhi2': 'ZHI 2 (Anthropic)',
    'zhi3': 'ZHI 3 (DeepSeek)',
    'zhi4': 'ZHI 4 (Perplexity)'
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFile(file);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('File upload failed');
      }
      
      const result = await response.json();
      setInputText(result.text);
      
      toast({
        title: "File uploaded",
        description: `Successfully extracted text from ${file.name}`,
      });

      // Check if uploaded text needs chunking
      if (TextChunkingService.needsChunking(result.text)) {
        const chunks = TextChunkingService.createChunks(result.text);
        setTextChunks(chunks);
        setShowChunkSelector(true);
        toast({
          title: "Large file detected",
          description: "The uploaded text is longer than 1000 words. Please select chunks for analysis.",
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process file. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChunksProceed = () => {
    const selectedText = TextChunkingService.getSelectedChunksText(textChunks);
    setInputText(selectedText);
    setShowChunkSelector(false);
    setTextChunks([]);
  };

  const handleChunksCancel = () => {
    setShowChunkSelector(false);
    setTextChunks([]);
  };

  const startAnalysis = async () => {
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

    setIsAnalyzing(true);
    setAnalysisResults(null);
    setAnalysisProgress("Starting analysis...");

    try {
      const response = await fetch('/api/mind-reader/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          mode: selectedMode,
          llmProvider: selectedLLM,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response stream');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setAnalysisProgress(data.message);
              } else if (data.type === 'result') {
                setAnalysisResults(data.data);
              } else if (data.type === 'complete') {
                setAnalysisProgress("Analysis complete");
                break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: "Failed to complete analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stopAnalysis = () => {
    setIsAnalyzing(false);
    setAnalysisProgress("");
  };

  const downloadResults = () => {
    if (!analysisResults) return;

    const content = `Mind Reader Analysis Results
Mode: ${modeLabels[selectedMode]}
LLM: ${llmLabels[selectedLLM]}
Date: ${new Date().toISOString()}

Summary:
${analysisResults.summary}

Category: ${analysisResults.category}

Final Score: ${analysisResults.finalScore}/100

Detailed Responses:
${analysisResults.responses.map((r, i) => 
  `${i + 1}. ${r.question}
Answer: ${r.answer}
Score: ${r.score}/100\n`
).join('\n')}

Analyzed Text:
${inputText}
`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mind-reader-analysis-${selectedMode}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const characterCount = inputText.length;
  const wordCount = inputText.trim().split(/\s+/).filter(word => word.length > 0).length;

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Brain className="h-12 w-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Mind Reader</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Advanced cognitive, psychological, and psychopathological text analysis using multiple AI models.
            Upload documents or enter text for comprehensive profiling across six specialized analysis modes.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Input Section */}
          <div className="xl:col-span-2">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Text Input
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Analysis Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Analysis Mode</label>
                    <Select value={selectedMode} onValueChange={(value) => setSelectedMode(value as AnalysisMode)}>
                      <SelectTrigger data-testid="select-analysis-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cognitive-short">Cognitive (Normal)</SelectItem>
                        <SelectItem value="cognitive-long">Cognitive (Comprehensive)</SelectItem>
                        <SelectItem value="psychological-short">Psychological (Normal)</SelectItem>
                        <SelectItem value="psychological-long">Psychological (Comprehensive)</SelectItem>
                        <SelectItem value="psychopathological-short">Psychopathological (Normal)</SelectItem>
                        <SelectItem value="psychopathological-long">Psychopathological (Comprehensive)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">AI Model</label>
                    <Select value={selectedLLM} onValueChange={(value) => setSelectedLLM(value as LLMProvider)}>
                      <SelectTrigger data-testid="select-llm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zhi1">ZHI 1 (OpenAI)</SelectItem>
                        <SelectItem value="zhi2">ZHI 2 (Anthropic)</SelectItem>
                        <SelectItem value="zhi3">ZHI 3 (DeepSeek)</SelectItem>
                        <SelectItem value="zhi4">ZHI 4 (Perplexity)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium mb-2">File Upload</label>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-blue-300 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="file-upload-area"
                  >
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Supports: PDF, Word (.docx), Text (.txt)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file"
                    />
                  </div>
                  
                  {uploadedFile && (
                    <div className="mt-3 flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <File className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <p className="font-medium text-green-800" data-testid="text-filename">{uploadedFile.name}</p>
                        <p className="text-sm text-green-600" data-testid="text-filesize">{formatFileSize(uploadedFile.size)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                        data-testid="button-remove-file"
                        className="text-green-600 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {isUploading && (
                    <div className="mt-3 text-center text-gray-500">
                      <div className="inline-flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span>Processing file...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">Text Content</label>
                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter or paste your text here for analysis..."
                    className="min-h-80 resize-none"
                    data-testid="input-text"
                  />
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                    <span data-testid="text-character-count">{characterCount} characters</span>
                    <span data-testid="text-word-count">{wordCount} words</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex space-x-3">
                  <Button
                    onClick={startAnalysis}
                    disabled={isAnalyzing || !inputText.trim()}
                    className="flex-1"
                    data-testid="button-start-analysis"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start Analysis
                      </>
                    )}
                  </Button>
                  {isAnalyzing && (
                    <Button
                      onClick={stopAnalysis}
                      variant="outline"
                      data-testid="button-stop-analysis"
                    >
                      <StopCircle className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  )}
                  {analysisResults && (
                    <Button
                      onClick={downloadResults}
                      variant="outline"
                      data-testid="button-download-results"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="xl:col-span-1">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Analysis Results</CardTitle>
              </CardHeader>
              <CardContent>
                {isAnalyzing && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600" data-testid="text-analysis-progress">{analysisProgress}</p>
                  </div>
                )}

                {analysisResults && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <Badge variant="outline" className="mb-2">
                        {modeLabels[selectedMode]}
                      </Badge>
                      <div className="text-3xl font-bold text-blue-600" data-testid="text-final-score">
                        {analysisResults.finalScore}/100
                      </div>
                      <p className="text-sm text-gray-500">Final Score</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Summary</h4>
                      <p className="text-sm text-gray-700" data-testid="text-analysis-summary">
                        {analysisResults.summary}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Category</h4>
                      <Badge data-testid="text-analysis-category">
                        {analysisResults.category}
                      </Badge>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Phase</h4>
                      <p className="text-sm text-gray-700" data-testid="text-analysis-phase">
                        Phase {analysisResults.phase} {analysisResults.complete ? '(Complete)' : '(In Progress)'}
                      </p>
                    </div>

                    <Tabs defaultValue="overview" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="detailed">Detailed</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="overview" className="space-y-3">
                        <div className="text-sm">
                          <strong>Questions Answered:</strong> {analysisResults.responses.length}
                        </div>
                        <div className="text-sm">
                          <strong>Average Score:</strong> {Math.round(analysisResults.responses.reduce((sum, r) => sum + r.score, 0) / analysisResults.responses.length)}/100
                        </div>
                      </TabsContent>

                      <TabsContent value="detailed" className="space-y-4 max-h-96 overflow-y-auto">
                        {analysisResults.responses.map((response, index) => (
                          <div key={index} className="border-l-4 border-blue-200 pl-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-500">Q{index + 1}</span>
                              <Badge variant="secondary" className="text-xs">
                                {response.score}/100
                              </Badge>
                            </div>
                            <p className="text-sm font-medium mb-2">{response.question}</p>
                            <p className="text-xs text-gray-600">{response.answer}</p>
                          </div>
                        ))}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {!isAnalyzing && !analysisResults && (
                  <div className="text-center py-8 text-gray-500">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select analysis mode and enter text to begin</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Chunk Selector Modal */}
        {showChunkSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-4xl max-h-[80vh] m-4 overflow-hidden">
              <CardHeader>
                <CardTitle>Select Text Chunks for Analysis</CardTitle>
                <p className="text-sm text-gray-600">
                  Your text has been divided into chunks of approximately 1000 words each. Select the chunks you want to analyze.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto max-h-96">
                {textChunks.map((chunk, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={chunk.selected}
                          onChange={(e) => {
                            const updatedChunks = [...textChunks];
                            updatedChunks[index].selected = e.target.checked;
                            setTextChunks(updatedChunks);
                          }}
                          className="rounded"
                        />
                        <span className="font-medium">Chunk {index + 1}</span>
                        <Badge variant="outline">{chunk.wordCount} words</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {chunk.text.substring(0, 200)}...
                    </p>
                  </div>
                ))}
              </CardContent>
              <div className="p-6 border-t flex space-x-3">
                <Button
                  onClick={handleChunksProceed}
                  disabled={!textChunks.some(chunk => chunk.selected)}
                  className="flex-1"
                >
                  Proceed with Selected Chunks
                </Button>
                <Button onClick={handleChunksCancel} variant="outline">
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}