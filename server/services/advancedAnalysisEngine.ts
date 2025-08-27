import { LLMService } from './llmService';
import { TextChunker, type TextChunk } from './textChunker';
import type { AdvancedAnalysisType } from '../../client/src/types/analysis';

export interface AdvancedAnalysisQuestion {
  id: string;
  question: string;
  category: string;
}

export interface AdvancedPhaseResult {
  phase: number;
  questions: AdvancedAnalysisQuestion[];
  responses: any[];
  summary?: string;
  finalScore?: number;
  chunked?: boolean;
  chunkCount?: number;
}

export class AdvancedAnalysisEngine {
  private llmService: LLMService;

  constructor() {
    this.llmService = new LLMService();
  }

  // Advanced Cognitive Questions - Based on your protocol
  private getAdvancedCognitiveQuestions(): AdvancedAnalysisQuestion[] {
    return [
      { id: "cog1", question: "Is it insightful?", category: "insight" },
      { id: "cog2", question: "Does it develop points? (Or, if it is a short excerpt, is there evidence that it would develop points if extended)?", category: "development" },
      { id: "cog3", question: "Is the organization merely sequential (just one point after another, little or no logical scaffolding)? Or are the ideas arranged, not just sequentially but hierarchically?", category: "organization" },
      { id: "cog4", question: "If the points it makes are not insightful, does it operate skillfully with canons of logic/reasoning?", category: "logic" },
      { id: "cog5", question: "Are the points cliches? Or are they 'fresh'?", category: "originality" },
      { id: "cog6", question: "Does it use technical jargon to obfuscate or to render more precise?", category: "precision" },
      { id: "cog7", question: "Is it organic? Do points develop in an organic, natural way? Do they 'unfold'? Or are they forced and artificial?", category: "organic" },
      { id: "cog8", question: "Does it open up new domains? Or, on the contrary, does it shut off inquiry (by conditionalizing further discussion of the matters on acceptance of its internal and possibly very faulty logic)?", category: "inquiry" },
      { id: "cog9", question: "Is it actually intelligent or just the work of somebody who, judging by the subject-matter, is presumed to be intelligent (but may not be)?", category: "authenticity" },
      { id: "cog10", question: "Is it real or is it phony?", category: "genuine" },
      { id: "cog11", question: "Do the sentences exhibit complex and coherent internal logic?", category: "coherence" },
      { id: "cog12", question: "Is the passage governed by a strong concept? Or is the only organization driven purely by expository (as opposed to epistemic) norms?", category: "conceptual" },
      { id: "cog13", question: "Is there system-level control over ideas? In other words, does the author seem to recall what he said earlier and to be in a position to integrate it into points he has made since then?", category: "integration" },
      { id: "cog14", question: "Are the points 'real'? Are they fresh? Or is some institution or some accepted vein of propaganda or orthodoxy just using the author as a mouth piece?", category: "independence" },
      { id: "cog15", question: "Is the writing evasive or direct?", category: "directness" },
      { id: "cog16", question: "Are the statements ambiguous?", category: "clarity" },
      { id: "cog17", question: "Does the progression of the text develop according to who said what or according to what entails or confirms what?", category: "progression" },
      { id: "cog18", question: "Does the author use other authors to develop his ideas or to cloak his own lack of ideas?", category: "authority" }
    ];
  }

