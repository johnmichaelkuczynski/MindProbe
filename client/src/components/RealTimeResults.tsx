import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Maximize2, Loader2 } from "lucide-react";
import { useSSE } from "@/hooks/useSSE";
import { StreamEvent } from "@/types/analysis";

interface RealTimeResultsProps {
  analysisId: string | null;
  isStreaming: boolean;
}

interface ProcessedResult {
  type: 'summary' | 'question';
  content: string;
  questionId?: string;
  question?: string;
  complete: boolean;
}

export function RealTimeResults({ analysisId, isStreaming }: RealTimeResultsProps) {
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [streamingStatus, setStreamingStatus] = useState("Ready");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const streamUrl = analysisId ? `/api/analysis/${analysisId}/stream` : null;
  
  const { data: streamData, isConnected, error } = useSSE<StreamEvent>(streamUrl, (event) => {
    if (event.type === 'summary') {
      setResults(prev => {
        const existingSummaryIndex = prev.findIndex(r => r.type === 'summary');
        const newResult: ProcessedResult = {
          type: 'summary',
          content: event.data.content,
          complete: event.data.complete
        };
        
        if (existingSummaryIndex >= 0) {
          const updated = [...prev];
          updated[existingSummaryIndex] = newResult;
          return updated;
        } else {
          return [newResult, ...prev];
        }
      });
    } else if (event.type === 'question') {
      setResults(prev => {
        const existingQuestionIndex = prev.findIndex(r => 
          r.type === 'question' && r.questionId === event.data.questionId
        );
        
        const newResult: ProcessedResult = {
          type: 'question',
          content: event.data.answer,
          questionId: event.data.questionId,
          question: event.data.question,
          complete: event.data.complete
        };
        
        if (existingQuestionIndex >= 0) {
          const updated = [...prev];
          updated[existingQuestionIndex] = newResult;
          return updated;
        } else {
          return [...prev, newResult];
        }
      });
    } else if (event.type === 'complete') {
      setStreamingStatus("Complete");
    } else if (event.type === 'error') {
      setStreamingStatus("Error");
    }
  });

  useEffect(() => {
    if (isConnected) {
      setStreamingStatus("Streaming");
    } else if (error) {
      setStreamingStatus("Error");
    } else if (!analysisId) {
      setStreamingStatus("Ready");
    }
  }, [isConnected, error, analysisId]);

  useEffect(() => {
    if (!analysisId) {
      setResults([]);
      setStreamingStatus("Ready");
    }
  }, [analysisId]);

  const getStatusColor = () => {
    switch (streamingStatus) {
      case "Streaming": return "bg-success-green";
      case "Complete": return "bg-blue-500";
      case "Error": return "bg-red-500";
      default: return "bg-gray-400";
    }
  };

  const formatContent = (content: string) => {
    // Simple formatting for quotations and scores
    return content
      .split('\n')
      .map((line, index) => {
        if (line.includes('Score:')) {
          return (
            <div key={index} className="mt-4 p-3 bg-white rounded border border-border-light">
              <strong>{line}</strong>
            </div>
          );
        } else if (line.startsWith('"') && line.endsWith('"')) {
          return (
            <blockquote key={index} className="border-l-4 border-gray-300 pl-4 my-3 italic text-gray-600">
              {line}
            </blockquote>
          );
        } else {
          return <p key={index} className="text-gray-700 mb-2">{line}</p>;
        }
      });
  };

  return (
    <Card className={`border-border-light shadow-sm ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <div className="border-b border-border-light p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Real-Time Analysis Results</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()} ${streamingStatus === 'Streaming' ? 'animate-pulse' : ''}`} />
              <span className="text-sm text-gray-600" data-testid="text-streaming-status">{streamingStatus}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              data-testid="button-fullscreen"
              className="text-gray-500 hover:text-primary-blue"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <CardContent className="p-6">
        <div className={`space-y-6 ${isFullscreen ? 'max-h-[calc(100vh-200px)] overflow-y-auto' : 'min-h-96'}`}>
          
          {results.length === 0 && !isStreaming && (
            <div className="text-center py-12 text-gray-500">
              <p>No analysis results yet. Start an analysis to see real-time results here.</p>
            </div>
          )}

          {results.map((result, index) => (
            <div 
              key={`${result.type}-${result.questionId || 'summary'}-${index}`}
              className={`analysis-section border-l-4 pl-4 transition-all duration-300 ${
                result.type === 'summary' ? 'border-primary-blue' : 
                result.complete ? 'border-green-400' : 'border-yellow-400 opacity-70'
              }`}
            >
              <h3 className="font-semibold text-lg mb-2">
                {result.type === 'summary' 
                  ? 'Text Summary & Categorization'
                  : result.question || 'Processing...'
                }
              </h3>
              <div className="bg-bg-off-white p-4 rounded-lg">
                <div className={`streaming-content ${result.complete ? 'opacity-100' : 'opacity-70'}`}>
                  {formatContent(result.content)}
                  {!result.complete && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary-blue" />
                      <span className="text-sm text-gray-500">Generating response...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isStreaming && results.length > 0 && (
            <div className="analysis-section border-l-4 border-yellow-400 pl-4 opacity-60">
              <h3 className="font-semibold mb-2">Processing next question...</h3>
              <div className="bg-bg-off-white p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary-blue" />
                  <span className="text-gray-500">Analyzing response patterns...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
