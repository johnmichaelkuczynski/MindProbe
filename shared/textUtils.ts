export interface TextChunk {
  id: string;
  text: string;
  wordCount: number;
  startIndex: number;
  endIndex: number;
  selected: boolean;
}

export class TextChunkingService {
  private static readonly CHUNK_SIZE = 1000; // words
  private static readonly OVERLAP_SIZE = 50; // words

  static needsChunking(text: string): boolean {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length > this.CHUNK_SIZE;
  }

  static createChunks(text: string): TextChunk[] {
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    
    if (words.length <= this.CHUNK_SIZE) {
      return [{
        id: 'chunk-0',
        text: text,
        wordCount: words.length,
        startIndex: 0,
        endIndex: text.length,
        selected: true
      }];
    }

    const chunks: TextChunk[] = [];
    let startWordIndex = 0;

    while (startWordIndex < words.length) {
      const endWordIndex = Math.min(startWordIndex + this.CHUNK_SIZE, words.length);
      const chunkWords = words.slice(startWordIndex, endWordIndex);
      const chunkText = chunkWords.join(' ');

      chunks.push({
        id: `chunk-${chunks.length}`,
        text: chunkText,
        wordCount: chunkWords.length,
        startIndex: startWordIndex,
        endIndex: endWordIndex,
        selected: chunks.length === 0 // Select first chunk by default
      });

      // Move start index for next chunk, accounting for overlap
      startWordIndex = endWordIndex - this.OVERLAP_SIZE;
      if (startWordIndex >= words.length - this.OVERLAP_SIZE) {
        break;
      }
    }

    return chunks;
  }

  static getSelectedChunksText(chunks: TextChunk[]): string {
    return chunks
      .filter(chunk => chunk.selected)
      .map(chunk => chunk.text)
      .join('\n\n');
  }

  static getWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}