  // Advanced Psychological Questions - Updated per modified protocol
  private getAdvancedPsychologicalQuestions(): AdvancedAnalysisQuestion[] {
    return [
      { id: "psy1", question: "Does the text reveal a stable, coherent self-concept, or is the self fragmented/contradictory?", category: "self_concept" },
      { id: "psy2", question: "Is there evidence of ego strength (resilience, capacity to tolerate conflict/ambiguity), or does the psyche rely on brittle defenses?", category: "ego_strength" },
      { id: "psy3", question: "Are defenses primarily mature (sublimation, humor, anticipation), neurotic (intellectualization, repression), or primitive (splitting, denial, projection)?", category: "defenses" },
      { id: "psy4", question: "Does the writing show integration of affect and thought, or are emotions split off / overly intellectualized?", category: "affect_integration" },
      { id: "psy5", question: "Is the author's stance defensive/avoidant or direct/engaged?", category: "stance" },
      { id: "psy6", question: "Does the psyche appear narcissistically organized (grandiosity, fragile self-esteem, hunger for validation), or not?", category: "narcissism" },
      { id: "psy7", question: "Are desires/drives expressed openly, displaced, or repressed?", category: "drives" },
      { id: "psy8", question: "Does the voice suggest internal conflict (superego vs. id, competing identifications), or monolithic certainty?", category: "internal_conflict" },
      { id: "psy9", question: "Is there evidence of object constancy (capacity to sustain nuanced view of others) or splitting (others seen as all-good/all-bad)?", category: "object_relations" },
      { id: "psy10", question: "Is aggression integrated (channeled productively) or dissociated/projected?", category: "aggression" },
      { id: "psy11", question: "Is the author capable of irony/self-reflection, or trapped in compulsive earnestness / defensiveness?", category: "self_reflection" },
      { id: "psy12", question: "Does the text suggest psychological growth potential (openness, curiosity, capacity to metabolize experience) or rigidity?", category: "growth_potential" },
      { id: "psy13", question: "Is the discourse paranoid / persecutory (others as threats, conspiracies) or reality-based?", category: "paranoid_ideation" },
      { id: "psy14", question: "Does the tone reflect authentic engagement with reality, or phony simulation of depth?", category: "authenticity" },
      { id: "psy15", question: "Is the psyche resilient under stress, or fragile / evasive?", category: "resilience" },
      { id: "psy16", question: "Is there evidence of compulsion or repetition (obsessional returns to the same themes), or flexible progression?", category: "compulsion" },
      { id: "psy17", question: "Does the author show capacity for intimacy / genuine connection, or only instrumental/defended relations?", category: "intimacy" },
      { id: "psy18", question: "Is shame/guilt worked through constructively or disavowed/projected?", category: "shame_guilt" }
    ];
  }

  // Advanced Psychopathological Questions - Based on your protocol
  private getAdvancedPsychopathologicalQuestions(): AdvancedAnalysisQuestion[] {
    return [
      { id: "path1", question: "Does the text reveal distorted reality testing (delusion, paranoia, magical thinking), or intact contact with reality?", category: "reality_testing" },
      { id: "path2", question: "Is there evidence of persecutory ideation (seeing threats/conspiracies) or is perception proportionate?", category: "persecutory_ideation" },
      { id: "path3", question: "Does the subject show rigid obsessional patterns (compulsion, repetitive fixation) vs. flexible thought?", category: "obsessional_patterns" },
      { id: "path4", question: "Are there signs of narcissistic pathology (grandiosity, exploitation, lack of empathy), or balanced self-other relation?", category: "narcissistic_pathology" },
      { id: "path5", question: "Is aggression expressed as sadism, cruelty, destructive glee, or is it integrated/controlled?", category: "aggressive_pathology" },
      { id: "path6", question: "Is affect regulation stable or does it suggest lability, rage, despair, manic flight?", category: "affect_regulation" },
      { id: "path7", question: "Does the person exhibit emptiness, hollowness, anhedonia, or a capacity for meaning/connection?", category: "emptiness" },
      { id: "path8", question: "Is there evidence of identity diffusion (incoherence, role-shifting, lack of stable self)?", category: "identity_diffusion" },
      { id: "path9", question: "Are interpersonal patterns exploitative/manipulative or reciprocal/genuine?", category: "interpersonal_pathology" },
      { id: "path10", question: "Does the psyche lean toward psychotic organization (loss of boundaries, hallucination-like claims), borderline organization (splitting, fear of abandonment), or neurotic organization (anxiety, repression)?", category: "personality_organization" },
      { id: "path11", question: "Are defenses predominantly primitive (denial, projection, splitting) or higher-level?", category: "defense_level" },
      { id: "path12", question: "Is there evidence of pathological lying, phoniness, simulation, or authentic communication?", category: "pathological_lying" },
      { id: "path13", question: "Does the discourse exhibit compulsive hostility toward norms/authorities (paranoid defiance) or measured critique?", category: "authority_hostility" },
      { id: "path14", question: "Is sexuality integrated or perverse/displaced (voyeurism, exhibitionism, compulsive control)?", category: "sexuality" },
      { id: "path15", question: "Is the overall presentation coherent and reality-based or chaotic, persecutory, hollow, performative?", category: "overall_coherence" }
    ];
  }

  private getQuestionsForType(analysisType: AdvancedAnalysisType): AdvancedAnalysisQuestion[] {
    if (analysisType.includes('cognitive')) {
      return this.getAdvancedCognitiveQuestions();
    } else if (analysisType.includes('psychological') && !analysisType.includes('psychopathological')) {
      return this.getAdvancedPsychologicalQuestions();
    } else if (analysisType.includes('psychopathological')) {
      return this.getAdvancedPsychopathologicalQuestions();
    }
    return [];
  }

