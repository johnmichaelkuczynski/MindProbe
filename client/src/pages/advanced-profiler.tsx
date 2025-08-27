import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Upload, FileText, Loader2, Download, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AdvancedAnalysisType, LLMProvider } from '@/types/analysis';
import { apiRequest } from '@/lib/queryClient';
import { useSSE } from '@/hooks/useSSE';
import { Navigation } from '@/components/Navigation';

interface AdvancedAnalysisFormData {
  analysisType: AdvancedAnalysisType;
  llmProvider: LLMProvider;
  inputText: string;
  additionalContext?: string;
  selectedChunks?: number[];
}

interface AdvancedPhaseEvent {
  type: 'phase' | 'phase_complete' | 'complete' | 'error';
  data: any;
}

export default function AdvancedProfiler() {
  const [formData, setFormData] = useState<AdvancedAnalysisFormData>({
    analysisType: 'cognitive-short',
    llmProvider: 'zhi2',
    inputText: '',
    additionalContext: ''
  });
  
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [currentPhase, setCurrentPhase] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textChunks, setTextChunks] = useState<{text: string, index: number}[]>([]);
  const [selectedChunks, setSelectedChunks] = useState<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if text needs chunking (over 1000 words)
  const needsChunking = formData.inputText.split(' ').length > 1000;

  // Generate chunks when text changes
  const generateChunks = (text: string) => {
    const words = text.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += 1000) {
      chunks.push({
        text: words.slice(i, i + 1000).join(' '),
        index: Math.floor(i / 1000)
      });
    }
    return chunks;
  };

  // Update chunks when input text changes
  const updateTextChunks = (text: string) => {
    if (text.split(' ').length > 1000) {
      const chunks = generateChunks(text);
      setTextChunks(chunks);
      setSelectedChunks([0]); // Select first chunk by default
    } else {
      setTextChunks([]);
      setSelectedChunks([]);
    }
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
    mutationFn: async (data: AdvancedAnalysisFormData) => {
      const response = await fetch('/api/advanced-analysis/start', {
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
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Failed to start analysis');
    }
  });

  // SSE for streaming results
  useSSE(
    currentAnalysisId ? `/api/advanced-analysis/${currentAnalysisId}/stream` : null,
    (event: AdvancedPhaseEvent) => {
      console.log('Advanced SSE event:', event);
      
      if (event.type === 'phase') {
        setCurrentPhase(event.data.phase);
      } else if (event.type === 'phase_complete') {
        setPhases(prev => [...prev, event.data.result]);
      } else if (event.type === 'complete') {
        setIsAnalyzing(false);
        setCurrentPhase(null);
      } else if (event.type === 'error') {
        setError(event.data.error);
        setIsAnalyzing(false);
        setCurrentPhase(null);
      }
    }
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      fileUploadMutation.mutate(file);
    }
  };

  const handleStartAnalysis = () => {
    if (!formData.inputText.trim()) {
      setError('Please provide text to analyze');
      return;
    }
    
    if (needsChunking && selectedChunks.length === 0) {
      setError('Please select at least one chunk to analyze');
      return;
    }
    
    // Prepare text for analysis - either full text or selected chunks
    let textToAnalyze = formData.inputText;
    if (needsChunking && selectedChunks.length > 0) {
      textToAnalyze = selectedChunks.map(index => textChunks[index]?.text).filter(Boolean).join('\n\n---CHUNK BREAK---\n\n');
    }
    
    const analysisData = {
      ...formData,
      inputText: textToAnalyze,
      selectedChunks: needsChunking ? selectedChunks : []
    };
    
    startAnalysisMutation.mutate(analysisData);
  };

  const handleChunkSelection = (chunkIndex: number) => {
    setSelectedChunks(prev => 
      prev.includes(chunkIndex) 
        ? prev.filter(i => i !== chunkIndex)
        : [...prev, chunkIndex]
    );
  };

  const downloadResults = () => {
    if (phases.length === 0) return;
    
    const results = phases.map(phase => `
PHASE ${phase.phase}
${phase.questions?.map((q: any, i: number) => `${i+1}. ${q.question}`).join('\n') || ''}

RESPONSE:
${phase.responses?.[0]?.content || 'No response'}
`).join('\n\n---\n\n');

    const blob = new Blob([results], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mind-reader-analysis-${formData.analysisType}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getAnalysisTypeDescription = (type: AdvancedAnalysisType) => {
    const descriptions = {
      'cognitive-short': 'Phase 1 only: Direct cognitive questions with scoring',
      'cognitive-long': 'Full 4-phase cognitive analysis with pushback and Walmart metric enforcement',
      'psychological-short': 'Phase 1 only: Core psychological profiling questions',
      'psychological-long': 'Complete 4-phase psychological assessment with validation protocols',
      'psychopathological-short': 'Phase 1 only: Direct pathology assessment questions',
      'psychopathological-long': 'Full 4-phase psychopathological analysis with comprehensive validation'
    };
    return descriptions[type];
  };

  const getPhaseTitle = (phase: number) => {
    const titles = {
      1: 'Phase 1: Core Analysis',
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
        <h1 className="text-3xl font-bold">Advanced Profiler</h1>
        <p className="text-muted-foreground">
          Six analysis modes: Cognitive, Psychological, and Psychopathological - each with Short (Phase 1) and Long (4-Phase) variants
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mind Reader Analysis Configuration</CardTitle>
          <CardDescription>
            Pure passthrough system with no filtering - direct LLM evaluation using ZHI providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="analysis-type">Analysis Type</Label>
              <Select 
                value={formData.analysisType} 
                onValueChange={(value: AdvancedAnalysisType) => 
                  setFormData(prev => ({ ...prev, analysisType: value }))
                }
              >
                <SelectTrigger data-testid="select-analysis-type">
                  <SelectValue placeholder="Select analysis type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cognitive-short">Cognitive (Short)</SelectItem>
                  <SelectItem value="cognitive-long">Cognitive (Long)</SelectItem>
                  <SelectItem value="psychological-short">Psychological (Short)</SelectItem>
                  <SelectItem value="psychological-long">Psychological (Long)</SelectItem>
                  <SelectItem value="psychopathological-short">Psychopathological (Short)</SelectItem>
                  <SelectItem value="psychopathological-long">Psychopathological (Long)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {getAnalysisTypeDescription(formData.analysisType)}
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
                  <SelectItem value="zhi1">ZHI 1 (OpenAI)</SelectItem>
                  <SelectItem value="zhi2">ZHI 2 (Anthropic)</SelectItem>
                  <SelectItem value="zhi3">ZHI 3 (DeepSeek)</SelectItem>
                  <SelectItem value="zhi4">ZHI 4 (Perplexity)</SelectItem>
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
              placeholder="Enter the text you want to analyze using the advanced profiler protocol..."
              value={formData.inputText}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, inputText: e.target.value }));
                updateTextChunks(e.target.value);
              }}
              className="min-h-[200px]"
              data-testid="textarea-input-text"
            />

            {/* Chunk Selection Interface */}
            {needsChunking && textChunks.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Chunk Selection</CardTitle>
                  <CardDescription>
                    Your text is over 1000 words. Select which chunks to analyze:
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
                        Chunk {chunk.index + 1}
                      </Button>
                    ))}
                  </div>
                  
                  {selectedChunks.length > 0 && (
                    <div className="space-y-2">
                      <Label>Selected Chunks Preview:</Label>
                      <div className="max-h-32 overflow-y-auto bg-muted p-3 rounded text-sm">
                        {selectedChunks.map(index => (
                          <div key={index} className="mb-2">
                            <Badge variant="secondary" className="mb-1">Chunk {index + 1}</Badge>
                            <p className="text-xs text-muted-foreground">
                              {textChunks[index]?.text.substring(0, 100)}...
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
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
              disabled={
                isAnalyzing || 
                !formData.inputText.trim() || 
                (needsChunking && selectedChunks.length === 0)
              }
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
                  Start Mind Reader Analysis
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
              Advanced profiler protocol is processing your text through multiple validation phases
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
            {phase.responses && phase.responses.map((response: any, index: number) => (
              <div key={`response-${phase.phase}-${index}`} className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">
                    {response.content || JSON.stringify(response, null, 2)}
                  </pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generated at {new Date(response.timestamp || Date.now()).toLocaleString()}
                </p>
              </div>
            ))}
            {phase.questions && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Analysis Questions ({phase.questions.length})</h4>
                <div className="grid gap-2">
                  {phase.questions.map((q: any, qIndex: number) => (
                    <div key={`question-${phase.phase}-${qIndex}`} className="text-sm p-2 bg-blue-50 rounded">
                      <span className="font-medium">{q.category}:</span> {q.question}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}