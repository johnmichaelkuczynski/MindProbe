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
}

interface AdvancedPhaseEvent {
  type: 'phase' | 'phase_complete' | 'complete' | 'error';
  data: any;
}

export default function AdvancedProfiler() {
  const [formData, setFormData] = useState<AdvancedAnalysisFormData>({
    analysisType: 'advanced-cognitive',
    llmProvider: 'zhi2',
    inputText: '',
    additionalContext: ''
  });
  
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [currentPhase, setCurrentPhase] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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
    },
    !!currentAnalysisId && isAnalyzing
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
    startAnalysisMutation.mutate(formData);
  };

  const getAnalysisTypeDescription = (type: AdvancedAnalysisType) => {
    const descriptions = {
      'advanced-cognitive': 'Deep cognitive assessment using advanced intelligence protocol with insight focus',
      'advanced-comprehensive-cognitive': 'Complete 4-phase cognitive analysis with pushback and Walmart metric',
      'advanced-psychological': 'Advanced psychological profiling with ego strength and defense analysis',
      'advanced-comprehensive-psychological': 'Full 4-phase psychological assessment with validation protocols',
      'advanced-psychopathological': 'Advanced pathology detection with reality testing focus',
      'advanced-comprehensive-psychopathological': 'Complete 4-phase psychopathological analysis with calibration'
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
          Advanced cognitive, psychological, and psychopathological analysis with 4-phase validation protocol
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Advanced Analysis Configuration</CardTitle>
          <CardDescription>
            Configure your advanced analysis with enhanced scoring methodology (95-100/100 calibration)
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
                  <SelectItem value="advanced-cognitive">Advanced Cognitive</SelectItem>
                  <SelectItem value="advanced-comprehensive-cognitive">Advanced Comprehensive Cognitive</SelectItem>
                  <SelectItem value="advanced-psychological">Advanced Psychological</SelectItem>
                  <SelectItem value="advanced-comprehensive-psychological">Advanced Comprehensive Psychological</SelectItem>
                  <SelectItem value="advanced-psychopathological">Advanced Psychopathological</SelectItem>
                  <SelectItem value="advanced-comprehensive-psychopathological">Advanced Comprehensive Psychopathological</SelectItem>
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
              onChange={(e) => setFormData(prev => ({ ...prev, inputText: e.target.value }))}
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

          <Button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing || !formData.inputText.trim()}
            className="w-full"
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
                Start Advanced Analysis
              </>
            )}
          </Button>
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
      {phases.map((phase) => (
        <Card key={phase.phase}>
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
            {phase.responses.map((response: any, index: number) => (
              <div key={index} className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">
                    {response.content}
                  </pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  Generated at {new Date(response.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      </div>
    </div>
  );
}