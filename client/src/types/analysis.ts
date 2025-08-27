export type AnalysisType = 
  | 'cognitive' 
  | 'comprehensive-cognitive' 
  | 'psychological' 
  | 'comprehensive-psychological' 
  | 'psychopathological' 
  | 'comprehensive-psychopathological';

export type AdvancedAnalysisType = 
  | 'cognitive-short' 
  | 'cognitive-long'
  | 'psychological-short' 
  | 'psychological-long'
  | 'psychopathological-short' 
  | 'psychopathological-long';

export type AllAnalysisTypes = AnalysisType | AdvancedAnalysisType;

export type LLMProvider = "zhi1" | "zhi2" | "zhi3" | "zhi4";

export interface AnalysisConfig {
  analysisType: AnalysisType;
  llmProvider: LLMProvider;
  inputText: string;
  additionalContext?: string;
}

export interface AdvancedAnalysisConfig {
  analysisType: AdvancedAnalysisType;
  llmProvider: LLMProvider;
  inputText: string;
  additionalContext?: string;
}

export interface AnalysisResult {
  id: string;
  analysisType: AnalysisType;
  llmProvider: LLMProvider;
  inputText: string;
  additionalContext?: string;
  results: any[];
  status: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface StreamEvent {
  type: 'summary' | 'question' | 'complete' | 'error';
  data: any;
}

export interface DialogueMessage {
  id: string;
  analysisId: string;
  sender: 'user' | 'system';
  message: string;
  createdAt: Date;
}
