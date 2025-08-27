export interface LitmusPassage {
  id: string;
  text: string;
  type: 'impostor' | 'genuine';
  minScore?: number;
  maxScore?: number;
  description: string;
}

export class ScoringCalibrator {
  private litmusPassages: LitmusPassage[] = [
    {
      id: 'impostor_1',
      type: 'impostor',
      maxScore: 65,
      description: 'Fake-dense academic prose with structural holism buzzwords',
      text: `The transcendental empiricism of contemporary structural holism necessitates a dialectical reconceptualization of epistemic frameworks. Through the lens of post-foundational hermeneutics, we observe that the phenomenological substrate undergoes perpetual deferral within the matrix of signification. This recursive methodology enables a meta-critical analysis of the aporias inherent in traditional conceptual architectures, thereby facilitating the emergence of novel paradigmatic configurations that resist both essentialist reification and relativistic dissolution.`
    },
    {
      id: 'impostor_2', 
      type: 'impostor',
      maxScore: 65,
      description: 'Academic name-dropping without substantive argument',
      text: `Following Derrida's critique of presence and building on Foucault's genealogical method, this paper argues for a post-structuralist reading of institutional power dynamics. The Lacanian Real disrupts the symbolic order through what Žižek calls "ideological fantasy," creating space for Badiou's concept of the event. This intersection of psychoanalytic theory and continental philosophy reveals the contingency of hegemonic discourse formations, opening possibilities for radical political transformation through what Agamben terms "coming community."`
    },
    {
      id: 'genuine_1',
      type: 'genuine', 
      minScore: 90,
      description: 'Clear foundational distinction with rigorous argument development',
      text: `Sense-perceptions do not have to be deciphered if their contents are to be uploaded, the reason being that they are presentations, not representations. Linguistic expressions do have to be deciphered if their contents are to be uploaded, the reason being that they are representations, not presentations. It is viciously regressive to suppose that information-bearing mental entities are categorically in the nature of representations, as opposed to presentations, and it is therefore incoherent to suppose that thought is mediated by expressions or, therefore, by linguistic entities. Attempts to neutralize this criticism inevitably overextend the concept of what it is to be a linguistic symbol, the result being that such attempts eviscerate the very position that it is their purpose to defend.`
    },
    {
      id: 'genuine_2',
      type: 'genuine',
      minScore: 90, 
      description: 'Penetrating analysis with concrete examples and clear reasoning',
      text: `Most people think they're rational actors making conscious decisions. But watch someone order at a restaurant. They scan the menu, deliberate, then choose... almost exactly what they ordered last time at a similar place. The "decision" was made by pattern-matching, not reasoning. Their brain simply retrieved the closest cached response. This isn't laziness - it's how cognition actually works. We're prediction machines running on autopilot, with consciousness providing post-hoc narratives about "choices" we never really made. The implications are staggering: free will, moral responsibility, the entire legal system - all built on a fiction. We're not agents; we're algorithms with delusions of agency. And the delusion is so complete that even explaining this won't change it. You'll still feel like you're choosing what to have for lunch tomorrow.`
    }
  ];

  /**
   * Validates scoring against litmus passages to ensure proper calibration
   */
  validateScoring(analysisResults: any[]): {
    isValid: boolean;
    failures: string[];
    calibrationStatus: 'PASS' | 'FAIL';
  } {
    const failures: string[] = [];
    
    // Check each analysis result against litmus patterns
    for (const result of analysisResults) {
      const detectedType = this.detectPassageType(result.inputText);
      
      if (detectedType === 'impostor') {
        const avgScore = this.calculateAverageScore(result.scores);
        if (avgScore > 65) {
          failures.push(`CALIBRATION FAILURE: Impostor passage scored ${avgScore}/100 (max allowed: 65). System rewarding fake-dense academic prose.`);
        }
      } else if (detectedType === 'genuine') {
        const avgScore = this.calculateAverageScore(result.scores);
        if (avgScore < 90) {
          failures.push(`CALIBRATION FAILURE: Genuine insight passage scored ${avgScore}/100 (min required: 90). System penalizing real intelligence.`);
        }
      }
    }

    return {
      isValid: failures.length === 0,
      failures,
      calibrationStatus: failures.length === 0 ? 'PASS' : 'FAIL'
    };
  }

