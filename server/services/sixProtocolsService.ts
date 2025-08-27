import { LLMService } from './llmService';
import { AnalysisEngine } from './analysisEngine';
import { generateId } from '../utils/idGenerator';

export type ProtocolType = 
  | 'cognitive-normal' 
  | 'cognitive-comprehensive'
  | 'psychological-normal'
  | 'psychological-comprehensive'
  | 'psychopathological-normal'
  | 'psychopathological-comprehensive';

export type LLMProvider = 'zhi1' | 'zhi2' | 'zhi3' | 'zhi4';

export interface SixProtocolRequest {
  protocolType: ProtocolType;
  llmProvider: LLMProvider;
  inputText: string;
  additionalContext?: string;
  selectedChunks?: number[];
  textChunks?: Array<{ index: number; text: string; wordCount: number }>;
}

export interface SixProtocolAnalysis {
  id: string;
  protocolType: ProtocolType;
  llmProvider: LLMProvider;
  text: string;
  additionalContext?: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'error';
  currentPhase?: number;
  phases: SixProtocolPhase[];
  error?: string;
}

export interface SixProtocolPhase {
  phase: number;
  startTime: Date;
  endTime?: Date;
  questions: SixProtocolQuestion[];
  finalScore?: number;
}

export interface SixProtocolQuestion {
  questionId: string;
  question: string;
  answer: string;
  complete: boolean;
}

export class SixProtocolsService {
  private analyses = new Map<string, SixProtocolAnalysis>();
  private llmService: LLMService;
  private analysisEngine: AnalysisEngine;

  constructor() {
    this.llmService = new LLMService();
    this.analysisEngine = new AnalysisEngine();
  }

  async startAnalysis(request: SixProtocolRequest): Promise<{ analysisId: string }> {
    const analysisId = generateId();
    
    const analysis: SixProtocolAnalysis = {
      id: analysisId,
      protocolType: request.protocolType,
      llmProvider: request.llmProvider,
      text: request.inputText,
      additionalContext: request.additionalContext,
      startTime: new Date(),
      status: 'pending',
      phases: []
    };

    this.analyses.set(analysisId, analysis);

    // Start analysis in background
    this.runAnalysis(analysisId).catch(error => {
      console.error('Error in analysis:', error);
      const analysis = this.analyses.get(analysisId);
      if (analysis) {
        analysis.status = 'error';
        analysis.error = error.message;
        analysis.endTime = new Date();
      }
    });

    return { analysisId };
  }

  getAnalysis(analysisId: string): SixProtocolAnalysis | undefined {
    return this.analyses.get(analysisId);
  }

  private async runAnalysis(analysisId: string): Promise<void> {
    const analysis = this.analyses.get(analysisId);
    if (!analysis) throw new Error('Analysis not found');

    analysis.status = 'running';

    try {
      const questions = this.getQuestionsForProtocol(analysis.protocolType);
      const totalPhases = this.getTotalPhases(analysis.protocolType);

      // Run each phase
      for (let phaseNum = 1; phaseNum <= totalPhases; phaseNum++) {
        analysis.currentPhase = phaseNum;
        
        const phase: SixProtocolPhase = {
          phase: phaseNum,
          startTime: new Date(),
          questions: []
        };

        analysis.phases.push(phase);

        // Process questions for this phase
        await this.processPhase(analysis, phase, questions, phaseNum);
        
        phase.endTime = new Date();
      }

      analysis.status = 'completed';
      analysis.endTime = new Date();
      analysis.currentPhase = undefined;

    } catch (error) {
      analysis.status = 'error';
      analysis.error = error instanceof Error ? error.message : 'Unknown error';
      analysis.endTime = new Date();
      throw error;
    }
  }