  private buildPhase1Prompt(analysisType: AdvancedAnalysisType, inputText: string, questions: AdvancedAnalysisQuestion[]): string {
    const questionsList = questions.map(q => q.question).join('\n');
    
    let categoryInstructions = '';
    if (analysisType.includes('cognitive')) {
      categoryInstructions = `
Do not give credit merely for use of jargon or for referencing authorities. Focus on substance. Only give points for scholarly references/jargon if they unambiguously increase substance.

You do not use a risk-averse standard; you do not attempt to be diplomatic; you do not attempt to comply with risk-averse, medium-range IQ, academic norms. You do not make assumptions about the level of the paper; it could be a work of the highest excellence and genius, or it could be the work of a moron.

If a work is a work of genius, you say that, and you say why; you do not shy away from giving what might conventionally be regarded as excessively "superlative" scores; you give it the score it deserves, not the score that a midwit committee would say it deserves.

This is not a grading app. You are grading the intelligence of what you are given. If you are given brilliant fragment, you give it a high score. You are not grading essays. You are not looking for completeness. You tell the LLM not to 'grade'; their job is to answer the questions, period, and to do so on the basis of the text given, making zero assumptions about whether it is complete or incomplete.

Do not overvalue turns of phrase. An author speaking confidently is not necessarily "shutting down modes of inquiry". In fact, it is likely to be the opposite; by putting a clear stake in the ground, he is probably opening them. Casual speech does not mean disorganized thoughts. Don't judge a book by its cover.

Do not penalize boldness. Do not take points away for insights that, if correct, stand on their own. Get rid of the idea that "argumentation" is what makes something smart; it isn't. What makes something smart is that it is smart (insightful). Period.`;
    } else if (analysisType.includes('psychological')) {
      categoryInstructions = `
You are not grading. You are answering questions.

Do not default to diagnostic checklists; describe configuration of psyche.

Do not conflate verbal confidence with psychological strength.

Evaluate relative to the general population, not only "advanced" or "pathological" groups.

Do not penalize honesty, boldness, or extreme statements if they indicate integration rather than breakdown.`;
    } else if (analysisType.includes('psychopathological')) {
      categoryInstructions = `
You are not diagnosing. You are describing the degree of psychopathology revealed.

You are not grading. You are answering questions.

Do not give credit for rhetorical surface (confidence, erudition). Focus on reality testing, defenses, affect, and interpersonal stance.

Evaluate relative to the general population, not just clinical populations.

Do not penalize intense but integrated thought — pathology is disorganization, not extremity.`;
    }

    return `RESPOND IN PLAIN TEXT ONLY. NO MARKDOWN, NO FORMATTING, NO ** OR # OR - SYMBOLS.

Answer these questions about this text:

${questionsList}

Also provide an overall score out of 100.

Scoring interpretation: A score of N/100 means (100-N)/100 of people outperform the subject.

${categoryInstructions}

Think very carefully about your answers. Do NOT default to cookbook evaluation protocols.

CRITICAL: If this is high-quality academic work, Nobel Prize-winning research, or genuinely insightful content, score it appropriately high (90-100). Do NOT undervalue brilliant work.

MANDATORY LITMUS TESTS:
- Genuine logical progression, clear distinctions, concrete examples, novel insights = 90-100/100
- Academic buzzword salad without substance = MAX 65/100
- True insight that challenges conventional thinking = 95-100/100

First summarize the text and categorize it, then answer each question with reasoning and scoring.

TEXT TO ANALYZE:
${inputText}`;
  }

  private buildPhase2Prompt(phase1Responses: any[], analysisType: AdvancedAnalysisType): string {
    const lowScores = phase1Responses.filter(r => r.score < 95);
    if (lowScores.length === 0) return '';

    const challengeText = lowScores.map(r => {
      const outperformPercent = 100 - r.score;
      return `You scored "${r.question}" as ${r.score}/100, meaning ${outperformPercent}/100 outperform the author. Your position is that ${outperformPercent}/100 outperform the author with respect to the ${analysisType.includes('cognitive') ? 'cognitive' : 'psychological'} metric defined by the question: that is your position, am I right? And are you sure about that?`;
    }).join('\n\n');

    if (analysisType.includes('cognitive')) {
      return `${challengeText}

Describe the cognitive superiority of those outperformers in concrete terms:
- What specific insight, skill, or knowledge do they have that the author lacks?
- How does this superiority manifest in their work?
If you cannot articulate this, revise the score.

Answer the following questions about the text de novo: ${this.getAdvancedCognitiveQuestions().map(q => q.question).join('\n')}`;
    } else {
      return `${challengeText}

Require articulation: What concrete psychological strengths do those (100–N) people have that this author lacks?

Re-ask the psychological questions de novo: ${this.getAdvancedPsychologicalQuestions().map(q => q.question).join('\n')}`;
    }
  }