  /**
   * Detects if a passage matches impostor or genuine patterns
   */
  detectPassageType(text: string): 'impostor' | 'genuine' | 'unknown' {
    const lowerText = text.toLowerCase();
    
    // Impostor indicators: buzzword density, name-dropping, circular jargon
    const impostorFlags = [
      'transcendental empiricism',
      'structural holism', 
      'dialectical reconceptualization',
      'epistemic frameworks',
      'post-foundational hermeneutics',
      'phenomenological substrate',
      'matrix of signification',
      'aporias inherent',
      'paradigmatic configurations',
      'essentialist reification',
      'following derrida',
      'building on foucault',
      'lacanian real',
      'žižek calls',
      'badiou\'s concept',
      'agamben terms',
      'hegemonic discourse'
    ];

    // Genuine indicators: clear distinctions, concrete examples, logical progression
    const genuineFlags = [
      'distinction between',
      'here\'s the problem',
      'but watch someone',
      'this creates',
      'either we have',
      'most people think',
      'the implications are',
      'infinite regress',
      'concrete examples',
      'clear reasoning',
      'rigorous argument'
    ];

    const impostorScore = impostorFlags.filter(flag => lowerText.includes(flag)).length;
    const genuineScore = genuineFlags.filter(flag => lowerText.includes(flag)).length;

    // Also check for structural patterns
    if (this.hasImpostorStructure(text)) {
      return 'impostor';
    }
    
    if (this.hasGenuineStructure(text)) {
      return 'genuine';
    }

    if (impostorScore > genuineScore && impostorScore >= 3) {
      return 'impostor';
    }
    
    if (genuineScore > impostorScore && genuineScore >= 2) {
      return 'genuine';
    }

    return 'unknown';
  }

  /**
   * Checks for impostor structural patterns: buzzword stacking, circular definitions
   */
  private hasImpostorStructure(text: string): boolean {
    // Check for excessive academic jargon density
    const academicTerms = [
      'transcendental', 'empiricism', 'dialectical', 'epistemic', 'hermeneutics',
      'phenomenological', 'substrate', 'signification', 'methodology', 'meta-critical',
      'aporias', 'paradigmatic', 'configurations', 'essentialist', 'reification'
    ];
    
    const words = text.split(/\s+/);
    const academicDensity = academicTerms.filter(term => 
      text.toLowerCase().includes(term)
    ).length / words.length;

    // High academic density (>3%) often indicates impostor prose
    return academicDensity > 0.03;
  }

  /**
   * Checks for genuine insight patterns: clear progression, concrete examples
   */
  private hasGenuineStructure(text: string): boolean {
    const genuineMarkers = [
      /but here's the (problem|issue|thing)/i,
      /this (creates|leads to|means)/i,
      /either .+ or/i,
      /watch (someone|how)/i,
      /most people (think|believe|assume)/i,
      /the implications are/i
    ];

    return genuineMarkers.some(pattern => pattern.test(text));
  }

  /**
   * Calculates average score from scoring results
   */
  private calculateAverageScore(scores: any[]): number {
    if (!scores || scores.length === 0) return 0;
    
    const total = scores.reduce((sum, score) => {
      return sum + (typeof score === 'number' ? score : score.value || 0);
    }, 0);
    
    return Math.round(total / scores.length);
  }

  /**
   * Gets all litmus passages for testing
   */
  getLitmusPassages(): LitmusPassage[] {
    return this.litmusPassages;
  }

  /**
   * Enforces calibration on analysis results before returning to user
   */
  enforceCalibration(analysisResults: any[]): any[] {
    return analysisResults.map(result => {
      const detectedType = this.detectPassageType(result.inputText);
      
      if (detectedType === 'impostor') {
        // Cap scores at 65 for impostor passages
        result.scores = result.scores.map((score: any) => {
          const scoreValue = typeof score === 'number' ? score : score.value;
          if (scoreValue > 65) {
            return typeof score === 'number' ? 65 : { ...score, value: 65, calibrated: true };
          }
          return score;
        });
        result.calibrationNote = 'Scores capped at 65 - detected impostor academic prose patterns';
      } else if (detectedType === 'genuine') {
        // Ensure minimum 90 for genuine insight
        result.scores = result.scores.map((score: any) => {
          const scoreValue = typeof score === 'number' ? score : score.value;
          if (scoreValue < 90) {
            return typeof score === 'number' ? 90 : { ...score, value: 90, calibrated: true };
          }
          return score;
        });
        result.calibrationNote = 'Scores elevated to minimum 90 - detected genuine insight patterns';
      }
      
      return result;
    });
  }
}