  private async processPhase(
    analysis: SixProtocolAnalysis, 
    phase: SixProtocolPhase, 
    questions: string[], 
    phaseNum: number
  ): Promise<void> {
    const phaseQuestions = this.getPhaseQuestions(analysis.protocolType, phaseNum, questions);
    const phaseInstructions = this.getPhaseInstructions(analysis.protocolType, phaseNum);

    // Process questions in batches to avoid token limits
    const batchSize = 5;
    for (let i = 0; i < phaseQuestions.length; i += batchSize) {
      const batch = phaseQuestions.slice(i, i + batchSize);
      
      for (const question of batch) {
        const questionId = `${phaseNum}-${phase.questions.length}`;
        
        // Add question to phase immediately
        const protocolQuestion: SixProtocolQuestion = {
          questionId,
          question,
          answer: '',
          complete: false
        };
        
        phase.questions.push(protocolQuestion);

        try {
          const fullPrompt = this.buildPrompt(analysis, question, phaseInstructions, phaseNum);
          const response = await this.llmService.sendMessage(
            analysis.llmProvider,
            fullPrompt
          );
          const answer = response.content;

          // Update the question with the answer
          protocolQuestion.answer = answer;
          protocolQuestion.complete = true;

        } catch (error) {
          protocolQuestion.answer = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          protocolQuestion.complete = true;
        }
      }
    }

    // Extract final score if this is the completion of a phase
    if (phase.questions.length > 0) {
      const lastAnswer = phase.questions[phase.questions.length - 1].answer;
      const scoreMatch = lastAnswer.match(/(?:score|rating)[:\s]*(\d+)\/100/i);
      if (scoreMatch) {
        phase.finalScore = parseInt(scoreMatch[1]);
      }
    }
  }

  private buildPrompt(
    analysis: SixProtocolAnalysis, 
    question: string, 
    phaseInstructions: string,
    phaseNum: number
  ): string {
    let prompt = `${phaseInstructions}\n\n`;
    
    prompt += `Question: ${question}\n\n`;
    prompt += `Text to analyze:\n${analysis.text}\n\n`;
    
    if (analysis.additionalContext) {
      prompt += `Additional context: ${analysis.additionalContext}\n\n`;
    }

    // Add specific scoring instructions
    prompt += this.getScoringInstructions(analysis.protocolType);

    // Add phase-specific instructions
    if (phaseNum > 1) {
      prompt += this.getPhaseSpecificInstructions(analysis.protocolType, phaseNum);
    }

    return prompt;
  }

