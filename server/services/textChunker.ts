export interface TextChunk {
  id: string;
  text: string;
  wordCount: number;
  chunkIndex: number;
  totalChunks: number;
}

export class TextChunker {
  private static readonly MAX_WORDS = 1000;
  private static readonly OVERLAP_WORDS = 50; // Small overlap to maintain context

  /**
   * Splits text into chunks if it exceeds the word limit
   */
  static chunkText(text: string): TextChunk[] {
    const words = this.tokenizeWords(text);
    
    if (words.length <= this.MAX_WORDS) {
      return [{
        id: 'chunk-0',
        text: text.trim(),
        wordCount: words.length,
        chunkIndex: 0,
        totalChunks: 1
      }];
    }

    const chunks: TextChunk[] = [];
    let currentPosition = 0;
    let chunkIndex = 0;

    while (currentPosition < words.length) {
      const chunkSize = this.MAX_WORDS;
      const endPosition = Math.min(currentPosition + chunkSize, words.length);
      
      // Extract chunk words
      const chunkWords = words.slice(currentPosition, endPosition);
      const chunkText = chunkWords.join(' ');

      chunks.push({
        id: `chunk-${chunkIndex}`,
        text: chunkText.trim(),
        wordCount: chunkWords.length,
        chunkIndex,
        totalChunks: 0 // Will be set after all chunks are created
      });

      // Move to next chunk with overlap
      if (endPosition < words.length) {
        currentPosition = endPosition - this.OVERLAP_WORDS;
      } else {
        break;
      }
      
      chunkIndex++;
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Tokenizes text into words (simple whitespace-based splitting)
   */
  private static tokenizeWords(text: string): string[] {
    return text
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Gets word count for a text
   */
  static getWordCount(text: string): number {
    return this.tokenizeWords(text).length;
  }

  /**
   * Checks if text needs chunking
   */
  static needsChunking(text: string): boolean {
    return this.getWordCount(text) > this.MAX_WORDS;
  }

  /**
   * Recombines chunk results for final analysis
   */
  static combineChunkResults(chunkResults: any[]): any {
    if (chunkResults.length === 1) {
      return chunkResults[0];
    }

    // Combine multiple chunk analyses
    const combinedResult = {
      summary: this.combineSummaries(chunkResults),
      chunkAnalyses: chunkResults,
      totalChunks: chunkResults.length,
      combinedScores: this.combineScores(chunkResults),
      note: `This analysis was performed on ${chunkResults.length} chunks due to document length (>1000 words).`
    };

    return combinedResult;
  }

  /**
   * Combines summaries from multiple chunks
   */
  private static combineSummaries(chunkResults: any[]): string {
    const summaries = chunkResults
      .map((result, index) => `Chunk ${index + 1}: ${result.summary || result.content}`)
      .join('\n\n');
    
    return `COMBINED ANALYSIS FROM ${chunkResults.length} CHUNKS:\n\n${summaries}`;
  }

  /**
   * Combines scores from multiple chunks (averages them)
   */
  private static combineScores(chunkResults: any[]): any[] {
    if (!chunkResults.length || !chunkResults[0].scores) {
      return [];
    }

    const scoresByQuestion: { [key: string]: number[] } = {};
    
    // Collect all scores by question
    chunkResults.forEach(result => {
      if (result.scores && Array.isArray(result.scores)) {
        result.scores.forEach((scoreObj: any) => {
          const key = scoreObj.question || scoreObj.category || scoreObj.id;
          if (!scoresByQuestion[key]) {
            scoresByQuestion[key] = [];
          }
          scoresByQuestion[key].push(scoreObj.score || scoreObj.value || 0);
        });
      }
    });

    // Average scores for each question
    const combinedScores = Object.entries(scoresByQuestion).map(([question, scores]) => {
      const avgScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      return {
        question,
        score: avgScore,
        chunkScores: scores,
        note: `Average of ${scores.length} chunk scores: ${scores.join(', ')}`
      };
    });

    return combinedScores;
  }
}