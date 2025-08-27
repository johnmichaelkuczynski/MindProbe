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

interface ProtocolFormData {
  protocolType: ProtocolType;
  llmProvider: LLMProvider;
  inputText: string;
  additionalContext: string;
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

export default function ProtocolSuite() {
  const [formData, setFormData] = useState<ProtocolFormData>({
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    },
    onError: (error) => {
      setError(error instanceof Error ? error.message : 'Upload failed');
    }
  });

  // Start analysis mutation
  const startAnalysisMutation = useMutation({
    mutationFn: async (data: ProtocolFormData) => {
      const response = await fetch('/api/protocol-analysis/start', {
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
    const eventSource = new EventSource(`/api/protocol-analysis/${analysisId}/stream`);
    
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

    startAnalysisMutation.mutate(formData);
  };

  const downloadResults = () => {
    if (phases.length === 0) return;

    const results = phases.map(phase => {
      let phaseContent = `=== PHASE ${phase.phase} ===\n\n`;
      
      phase.responses.forEach(response => {
        phaseContent += `Question: ${response.question}\n\n`;
        phaseContent += `Answer: ${response.answer}\n\n`;
        phaseContent += '---\n\n';
      });
      
      if (phase.finalScore) {
        phaseContent += `Final Score: ${phase.finalScore}/100\n\n`;
      }
      
      return phaseContent;
    }).join('\n');

    const blob = new Blob([results], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-analysis-${Date.now()}.txt`;
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
          <h1 className="text-3xl font-bold">Protocol Suite</h1>
          <p className="text-muted-foreground">
            Six protocol implementations: Cognitive, Psychological, and Psychopathological - each with Normal and Comprehensive modes
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
                  setFormData(prev => ({ ...prev, inputText: e.target.value }));
                }}
                className="min-h-[200px]"
                data-testid="textarea-input-text"
              />

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
                Protocol suite is processing your text through multiple validation phases
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