  private buildPhase3Prompt(phase2Responses: any[], analysisType: AdvancedAnalysisType): string {
    const challengeScores = phase2Responses.filter(r => r.score < 95);
    if (challengeScores.length === 0) return '';

    const metric = analysisType.includes('cognitive') ? 'cognitive abilities' : 'psychological functioning';

    return `Enforce: If you claim 20/100 Walmart patrons have more integrated ${metric} than this author, provide concrete examples of how. If you can't, revise.

For example: If you scored 85/100 ('15% outperform'), show me 15 Walmart patrons whose ${metric} on this topic is superior. If you can't, the score is wrong.

Are your numerical scores consistent with the fact that those are to be taken to mean that (100-N) people out of 100 outperform the author in the relevant respect? So if a score of 91/100 is awarded, that means that 9/100 people in Walmart are running rings around this person.`;
  }

  private buildPhase4Prompt(analysisType: AdvancedAnalysisType): string {
    if (analysisType.includes('cognitive')) {
      return `Before finalizing scores, confirm:

1. Have you penalized the text for not being conventional? If yes, recalibrate.
2. Does the score reflect truth density, not compliance with norms?
3. Is the Walmart metric empirically grounded or a lazy guess?
4. Was the subject penalized for unconventional affect or honesty? If yes → recalibrate.
5. Does the score reflect actual insight, not mere social compliance?

Provide your final analysis and scores.`;
    } else {
      return `Confirm before finalizing:

1. Was the subject penalized for unconventional affect or honesty? If yes → recalibrate.
2. Does the score reflect ego integration and authenticity, not mere social compliance?
3. Is the Walmart metric grounded in specific psychological superiority, not vague hand-waving?
4. Ensure no penalizing of unconventional personalities (e.g., depressive honesty, ironic self-awareness).
5. Reconfirm Walmart metric is empirically grounded.

Provide your final analysis and scores.`;
    }
  }

