import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Navigation } from '@/components/Navigation';
import { AlertCircle, FileText, Download, Upload, Loader2 } from 'lucide-react';

type ProtocolType = 
  | 'cognitive-normal' 
  | 'cognitive-comprehensive'
  | 'psychological-normal'
  | 'psychological-comprehensive'
  | 'psychopathological-normal'
  | 'psychopathological-comprehensive';

type LLMProvider = 'zhi1' | 'zhi2' | 'zhi3' | 'zhi4';

interface FormData {
  protocolType: ProtocolType;
  llmProvider: LLMProvider;
  inputText: string;
  additionalContext: string;
}

interface TextChunk {
  index: number;
  text: string;
  wordCount: number;
}

interface PhaseResponse {
  questionId: string;
  question: string;
  answer: string;
  complete: boolean;
}

interface Phase {
  phase: number;
  responses: PhaseResponse[];
  finalScore?: number;
}

export default function SixProtocols() {
  const [formData, setFormData] = useState<FormData>({
    protocolType: 'cognitive-normal',
    llmProvider: 'zhi1',
    inputText: '',
    additionalContext: ''
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [currentPhase, setCurrentPhase] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [textChunks, setTextChunks] = useState<TextChunk[]>([]);
  const [selectedChunks, setSelectedChunks] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if text needs chunking (over 300 words for testing, normally 1000)
  const wordCount = formData.inputText.trim().split(/\s+/).filter(word => word.length > 0).length;
  const needsChunking = wordCount > 300;

  const updateTextChunks = async (text: string) => {
    if (wordCount > 300) {
      try {
        const response = await fetch('/api/chunk-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, maxWords: 500 }),
        });
        if (response.ok) {
          const data = await response.json();
          setTextChunks(data.chunks);
        }
      } catch (error) {
        console.error('Error chunking text:', error);
      }
    } else {
      setTextChunks([]);
      setSelectedChunks([]);
    }
  };

  const handleChunkSelection = (chunkIndex: number) => {
    setSelectedChunks(prev => 
      prev.includes(chunkIndex) 
        ? prev.filter(i => i !== chunkIndex)
        : [...prev, chunkIndex]
    );
  };

  // File upload mutation
  const fileUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('Failed to upload file');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, inputText: data.text }));
      updateTextChunks(data.text);
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Upload failed');
    }
  });

  // Start analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: async (data: FormData & { selectedChunks?: number[], textChunks?: TextChunk[] }) => {
      const response = await fetch('/api/six-protocols/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to start analysis');
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentAnalysisId(data.analysisId);
      setIsAnalyzing(true);
      setPhases([]);
      setCurrentPhase(null);
      setError(null);
      
      // Start SSE connection
      startSSEConnection(data.analysisId);
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Failed to start analysis');
    }
  });

  const startSSEConnection = (analysisId: string) => {
    const eventSource = new EventSource(`/api/six-protocols/${analysisId}/stream`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'phase') {
          setCurrentPhase(data.data.phase);
        } else if (data.type === 'question') {
          const response = data.data;
          setPhases(prev => {
            const newPhases = [...prev];
            const currentPhaseIndex = newPhases.findIndex(p => p.phase === currentPhase);
            
            if (currentPhaseIndex >= 0) {
              const existingResponseIndex = newPhases[currentPhaseIndex].responses.findIndex(
                r => r.questionId === response.questionId
              );
              
              if (existingResponseIndex >= 0) {
                newPhases[currentPhaseIndex].responses[existingResponseIndex] = response;
              } else {
                newPhases[currentPhaseIndex].responses.push(response);
              }
            } else {
              newPhases.push({
                phase: currentPhase || 1,
                responses: [response]
              });
            }
            
            return newPhases;
          });
        } else if (data.type === 'phase_complete') {
          setPhases(prev => {
            const newPhases = [...prev];
            const phaseIndex = newPhases.findIndex(p => p.phase === data.data.phase);
            if (phaseIndex >= 0) {
              newPhases[phaseIndex].finalScore = data.data.finalScore;
            }
            return newPhases;
          });
        } else if (data.type === 'complete') {
          setIsAnalyzing(false);
          setCurrentPhase(null);
          eventSource.close();
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    };

    eventSource.onerror = () => {
      setIsAnalyzing(false);
      setCurrentPhase(null);
      eventSource.close();
    };
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      fileUploadMutation.mutate(file);
    }
  };

  const handleStartAnalysis = () => {
    if (!formData.inputText.trim()) {
      setError('Please provide text to analyze');
      return;
    }

    // For chunking, if no chunks selected, use all chunks
    if (needsChunking && selectedChunks.length === 0) {
      setSelectedChunks(textChunks.map((_, index) => index));
    }

    // Prepare text for analysis - either full text or selected chunks
    let analysisText = formData.inputText;
    if (needsChunking && selectedChunks.length > 0) {
      analysisText = selectedChunks.map(index => textChunks[index]?.text).join('\n\n');
    }

    startAnalysisMutation.mutate({
      ...formData,
      inputText: analysisText,
      selectedChunks: needsChunking ? selectedChunks : undefined,
      textChunks: needsChunking ? textChunks : undefined
    });
  };

  const downloadResults = () => {
    if (phases.length === 0) return;

    const protocolName = formData.protocolType.replace('-', ' ').toUpperCase();
    const providerName = formData.llmProvider.toUpperCase();
    
    let results = `${protocolName} ANALYSIS - ${providerName}\n`;
    results += `Generated: ${new Date().toISOString()}\n`;
    results += `${'='.repeat(60)}\n\n`;

    phases.forEach(phase => {
      results += `PHASE ${phase.phase}\n`;
      results += `${'='.repeat(20)}\n\n`;
      
      phase.responses.forEach(response => {
        results += `Question: ${response.question}\n\n`;
        results += `Answer: ${response.answer}\n\n`;
        results += `${'-'.repeat(40)}\n\n`;
      });
      
      if (phase.finalScore) {
        results += `Final Score: ${phase.finalScore}/100\n\n`;
      }
      
      results += `${'='.repeat(60)}\n\n`;
    });

    const blob = new Blob([results], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${protocolName.toLowerCase().replace(' ', '-')}-analysis-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getProtocolDescription = (type: ProtocolType) => {
    const descriptions = {
      'cognitive-normal': 'Phase 1 only: Direct cognitive questions with scoring',
      'cognitive-comprehensive': 'Phases 1-4: Full cognitive assessment with pushback and validation',
      'psychological-normal': 'Phase 1 only: Direct psychological questions with scoring',
      'psychological-comprehensive': 'Phases 1-4: Full psychological assessment with pushback and validation',
      'psychopathological-normal': 'Phase 1 only: Direct psychopathological questions with scoring',
      'psychopathological-comprehensive': 'Phases 1-4: Full psychopathological assessment with pushback and validation'
    };
    return descriptions[type] || '';
  };

  const getPhaseTitle = (phase: number) => {
    const titles = {
      1: 'Phase 1: Core Assessment',
      2: 'Phase 2: Pushback Protocol',
      3: 'Phase 3: Walmart Metric Enforcement',
      4: 'Phase 4: Final Validation'
    };
    return titles[phase as keyof typeof titles] || `Phase ${phase}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navigation />
      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Six Protocol Analysis</h1>
          <p className="text-muted-foreground">
            Cognitive, Psychological, and Psychopathological analysis - each with Normal and Comprehensive modes
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Protocol Configuration</CardTitle>
            <CardDescription>
              Pure passthrough system with no filtering - direct LLM evaluation using ZHI providers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="protocol-type">Protocol Type</Label>
                <Select 
                  value={formData.protocolType} 
                  onValueChange={(value: ProtocolType) => 
                    setFormData(prev => ({ ...prev, protocolType: value }))
                  }
                >
                  <SelectTrigger data-testid="select-protocol-type">
                    <SelectValue placeholder="Select protocol type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cognitive-normal">Cognitive (Normal)</SelectItem>
                    <SelectItem value="cognitive-comprehensive">Cognitive (Comprehensive)</SelectItem>
                    <SelectItem value="psychological-normal">Psychological (Normal)</SelectItem>
                    <SelectItem value="psychological-comprehensive">Psychological (Comprehensive)</SelectItem>
                    <SelectItem value="psychopathological-normal">Psychopathological (Normal)</SelectItem>
                    <SelectItem value="psychopathological-comprehensive">Psychopathological (Comprehensive)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {getProtocolDescription(formData.protocolType)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="llm-provider">LLM Provider</Label>
                <Select 
                  value={formData.llmProvider} 
                  onValueChange={(value: LLMProvider) => 
                    setFormData(prev => ({ ...prev, llmProvider: value }))
                  }
                >
                  <SelectTrigger data-testid="select-llm-provider">
                    <SelectValue placeholder="Select LLM provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zhi1">ZHI 1</SelectItem>
                    <SelectItem value="zhi2">ZHI 2</SelectItem>
                    <SelectItem value="zhi3">ZHI 3</SelectItem>
                    <SelectItem value="zhi4">ZHI 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="input-text">Text to Analyze</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={fileUploadMutation.isPending}
                    data-testid="button-upload-file"
                  >
                    {fileUploadMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
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
              </div>
              
              <Textarea
                id="input-text"
                placeholder="Enter the text you want to analyze using the protocol suite..."
                value={formData.inputText}
                onChange={(e) => {
                  const newText = e.target.value;
                  setFormData(prev => ({ ...prev, inputText: newText }));
                  updateTextChunks(newText);
                }}
                className="min-h-[200px]"
                data-testid="textarea-input-text"
              />

              {/* Chunk Selection Interface */}
              {needsChunking && textChunks.length > 0 && (
                <Card className="mt-4 border-2 border-blue-500 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-800">⚠️ Chunk Selection Available</CardTitle>
                    <CardDescription className="text-blue-700 font-medium">
                      Your text is over 300 words ({wordCount} words). You can select specific chunks to analyze:
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      {textChunks.map((chunk) => (
                        <Button
                          key={chunk.index}
                          variant={selectedChunks.includes(chunk.index) ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleChunkSelection(chunk.index)}
                          data-testid={`button-chunk-${chunk.index}`}
                        >
                          Chunk {chunk.index + 1} ({chunk.wordCount} words)
                        </Button>
                      ))}
                    </div>
                    
                    {selectedChunks.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Chunks Preview:</Label>
                        <div className="max-h-32 overflow-y-auto bg-muted p-3 rounded text-sm">
                          {selectedChunks.map(index => (
                            <div key={index} className="mb-2">
                              <Badge variant="secondary" className="mb-1">
                                Chunk {index + 1} ({textChunks[index]?.wordCount || 0} words)
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {textChunks[index]?.text.substring(0, 150)}...
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Show info about chunking */}
              {needsChunking && textChunks.length > 0 && (
                <Alert className="border-blue-500 bg-blue-50">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    {selectedChunks.length === 0 
                      ? "No chunks selected - will analyze all chunks when you start" 
                      : `${selectedChunks.length} of ${textChunks.length} chunks selected for analysis`
                    }
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="additional-context">Additional Context (Optional)</Label>
                <Textarea
                  id="additional-context"
                  placeholder="Provide any additional context or specific areas of focus..."
                  value={formData.additionalContext}
                  onChange={(e) => setFormData(prev => ({ ...prev, additionalContext: e.target.value }))}
                  className="min-h-[100px]"
                  data-testid="textarea-additional-context"
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing || !formData.inputText.trim()}
                className="flex-1"
                size="lg"
                data-testid="button-start-analysis"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Start Protocol Analysis
                  </>
                )}
              </Button>
              
              {phases.length > 0 && (
                <Button
                  onClick={downloadResults}
                  variant="outline"
                  size="lg"
                  data-testid="button-download-results"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download TXT
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analysis Progress */}
        {isAnalyzing && currentPhase && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {getPhaseTitle(currentPhase)} in Progress
              </CardTitle>
              <CardDescription>
                Protocol analysis is processing your text through multiple validation phases
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Phase Results */}
        {phases.map((phase, phaseIndex) => (
          <Card key={`phase-${phase.phase}-${phaseIndex}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{getPhaseTitle(phase.phase)}</CardTitle>
                <Badge variant="secondary">
                  Phase {phase.phase}
                  {phase.finalScore && ` - Score: ${phase.finalScore}/100`}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {phase.responses && phase.responses.map((response: PhaseResponse, index: number) => (
                <div key={`response-${phase.phase}-${index}`} className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="font-medium text-sm mb-2">Question {parseInt(response.questionId) + 1}:</div>
                    <div className="text-sm mb-3">{response.question}</div>
                    <div className="text-sm whitespace-pre-wrap">{response.answer}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}