  private getQuestionsForProtocol(protocolType: ProtocolType): string[] {
    const domain = protocolType.split('-')[0]; // cognitive, psychological, or psychopathological
    
    switch (domain) {
      case 'cognitive':
        return [
          "Is it insightful?",
          "Does it develop points? (Or, if it is a short excerpt, is there evidence that it would develop points if extended)?",
          "Is the organization merely sequential (just one point after another, little or no logical scaffolding)? Or are the ideas arranged, not just sequentially but hierarchically?",
          "If the points it makes are not insightful, does it operate skillfully with canons of logic/reasoning?",
          "Are the points cliches? Or are they 'fresh'?",
          "Does it use technical jargon to obfuscate or to render more precise?",
          "Is it organic? Do points develop in an organic, natural way? Do they 'unfold'? Or are they forced and artificial?",
          "Does it open up new domains? Or, on the contrary, does it shut off inquiry (by conditionalizing further discussion of the matters on acceptance of its internal and possibly very faulty logic)?",
          "Is it actually intelligent or just the work of somebody who, judging by the subject-matter, is presumed to be intelligent (but may not be)?",
          "Is it real or is it phony?",
          "Do the sentences exhibit complex and coherent internal logic?",
          "Is the passage governed by a strong concept? Or is the only organization driven purely by expository (as opposed to epistemic) norms?",
          "Is there system-level control over ideas? In other words, does the author seem to recall what he said earlier and to be in a position to integrate it into points he has made since then?",
          "Are the points 'real'? Are they fresh? Or is some institution or some accepted vein of propaganda or orthodoxy just using the author as a mouth piece?",
          "Is the writing evasive or direct?",
          "Are the statements ambiguous?",
          "Does the progression of the text develop according to who said what or according to what entails or confirms what?",
          "Does the author use other authors to develop his ideas or to cloak his own lack of ideas?"
        ];
      
      case 'psychological':
        return [
          "Does the text reveal a stable, coherent self-concept, or is the self fragmented/contradictory?",
          "Is there evidence of ego strength (resilience, capacity to tolerate conflict/ambiguity), or does the psyche rely on brittle defenses?",
          "Are defenses primarily mature (sublimation, humor, anticipation), neurotic (intellectualization, repression), or primitive (splitting, denial, projection)?",
          "Does the writing show integration of affect and thought, or are emotions split off / overly intellectualized?",
          "Is the author's stance defensive/avoidant or direct/engaged?",
          "Does the psyche appear narcissistically organized (grandiosity, fragile self-esteem, hunger for validation), or not?",
          "Are desires/drives expressed openly, displaced, or repressed?",
          "Does the voice suggest internal conflict (superego vs. id, competing identifications), or monolithic certainty?",
          "Is there evidence of object constancy (capacity to sustain nuanced view of others) or splitting (others seen as all-good/all-bad)?",
          "Is aggression integrated (channeled productively) or dissociated/projected?",
          "Is the author capable of irony/self-reflection, or trapped in compulsive earnestness / defensiveness?",
          "Does the text suggest psychological growth potential (openness, curiosity, capacity to metabolize experience) or rigidity?",
          "Is the discourse paranoid / persecutory (others as threats, conspiracies) or reality-based?",
          "Does the tone reflect authentic engagement with reality, or phony simulation of depth?",
          "Is the psyche resilient under stress, or fragile / evasive?",
          "Is there evidence of compulsion or repetition (obsessional returns to the same themes), or flexible progression?",
          "Does the author show capacity for intimacy / genuine connection, or only instrumental/defended relations?",
          "Is shame/guilt worked through constructively or disavowed/projected?"
        ];
      
      case 'psychopathological':
        return [
          "Does the text reveal distorted reality testing (delusion, paranoia, magical thinking), or intact contact with reality?",
          "Is there evidence of persecutory ideation (seeing threats/conspiracies) or is perception proportionate?",
          "Does the subject show rigid obsessional patterns (compulsion, repetitive fixation) vs. flexible thought?",
          "Are there signs of narcissistic pathology (grandiosity, exploitation, lack of empathy), or balanced self-other relation?",
          "Is aggression expressed as sadism, cruelty, destructive glee, or is it integrated/controlled?",
          "Is affect regulation stable or does it suggest lability, rage, despair, manic flight?",
          "Does the person exhibit emptiness, hollowness, anhedonia, or a capacity for meaning/connection?",
          "Is there evidence of identity diffusion (incoherence, role-shifting, lack of stable self)?",
          "Are interpersonal patterns exploitative/manipulative or reciprocal/genuine?",
          "Does the psyche lean toward psychotic organization (loss of boundaries, hallucination-like claims), borderline organization (splitting, fear of abandonment), or neurotic organization (anxiety, repression)?",
          "Are defenses predominantly primitive (denial, projection, splitting) or higher-level?",
          "Is there evidence of pathological lying, phoniness, simulation, or authentic communication?",
          "Does the discourse exhibit compulsive hostility toward norms/authorities (paranoid defiance) or measured critique?",
          "Is sexuality integrated or perverse/displaced (voyeurism, exhibitionism, compulsive control)?",
          "Is the overall presentation coherent and reality-based or chaotic, persecutory, hollow, performative?"
        ];
      
      default:
        throw new Error(`Unknown protocol domain: ${domain}`);
    }
  }

  private getTotalPhases(protocolType: ProtocolType): number {
    return protocolType.includes('comprehensive') ? 4 : 1;
  }

  private getPhaseQuestions(protocolType: ProtocolType, phaseNum: number, questions: string[]): string[] {
    if (phaseNum === 1) {
      return questions;
    }
    
    // For phases 2-4, we re-ask the same questions but with different context
    return questions;
  }

  private getPhaseInstructions(protocolType: ProtocolType, phaseNum: number): string {
    const domain = protocolType.split('-')[0];
    
    const baseInstructions = `Answer these questions in connection with this text.

Also give a score out of 100.

A score of N/100 means (100–N)/100 outperform the subject with respect to the parameter defined by the question.

You are not grading. You are answering questions.`;

    const domainSpecific = this.getDomainSpecificInstructions(domain);
    
    if (phaseNum === 1) {
      return baseInstructions + '\n\n' + domainSpecific;
    }
    
    // Add phase-specific instructions for comprehensive mode
    const phaseSpecific = this.getPhaseSpecificContent(phaseNum);
    return baseInstructions + '\n\n' + domainSpecific + '\n\n' + phaseSpecific;
  }

