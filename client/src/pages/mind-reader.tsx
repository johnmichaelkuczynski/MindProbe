import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, Play, Square, Download } from "lucide-react";
import { TextChunkingService, type TextChunk } from "@shared/textUtils";
import { DragDropTextarea } from "@/components/DragDropTextarea";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'tab1' | 'tab2'>('tab1');
  
  // Tab 1 state
  const [tab1InputText, setTab1InputText] = useState("");
  const [tab1SelectedMode, setTab1SelectedMode] = useState<AnalysisMode>('cognitive-short');
  const [tab1SelectedLLM, setTab1SelectedLLM] = useState<LLMProvider>('zhi1');
  const [tab1IsAnalyzing, setTab1IsAnalyzing] = useState(false);
  const [tab1AnalysisResult, setTab1AnalysisResult] = useState<AnalysisResult | null>(null);
  const [tab1ProgressMessage, setTab1ProgressMessage] = useState("");
  const [tab1StreamingMessages, setTab1StreamingMessages] = useState<string[]>([]);
  const [tab1Chunks, setTab1Chunks] = useState<TextChunk[]>([]);
  const [tab1ShowChunks, setTab1ShowChunks] = useState(false);
  
  // Tab 2 state
  const [tab2InputText, setTab2InputText] = useState("");
  const [tab2SelectedMode, setTab2SelectedMode] = useState<AnalysisMode>('cognitive-short');
  const [tab2SelectedLLM, setTab2SelectedLLM] = useState<LLMProvider>('zhi1');
  const [tab2IsAnalyzing, setTab2IsAnalyzing] = useState(false);
  const [tab2AnalysisResult, setTab2AnalysisResult] = useState<AnalysisResult | null>(null);
  const [tab2ProgressMessage, setTab2ProgressMessage] = useState("");
  const [tab2StreamingMessages, setTab2StreamingMessages] = useState<string[]>([]);
  const [tab2Chunks, setTab2Chunks] = useState<TextChunk[]>([]);
  const [tab2ShowChunks, setTab2ShowChunks] = useState(false);

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

  const handleTextInput = (text: string, tabId: 'tab1' | 'tab2' = activeTab) => {
    if (tabId === 'tab1') {
      setTab1InputText(text);
      if (TextChunkingService.needsChunking(text)) {
        const newChunks = TextChunkingService.createChunks(text);
        setTab1Chunks(newChunks);
        setTab1ShowChunks(true);
      } else {
        setTab1Chunks([]);
        setTab1ShowChunks(false);
      }
    } else {
      setTab2InputText(text);
      if (TextChunkingService.needsChunking(text)) {
        const newChunks = TextChunkingService.createChunks(text);
        setTab2Chunks(newChunks);
        setTab2ShowChunks(true);
      } else {
        setTab2Chunks([]);
        setTab2ShowChunks(false);
      }
    }
  };

  const toggleChunk = (chunkId: string, tabId: 'tab1' | 'tab2' = activeTab) => {
    if (tabId === 'tab1') {
      setTab1Chunks(tab1Chunks.map(chunk => 
        chunk.id === chunkId ? { ...chunk, selected: !chunk.selected } : chunk
      ));
    } else {
      setTab2Chunks(tab2Chunks.map(chunk => 
        chunk.id === chunkId ? { ...chunk, selected: !chunk.selected } : chunk
      ));
    }
  };

  const selectAllChunks = (tabId: 'tab1' | 'tab2' = activeTab) => {
    if (tabId === 'tab1') {
      setTab1Chunks(tab1Chunks.map(chunk => ({ ...chunk, selected: true })));
    } else {
      setTab2Chunks(tab2Chunks.map(chunk => ({ ...chunk, selected: true })));
    }
  };

  const deselectAllChunks = (tabId: 'tab1' | 'tab2' = activeTab) => {
    if (tabId === 'tab1') {
      setTab1Chunks(tab1Chunks.map(chunk => ({ ...chunk, selected: false })));
    } else {
      setTab2Chunks(tab2Chunks.map(chunk => ({ ...chunk, selected: false })));
    }
  };

  const getTextToAnalyze = (tabId: 'tab1' | 'tab2' = activeTab) => {
    const tabData = tabId === 'tab1' ? 
      { showChunks: tab1ShowChunks, chunks: tab1Chunks, inputText: tab1InputText } :
      { showChunks: tab2ShowChunks, chunks: tab2Chunks, inputText: tab2InputText };
      
    if (tabData.showChunks && tabData.chunks.length > 0) {
      return TextChunkingService.getSelectedChunksText(tabData.chunks);
    }
    return tabData.inputText;
  };

  const stopAnalysis = () => {
    if (activeTab === 'tab1') {
      setTab1IsAnalyzing(false);
      setTab1ProgressMessage("");
    } else {
      setTab2IsAnalyzing(false);
      setTab2ProgressMessage("");
    }
  };

  const startAnalysis = async () => {
    const textToAnalyze = getTextToAnalyze(activeTab);
    if (!textToAnalyze.trim()) return;

    // Set analyzing state for current tab
    if (activeTab === 'tab1') {
      setTab1IsAnalyzing(true);
      setTab1AnalysisResult(null);
      setTab1StreamingMessages([]);
      setTab1ProgressMessage("Starting analysis...");
    } else {
      setTab2IsAnalyzing(true);
      setTab2AnalysisResult(null);
      setTab2StreamingMessages([]);
      setTab2ProgressMessage("Starting analysis...");
    }

    try {
      const response = await fetch('/api/mind-reader/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToAnalyze,
          mode: currentTab.selectedMode,
          llmProvider: currentTab.selectedLLM,
        }),
      });

      if (!response.ok) {
        throw new Error(`Analysis request failed: ${response.statusText}`);
      }

      if (activeTab === 'tab1') {
        setTab1ProgressMessage("Connected - processing...");
      } else {
        setTab2ProgressMessage("Connected - processing...");
      }

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
                  if (activeTab === 'tab1') {
                    setTab1ProgressMessage(data.message);
                    setTab1StreamingMessages(prev => [...prev, data.message]);
                  } else {
                    setTab2ProgressMessage(data.message);
                    setTab2StreamingMessages(prev => [...prev, data.message]);
                  }
                } else if (data.type === 'result') {
                  if (activeTab === 'tab1') {
                    setTab1AnalysisResult(data.data);
                    setTab1ProgressMessage("Analysis complete - displaying results");
                  } else {
                    setTab2AnalysisResult(data.data);
                    setTab2ProgressMessage("Analysis complete - displaying results");
                  }
                } else if (data.type === 'complete') {
                  if (activeTab === 'tab1') {
                    setTab1IsAnalyzing(false);
                    setTab1ProgressMessage("Analysis finished successfully");
                  } else {
                    setTab2IsAnalyzing(false);
                    setTab2ProgressMessage("Analysis finished successfully");
                  }
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
              if (activeTab === 'tab1') {
                setTab1IsAnalyzing(false);
                setTab1ProgressMessage("Analysis finished successfully");
              } else {
                setTab2IsAnalyzing(false);
                setTab2ProgressMessage("Analysis finished successfully");
              }
            }
          }
        } catch (parseError) {
          console.error('Final parse error:', parseError);
        }
      }

      if (activeTab === 'tab1') {
        if (tab1IsAnalyzing) {
          setTab1IsAnalyzing(false);
          setTab1ProgressMessage("Analysis completed");
        }
      } else {
        if (tab2IsAnalyzing) {
          setTab2IsAnalyzing(false);
          setTab2ProgressMessage("Analysis completed");
        }
      }

    } catch (error) {
      console.error('Analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (activeTab === 'tab1') {
        setTab1ProgressMessage(`Analysis failed: ${errorMessage}`);
        setTab1IsAnalyzing(false);
      } else {
        setTab2ProgressMessage(`Analysis failed: ${errorMessage}`);
        setTab2IsAnalyzing(false);
      }
    }
  };

  const downloadResults = () => {
    if (!currentTab.analysisResult) return;

    let content = `${activeTab} Analysis Report\n`;
    content += `Analysis Type: ${currentTab.selectedMode}\n`;
    content += `LLM Provider: ${currentTab.selectedLLM}\n`;
    content += `Date: ${new Date().toISOString()}\n\n`;
    content += `Summary: ${currentTab.analysisResult.summary}\n\n`;
    content += `Category: ${currentTab.analysisResult.category}\n\n`;
    content += `Final Score: ${currentTab.analysisResult.finalScore}/100\n\n`;
    content += `Questions and Responses:\n\n`;

    currentTab.analysisResult.responses.forEach((response, index) => {
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

  // Get current tab values
  const getCurrentTabValues = () => {
    if (activeTab === 'tab1') {
      return {
        inputText: tab1InputText,
        selectedMode: tab1SelectedMode,
        selectedLLM: tab1SelectedLLM,
        isAnalyzing: tab1IsAnalyzing,
        analysisResult: tab1AnalysisResult,
        progressMessage: tab1ProgressMessage,
        streamingMessages: tab1StreamingMessages,
        chunks: tab1Chunks,
        showChunks: tab1ShowChunks,
      };
    } else {
      return {
        inputText: tab2InputText,
        selectedMode: tab2SelectedMode,
        selectedLLM: tab2SelectedLLM,
        isAnalyzing: tab2IsAnalyzing,
        analysisResult: tab2AnalysisResult,
        progressMessage: tab2ProgressMessage,
        streamingMessages: tab2StreamingMessages,
        chunks: tab2Chunks,
        showChunks: tab2ShowChunks,
      };
    }
  };

  const currentTab = getCurrentTabValues();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Mind Reader - Cognitive Analysis Platform
          </h1>
          <p className="text-gray-600 mt-1">
            Advanced AI-powered text analysis with multiple LLM providers
          </p>
          
          {/* Tab Navigation */}
          <div className="flex mt-4 space-x-1">
            <button
              onClick={() => setActiveTab('tab1')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'tab1'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              data-testid="button-tab1"
            >
              Tab 1
            </button>
            <button
              onClick={() => setActiveTab('tab2')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'tab2'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              data-testid="button-tab2"
            >
              Tab 2
            </button>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-50 p-3 border-b flex items-center gap-4 flex-wrap">
        <Select 
          value={currentTab.selectedMode} 
          onValueChange={(value: AnalysisMode) => {
            if (activeTab === 'tab1') {
              setTab1SelectedMode(value);
            } else {
              setTab2SelectedMode(value);
            }
          }}
        >
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

        <Select 
          value={currentTab.selectedLLM} 
          onValueChange={(value: LLMProvider) => {
            if (activeTab === 'tab1') {
              setTab1SelectedLLM(value);
            } else {
              setTab2SelectedLLM(value);
            }
          }}
        >
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

        {!currentTab.isAnalyzing ? (
          <Button
            onClick={startAnalysis}
            disabled={!currentTab.inputText.trim()}
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

        {currentTab.analysisResult && (
          <Button
            onClick={downloadResults}
            variant="outline"
            data-testid="download-results-button"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        )}

        {currentTab.progressMessage && (
          <div className="text-sm text-gray-600 ml-auto">
            {currentTab.progressMessage}
          </div>
        )}
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex h-[calc(100vh-180px)]">
        {/* Left Panel - Text Input */}
        <div className="w-1/3 border-r flex flex-col">
          <div className="p-4 flex-1 flex flex-col">
            <DragDropTextarea
              value={currentTab.inputText}
              onChange={(text) => handleTextInput(text, activeTab)}
              placeholder="Enter your text here or drag and drop TXT, PDF, or Word files to analyze..."
              className="flex-1 text-sm"
              rows={25}
              onFileUpload={async (file) => {
                console.log(`File uploaded to ${activeTab}:`, file.name);
              }}
            />
            
            {currentTab.inputText && (
              <div className="text-sm text-gray-600 mt-2">
                Word count: {TextChunkingService.getWordCount(currentTab.inputText)}
              </div>
            )}

            {/* Chunking Section */}
            {currentTab.showChunks && (
              <div className="mt-4 max-h-64 overflow-y-auto border rounded p-3 bg-amber-50">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-amber-800">
                    Text Chunks ({currentTab.chunks.length} chunks, {currentTab.chunks.filter(c => c.selected).length} selected)
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectAllChunks(activeTab)}
                      className="text-xs h-6 px-2"
                      data-testid="button-select-all-chunks"
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deselectAllChunks(activeTab)}
                      className="text-xs h-6 px-2"
                      data-testid="button-deselect-all-chunks"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-amber-700 mb-3 p-2 bg-amber-100 rounded">
                  ⚠️ Text is longer than 1000 words. Select which chunks to analyze.
                </div>
                <div className="space-y-2">
                  {currentTab.chunks.map((chunk) => (
                    <div
                      key={chunk.id}
                      className={`p-2 border rounded cursor-pointer transition-colors ${
                        chunk.selected ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-gray-200'
                      }`}
                      onClick={() => toggleChunk(chunk.id, activeTab)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <Badge variant={chunk.selected ? "default" : "secondary"} className="text-xs">
                          {chunk.selected ? '✓ ' : '○ '}Chunk {parseInt(chunk.id.split('-')[1]) + 1} ({chunk.wordCount} words)
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">
                        {chunk.text.substring(0, 150)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Output Stream */}
        <div className="w-2/3 flex flex-col">
          <div className="p-4 flex-1 overflow-y-auto">
            {/* Progress */}
            {currentTab.isAnalyzing && (
              <div className="mb-4 p-4 bg-blue-50 rounded">
                <div className="text-sm font-medium mb-2">Analysis Progress</div>
                <div className="text-sm text-gray-600 mb-2">{currentTab.progressMessage}</div>
                <div className="max-h-32 overflow-y-auto bg-white p-2 rounded text-xs space-y-1">
                  {currentTab.streamingMessages.map((message, index) => (
                    <div key={index} className="text-gray-600">
                      {message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {currentTab.analysisResult && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Analysis Results</h3>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {currentTab.analysisResult.finalScore}/100
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="text-sm text-gray-600">{currentTab.analysisResult.summary}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Category</h4>
                    <Badge>{currentTab.analysisResult.category}</Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Question Responses</h4>
                  {currentTab.analysisResult.responses.map((response, index) => (
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

            {/* Empty state when no analysis */}
            {!currentTab.isAnalyzing && !currentTab.analysisResult && (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-lg mb-2">Output Stream</div>
                  <div className="text-sm">Analysis results will appear here</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}