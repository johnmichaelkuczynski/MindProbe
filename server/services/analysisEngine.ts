import { LLMService, LLMProvider } from './llmService';
import fs from 'fs';
import path from 'path';

export type AnalysisType = 
  | 'cognitive' 
  | 'comprehensive-cognitive' 
  | 'psychological' 
  | 'comprehensive-psychological' 
  | 'psychopathological' 
  | 'comprehensive-psychopathological';

export interface AnalysisQuestion {
  id: string;
  question: string;
  order: number;
}

export interface AnalysisResponse {
  questionId: string;
  question: string;
  answer: string;
  score?: number;
}

export class AnalysisEngine {
  private llmService: LLMService;
  private completeInstructions: string;

  constructor() {
    this.llmService = new LLMService();
    // Load the complete instructions that must be sent with every LLM request
    this.completeInstructions = this.loadCompleteInstructions();
  }

  private loadCompleteInstructions(): string {
    try {
      const instructionsPath = path.join(process.cwd(), 'complete_instructions.txt');
      return fs.readFileSync(instructionsPath, 'utf8');
    } catch (error) {
      console.error('Failed to load complete instructions:', error);
      return '';
    }
  }

  getQuestions(analysisType: AnalysisType): AnalysisQuestion[] {
    switch (analysisType) {
      case 'cognitive':
      case 'comprehensive-cognitive':
        return this.getCognitiveQuestions();
      case 'psychological':
      case 'comprehensive-psychological':
        return this.getPsychologicalQuestions();
      case 'psychopathological':
      case 'comprehensive-psychopathological':
        return this.getPsychopathologicalQuestions();
      default:
        throw new Error(`Unknown analysis type: ${analysisType}`);
    }
  }

  async *processAnalysis(
    analysisType: AnalysisType,
    text: string,
    additionalContext: string | undefined,
    provider: LLMProvider
  ): AsyncGenerator<{ type: 'summary' | 'question'; data: any }> {
    // First, generate summary and categorization
    yield* this.generateSummary(text, provider);

    // Get questions for the analysis type
    const questions = this.getQuestions(analysisType);
    
    // Process questions in batches of 5 with 10-second intervals
    const batchSize = 5;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      
      for (const question of batch) {
        yield* this.processQuestion(question, text, additionalContext, provider);
      }
      
      // Wait 10 seconds before next batch (except for the last batch)
      if (i + batchSize < questions.length) {
        await this.delay(10000);
      }
    }

