import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Play, Square, Download } from "lucide-react";
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
    setIsAnalyzing(false);
    setProgressMessage("");
  };

  const startAnalysis = async () => {
    const textToAnalyze = getTextToAnalyze();
    if (!textToAnalyze.trim()) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setStreamingMessages([]);
    setProgressMessage("Starting analysis...");

    try {
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
        throw new Error(`Analysis request failed: ${response.statusText}`);
      }

      setProgressMessage("Connected - processing...");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream available');
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream completed');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr) {
                const data = JSON.parse(jsonStr);
                
                console.log('Received stream data:', data);
                
                if (data.type === 'progress') {
                  setProgressMessage(data.message);
                  setStreamingMessages(prev => [...prev, data.message]);
                } else if (data.type === 'result') {
                  setAnalysisResult(data.data);
                  setProgressMessage("Analysis complete - displaying results");
                } else if (data.type === 'complete') {
                  setIsAnalyzing(false);
                  setProgressMessage("Analysis finished successfully");
                } else if (data.type === 'error') {
                  throw new Error(data.message);
                }
              }
            } catch (parseError) {
              console.error('Parse error for line:', line, parseError);
            }
          }
        }
      }

      if (buffer.trim() && buffer.startsWith('data: ')) {
        try {
          const jsonStr = buffer.slice(6).trim();
          if (jsonStr) {
            const data = JSON.parse(jsonStr);
            if (data.type === 'complete') {
              setIsAnalyzing(false);
              setProgressMessage("Analysis finished successfully");
            }
          }
        } catch (parseError) {
          console.error('Final parse error:', parseError);
        }
      }

      if (isAnalyzing) {
        setIsAnalyzing(false);
        setProgressMessage("Analysis completed");
      }

    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setProgressMessage(`Analysis failed: ${errorMessage}`);
      setIsAnalyzing(false);
    }
  };

  const downloadResults = () => {
    if (!analysisResult) return;

    let content = `Tab 2 Analysis Report\n`;
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
    a.download = `tab2-analysis-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-white p-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900">Tab 2</h1>
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-50 p-3 rounded mb-4 flex items-center gap-4 flex-wrap">
        <Select value={selectedMode} onValueChange={(value: AnalysisMode) => setSelectedMode(value)}>
          <SelectTrigger className="w-48" data-testid="analysis-type-select">
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

        <Select value={selectedLLM} onValueChange={(value: LLMProvider) => setSelectedLLM(value)}>
          <SelectTrigger className="w-40" data-testid="llm-provider-select">
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

        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2"
          data-testid="upload-file-button"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.doc,.docx"
          onChange={handleFileUpload}
          className="hidden"
        />

        {!isAnalyzing ? (
          <Button
            onClick={startAnalysis}
            disabled={!getTextToAnalyze().trim()}
            data-testid="start-analysis-button"
          >
            <Play className="h-4 w-4 mr-2" />
            Start
          </Button>
        ) : (
          <Button
            onClick={stopAnalysis}
            variant="destructive"
            data-testid="stop-analysis-button"
          >
            <Square className="h-4 w-4 mr-2" />
            Stop
          </Button>
        )}

        {analysisResult && (
          <Button
            onClick={downloadResults}
            variant="outline"
            data-testid="download-results-button"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        )}

        {progressMessage && (
          <div className="text-sm text-gray-600 ml-auto">
            {progressMessage}
          </div>
        )}
      </div>

      {/* Text Input - Large */}
      <Textarea
        placeholder="Paste or type your text here..."
        value={inputText}
        onChange={(e) => handleTextInput(e.target.value)}
        className="min-h-[500px] text-sm mb-4"
        data-testid="text-input"
      />

      {inputText && (
        <div className="text-sm text-gray-600 mb-4">
          Word count: {TextChunkingService.getWordCount(inputText)}
        </div>
      )}

      {/* Chunking Section */}
      {showChunks && (
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Text Chunks (Select which to analyze)</h3>
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
        </div>
      )}

      {/* Progress */}
      {isAnalyzing && (
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <div className="text-sm font-medium mb-2">Analysis Progress</div>
          <div className="text-sm text-gray-600 mb-2">{progressMessage}</div>
          <div className="max-h-32 overflow-y-auto bg-white p-2 rounded text-xs space-y-1">
            {streamingMessages.map((message, index) => (
              <div key={index} className="text-gray-600">
                {message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {analysisResult && (
        <div className="bg-gray-50 p-4 rounded">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Analysis Results</h3>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {analysisResult.finalScore}/100
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="font-medium mb-2">Summary</h4>
              <p className="text-sm text-gray-600">{analysisResult.summary}</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Category</h4>
              <Badge>{analysisResult.category}</Badge>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Question Responses</h4>
            {analysisResult.responses.map((response, index) => (
              <div key={index} className="bg-white p-3 rounded border space-y-2">
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
        </div>
      )}
    </div>
  );
}