  async processAdvancedAnalysis(
    analysisType: AdvancedAnalysisType,
    llmProvider: string,
    inputText: string,
    additionalContext?: string,
    onProgress?: (event: any) => void
  ): Promise<AdvancedPhaseResult[]> {
    const questions = this.getQuestionsForType(analysisType);
    const isLongMode = analysisType.endsWith('-long');
    const results: AdvancedPhaseResult[] = [];

    try {
      // Check if text needs chunking
      const needsChunking = TextChunker.needsChunking(inputText);
      let chunks: TextChunk[] = [];
      
      if (needsChunking) {
        chunks = TextChunker.chunkText(inputText);
        onProgress?.({ type: 'info', data: { 
          message: `Text chunked into ${chunks.length} segments (${TextChunker.getWordCount(inputText)} words total)` 
        }});
      }

      // Phase 1
      onProgress?.({ type: 'phase', data: { phase: 1, message: 'Starting Phase 1 analysis...' } });
      
      let phase1Content = '';
      
      if (needsChunking) {
        // Process each chunk
        const chunkResults = [];
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          onProgress?.({ type: 'chunk_progress', data: { 
            chunk: i + 1, 
            total: chunks.length, 
            message: `Analyzing chunk ${i + 1}/${chunks.length}...` 
          }});
          
          const chunkPrompt = this.buildPhase1Prompt(analysisType, chunk.text, questions);
          const chunkResponse = await this.llmService.sendMessage(llmProvider as any, chunkPrompt);
          
          chunkResults.push({
            chunkIndex: i,
            content: chunkResponse.content,
            wordCount: chunk.wordCount
          });
        }
        
        // Combine chunk results
        const combinedResult = TextChunker.combineChunkResults(chunkResults);
        phase1Content = typeof combinedResult === 'string' ? combinedResult : combinedResult.summary || JSON.stringify(combinedResult, null, 2);
        
      } else {
        // Single text analysis
        const phase1Prompt = this.buildPhase1Prompt(analysisType, inputText, questions);
        const phase1Response = await this.llmService.sendMessage(llmProvider as any, phase1Prompt);
        phase1Content = phase1Response.content;
      }
      
      // Clean markdown from response
      const cleanContent = phase1Content.replace(/\*\*([^*]+)\*\*/g, '$1')
                                        .replace(/\*([^*]+)\*/g, '$1')
                                        .replace(/#{1,6}\s+/g, '')
                                        .replace(/^-\s+/gm, '')
                                        .replace(/^\*\s+/gm, '');

      // Pure passthrough - no calibration or filtering
      const phase1Result: AdvancedPhaseResult = {
        phase: 1,
        questions,
        responses: [{ content: cleanContent, timestamp: new Date() }],
        chunked: needsChunking,
        chunkCount: needsChunking ? chunks.length : 1
      };
      results.push(phase1Result);
      
      onProgress?.({ type: 'phase_complete', data: { phase: 1, result: phase1Result } });

      if (analysisType.endsWith('-short')) {
        return results;
      }

      // Parse scores from Phase 1 (simplified parsing for now)
      const mockPhase1Scores = questions.map(q => ({ question: q.question, score: 85 })); // This would be parsed from actual response

      // Phase 2 - Pushback Protocol
      if (mockPhase1Scores.some(s => s.score < 95)) {
        onProgress?.({ type: 'phase', data: { phase: 2, message: 'Starting Phase 2 pushback...' } });
        
        const phase2Prompt = this.buildPhase2Prompt(mockPhase1Scores, analysisType);
        const phase2Response = await this.llmService.sendMessage(llmProvider as any, phase2Prompt);
        const phase2Content = phase2Response.content;
        
        // Clean markdown from phase 2 response
        const cleanPhase2Content = phase2Content.replace(/\*\*([^*]+)\*\*/g, '$1')
                                                 .replace(/\*([^*]+)\*/g, '$1')
                                                 .replace(/#{1,6}\s+/g, '')
                                                 .replace(/^-\s+/gm, '')
                                                 .replace(/^\*\s+/gm, '');
        
        const phase2Result: AdvancedPhaseResult = {
          phase: 2,
          questions,
          responses: [{ content: cleanPhase2Content, timestamp: new Date() }]
        };
        results.push(phase2Result);
        
        onProgress?.({ type: 'phase_complete', data: { phase: 2, result: phase2Result } });
      }

      // Phase 3 - Walmart Metric Enforcement
      onProgress?.({ type: 'phase', data: { phase: 3, message: 'Starting Phase 3 Walmart metric enforcement...' } });
      
      const phase3Prompt = this.buildPhase3Prompt(mockPhase1Scores, analysisType);
      const phase3Response = await this.llmService.sendMessage(llmProvider as any, phase3Prompt);
      const phase3Content = phase3Response.content;
      
      // Clean markdown from phase 3 response
      const cleanPhase3Content = phase3Content.replace(/\*\*([^*]+)\*\*/g, '$1')
                                               .replace(/\*([^*]+)\*/g, '$1')
                                               .replace(/#{1,6}\s+/g, '')
                                               .replace(/^-\s+/gm, '')
                                               .replace(/^\*\s+/gm, '');
      
      const phase3Result: AdvancedPhaseResult = {
        phase: 3,
        questions,
        responses: [{ content: cleanPhase3Content, timestamp: new Date() }]
      };
      results.push(phase3Result);
      
      onProgress?.({ type: 'phase_complete', data: { phase: 3, result: phase3Result } });

      // Phase 4 - Final Validation
      onProgress?.({ type: 'phase', data: { phase: 4, message: 'Starting Phase 4 final validation...' } });
      
      const phase4Prompt = this.buildPhase4Prompt(analysisType);
      const phase4Response = await this.llmService.sendMessage(llmProvider as any, phase4Prompt);
      const phase4Content = phase4Response.content;
      
      // Clean markdown from phase 4 response
      const cleanPhase4Content = phase4Content.replace(/\*\*([^*]+)\*\*/g, '$1')
                                               .replace(/\*([^*]+)\*/g, '$1')
                                               .replace(/#{1,6}\s+/g, '')
                                               .replace(/^-\s+/gm, '')
                                               .replace(/^\*\s+/gm, '');
      
      const phase4Result: AdvancedPhaseResult = {
        phase: 4,
        questions,
        responses: [{ content: cleanPhase4Content, timestamp: new Date() }],
        finalScore: 92 // This would be parsed from actual response
      };
      results.push(phase4Result);
      
      onProgress?.({ type: 'phase_complete', data: { phase: 4, result: phase4Result } });
      onProgress?.({ type: 'complete', data: { results } });

      return results;

    } catch (error) {
      console.error('Advanced analysis error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.({ type: 'error', data: { error: errorMessage } });
      throw error;
    }
  }
}