  private getDomainSpecificInstructions(domain: string): string {
    switch (domain) {
      case 'cognitive':
        return `Do not default to cookbook, midwit evaluation protocols. 
Do not give credit merely for use of jargon or for referencing authorities. Focus on substance. Only give points for scholarly references/jargon if they unambiguously increase substance.
This is not a grading app. Do not penalize boldness. Do not take points away for insights that, if correct, stand on their own.
Summarize the text and categorize it.
Evaluate with respect to the general population, not with respect only to advanced scholarly works.`;
      
      case 'psychological':
        return `Do not default to diagnostic checklists; describe configuration of psyche.
Do not conflate verbal confidence with psychological strength.
Summarize the text and categorize the psychological presentation (e.g., narcissistic, depressive, obsessional, resilient, fragmented).
Evaluate relative to the general population, not only "advanced" or "pathological" groups.
Do not penalize honesty, boldness, or extreme statements if they indicate integration rather than breakdown.`;
      
      case 'psychopathological':
        return `You are not diagnosing. You are describing the degree of psychopathology revealed.
Summarize the text and categorize the presentation (e.g., neurotic, borderline, psychotic, narcissistic, obsessional).
Do not give credit for rhetorical surface (confidence, erudition). Focus on reality testing, defenses, affect, and interpersonal stance.
Evaluate relative to the general population, not just clinical populations.
Do not penalize intense but integrated thought — pathology is disorganization, not extremity.`;
      
      default:
        return '';
    }
  }

  private getPhaseSpecificContent(phaseNum: number): string {
    switch (phaseNum) {
      case 2:
        return `PUSHBACK PROTOCOL: If score < 95/100, restate: Your position is that (100–N)/100 outperform the author in this respect. Are you sure? Require articulation: What concrete strengths do those outperformers have that this author lacks? Re-ask questions de novo.`;
      
      case 3:
        return `WALMART METRIC ENFORCEMENT: If you claim 20/100 Walmart patrons outperform this author, provide concrete examples of how. If you can't, revise.`;
      
      case 4:
        return `FINAL VALIDATION: Confirm before finalizing: Was the subject penalized for unconventional affect or honesty? If yes → recalibrate. Does the score reflect authentic capacity, not mere social compliance? Is the Walmart metric grounded in specific superiority, not vague hand-waving?`;
      
      default:
        return '';
    }
  }

  private getPhaseSpecificInstructions(protocolType: ProtocolType, phaseNum: number): string {
    const domain = protocolType.split('-')[0];
    
    if (phaseNum === 2) {
      return `\n\nSNIPER AMENDMENT: ${domain === 'cognitive' ? 'Insight is a sniper shot, not a town hall' : domain === 'psychological' ? 'Depth is a sniper shot, not a group therapy session' : 'Pathology is not a matter of being "different"'}. If the text reveals something true but unpopular, penalizing it for lacking 'balance' is midwit bias.`;
    }
    
    return '';
  }

  private getScoringInstructions(protocolType: ProtocolType): string {
    const domain = protocolType.split('-')[0];
    
    const baseScoring = `\n\nSCORING SCALE:\n95–100 = exceptional, unignorable\n80–94 = strong but with observable limitations\n<80 = mediocrity or clear deficits`;
    
    switch (domain) {
      case 'cognitive':
        return baseScoring + `\n\nYou do not use a risk-averse standard; you do not attempt to be diplomatic; you do not attempt to comply with risk-averse, medium-range IQ, academic norms. If a work is a work of genius, you say that, and you say why.`;
      
      case 'psychological':
        return baseScoring + `\n\nEvaluate authentic engagement and psychological integration, not social compliance.`;
      
      case 'psychopathological':
        return baseScoring + `\n\nPathology = distortion + dysfunction, not extremity of thought.`;
      
      default:
        return baseScoring;
    }
  }

  // Method to get active analyses for SSE streaming
  getActiveAnalyses(): Map<string, SixProtocolAnalysis> {
    return this.analyses;
  }
}