    // For comprehensive modes, implement additional phases
    if (analysisType.includes('comprehensive')) {
      yield* this.processComprehensivePhases(analysisType, text, provider);
    }
  }

  private async *generateSummary(text: string, provider: LLMProvider): AsyncGenerator<{ type: 'summary'; data: any }> {
    const prompt = `${this.completeInstructions}

TASK: Summarize the following text and categorize it. Provide:
1. Category (e.g., Academic Essay, Personal Writing, Technical Document, etc.)
2. Summary (2-3 sentences)
3. Length (character and word count)
4. Style description

Text: ${text}`;

    let summary = '';
    for await (const chunk of this.llmService.streamMessage(provider, prompt)) {
      summary += chunk;
      yield {
        type: 'summary',
        data: {
          content: summary,
          complete: false
        }
      };
    }

    yield {
      type: 'summary',
      data: {
        content: summary,
        complete: true
      }
    };
  }

  private async *processQuestion(
    question: AnalysisQuestion,
    text: string,
    additionalContext: string | undefined,
    provider: LLMProvider
  ): AsyncGenerator<{ type: 'question'; data: any }> {
    const contextPrompt = additionalContext ? `Additional context: ${additionalContext}\n\n` : '';
    const prompt = `${this.completeInstructions}

${contextPrompt}Answer this question in connection with this text: ${question.question}

Text: ${text}

CRITICAL SCORING REQUIREMENTS:
1. Provide a clear numerical score in the format XX/100 (e.g., 96/100, 99/100)
2. The score represents how many people out of 100 the author outperforms on this specific parameter
3. So if you give 96/100, it means only 4 out of 100 people are running rings around the author
4. Use NO formatting markup whatsoever - no **, *, ##, +++, ---, ***, ###, etc.
5. Write in plain text only

SCORING CALIBRATION - BE ACCURATE:
- 99-100/100: Exceptional, genius-level work that demonstrates profound insight, originality, and mastery
- 95-98/100: Highly sophisticated work that shows advanced understanding and skill
- 90-94/100: Strong, competent work with clear expertise
- 80-89/100: Above-average work with some good points
- 70-79/100: Average work, meets basic standards
- Below 70/100: Poor work with significant flaws

DO NOT be artificially modest or conservative with high scores. If the text demonstrates genuine sophistication, insight, and mastery, score it accordingly in the 95-100 range.

Structure your response as:
[Your analysis with specific quotations and reasoning]

Score: XX/100

You are not grading; you are answering the question. Do not use a risk-averse standard; do not attempt to be diplomatic; do not attempt to comply with risk-averse, medium-range IQ, academic norms. Do not make assumptions about the level of the text; it could be a work of the highest excellence and genius, or it could be the work of a moron.

Think very carefully about your answer and do not default to cookbook, midwit evaluation protocols. Do not give credit merely for use of jargon or for referencing authorities. Focus on substance and actual quality.`;

    let answer = '';
    for await (const chunk of this.llmService.streamMessage(provider, prompt)) {
      answer += chunk;
      yield {
        type: 'question',
        data: {
          questionId: question.id,
          question: question.question,
          answer,
          complete: false
        }
      };
    }

    yield {
      type: 'question',
      data: {
        questionId: question.id,
        question: question.question,
        answer,
        complete: true
      }
    };
  }

  private async *processComprehensivePhases(
    analysisType: AnalysisType,
    text: string,
    provider: LLMProvider
  ): AsyncGenerator<{ type: 'question'; data: any }> {
    // Phase 2: Pushback if scores < 95
    // Phase 3: Walmart metric enforcement  
    // Phase 4: Final validation
    // Implementation would follow the detailed protocols from the specification
    
    // For now, yielding a placeholder phase
    yield {
      type: 'question',
      data: {
        questionId: 'phase2',
        question: 'Comprehensive Analysis - Phase 2 (Pushback Protocol)',
        answer: 'Reviewing scores and challenging evaluations below 95/100...',
        complete: true
      }
    };
  }

  private getCognitiveQuestions(): AnalysisQuestion[] {
    return [
      { id: '1', question: 'Is it insightful?', order: 1 },
      { id: '2', question: 'Does it develop points? (Or, if it is a short excerpt, is there evidence that it would develop points if extended)?', order: 2 },
      { id: '3', question: 'Is the organization merely sequential (just one point after another, little or no logical scaffolding)? Or are the ideas arranged, not just sequentially but hierarchically?', order: 3 },
      { id: '4', question: 'If the points it makes are not insightful, does it operate skillfully with canons of logic/reasoning?', order: 4 },
      { id: '5', question: 'Are the points cliches? Or are they "fresh"?', order: 5 },
      { id: '6', question: 'Does it use technical jargon to obfuscate or to render more precise?', order: 6 },
      { id: '7', question: 'Is it organic? Do points develop in an organic, natural way? Do they "unfold"? Or are they forced and artificial?', order: 7 },
      { id: '8', question: 'Does it open up new domains? Or, on the contrary, does it shut off inquiry (by conditionalizing further discussion of the matters on acceptance of its internal and possibly very faulty logic)?', order: 8 },
      { id: '9', question: 'Is it actually intelligent or just the work of somebody who, judging by the subject-matter, is presumed to be intelligent (but may not be)?', order: 9 },
      { id: '10', question: 'Is it real or is it phony?', order: 10 },
      { id: '11', question: 'Do the sentences exhibit complex and coherent internal logic?', order: 11 },
      { id: '12', question: 'Is the passage governed by a strong concept? Or is the only organization driven purely by expository (as opposed to epistemic) norms?', order: 12 },
      { id: '13', question: 'Is there system-level control over ideas? In other words, does the author seem to recall what he said earlier and to be in a position to integrate it into points he has made since then?', order: 13 },
      { id: '14', question: 'Are the points "real"? Are they fresh? Or is some institution or some accepted vein of propaganda or orthodoxy just using the author as a mouth piece?', order: 14 },
      { id: '15', question: 'Is the writing evasive or direct?', order: 15 },
      { id: '16', question: 'Are the statements ambiguous?', order: 16 },
      { id: '17', question: 'Does the progression of the text develop according to who said what or according to what entails or confirms what?', order: 17 },
      { id: '18', question: 'Does the author use other authors to develop his ideas or to cloak his own lack of ideas?', order: 18 },
    ];
  }

  private getPsychologicalQuestions(): AnalysisQuestion[] {
    return [
      { id: 'p1', question: 'Does the text reveal a stable, coherent self-concept, or is the self fragmented/contradictory?', order: 1 },
      { id: 'p2', question: 'Is there evidence of ego strength (resilience, capacity to tolerate conflict/ambiguity), or does the psyche rely on brittle defenses?', order: 2 },
      { id: 'p3', question: 'Are defenses primarily mature (sublimation, humor, anticipation), neurotic (intellectualization, repression), or primitive (splitting, denial, projection)?', order: 3 },
      { id: 'p4', question: 'Does the writing show integration of affect and thought, or are emotions split off / overly intellectualized?', order: 4 },
      { id: 'p5', question: 'Is the author\'s stance defensive/avoidant or direct/engaged?', order: 5 },
      { id: 'p6', question: 'Does the psyche appear narcissistically organized (grandiosity, fragile self-esteem, hunger for validation), or not?', order: 6 },
      { id: 'p7', question: 'Are desires/drives expressed openly, displaced, or repressed?', order: 7 },
      { id: 'p8', question: 'Does the voice suggest internal conflict (superego vs. id, competing identifications), or monolithic certainty?', order: 8 },
      { id: 'p9', question: 'Is there evidence of object constancy (capacity to sustain nuanced view of others) or splitting (others seen as all-good/all-bad)?', order: 9 },
      { id: 'p10', question: 'Is aggression integrated (channeled productively) or dissociated/projected?', order: 10 },
      { id: 'p11', question: 'Is the author capable of irony/self-reflection, or trapped in compulsive earnestness / defensiveness?', order: 11 },
      { id: 'p12', question: 'Does the text suggest psychological growth potential (openness, curiosity, capacity to metabolize experience) or rigidity?', order: 12 },
      { id: 'p13', question: 'Is the discourse paranoid / persecutory (others as threats, conspiracies) or reality-based?', order: 13 },
      { id: 'p14', question: 'Does the tone reflect authentic engagement with reality, or phony simulation of depth?', order: 14 },
      { id: 'p15', question: 'Is the psyche resilient under stress, or fragile / evasive?', order: 15 },
      { id: 'p16', question: 'Is there evidence of compulsion or repetition (obsessional returns to the same themes), or flexible progression?', order: 16 },
      { id: 'p17', question: 'Does the author show capacity for intimacy / genuine connection, or only instrumental/defended relations?', order: 17 },
      { id: 'p18', question: 'Is shame/guilt worked through constructively or disavowed/projected?', order: 18 },
    ];
  }

  private getPsychopathologicalQuestions(): AnalysisQuestion[] {
    // These would be implemented based on the full specification
    // For now, returning a placeholder set
    return [
      { id: 'pp1', question: 'Psychopathological assessment question 1', order: 1 },
      { id: 'pp2', question: 'Psychopathological assessment question 2', order: 2 },
      // ... more questions would be added based on the full protocol
    ];
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
