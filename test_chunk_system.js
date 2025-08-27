// Test the chunking system directly

// Read the file content
const content = `How AI Vindicates the Alignment of Grammar and Logic: Evidence from Large Language Models for the Unity of Form

Abstract

This paper argues that the demonstrated capabilities of large language models (LLMs) provide surprising empirical support for the alignment of grammatical and logical form. While philosophers have traditionally posited a divergence between grammatical and logical structure, LLMs' ability to make correct inferences without FOL-style logical forms suggests that grammatical structure itself guides valid reasoning. This indicates that the perceived misalignment between grammatical and logical form may be artifacts of our chosen formal systems rather than features of language itself.

1. Introduction

The distinction between logical and grammatical form has been a cornerstone of philosophical thinking about language since Frege and Russell. This view maintains that:

1. Sentences with similar grammatical forms can have different logical forms
2. Understanding logical form is necessary for proper reasoning
3. Surface grammar can mislead if not translated into proper logical form

For example, philosophers argue that while "John snores" and "nobody snores" share grammatical form (subject-predicate), they differ in logical form:
- "John snores" → simple predication
- "nobody snores" → universal negative quantification

This paper argues that the demonstrated capabilities of large language models suggest an alternative view: that grammatical and logical form can and do align in actual reasoning practice, even if they appear to diverge in first-order logic (FOL).

2. Evidence from AI Language Processing

2.1 Direct Learning of Inferential Patterns

Consider how LLMs handle quantified expressions:

1. They correctly process "nobody snores" without:
   - Translating to FOL
   - Positing hidden logical form
   - Being misled by surface grammar

2. They make appropriate inferences:
   - From "nobody snores" to "there are no snorers"
   - Without positing entities named "nobody"
   - Without explicit quantificational analysis

3. They handle related expressions systematically:
   - "everybody," "somebody," "no philosopher"
   - Without diverging from grammatical structure
   - While maintaining valid inference patterns

2.2 The Non-Role of Traditional Logical Form

Significantly, LLMs achieve this without:
- FOL-style representations
- Explicit logical forms distinct from grammar
- Translation between grammatical and logical structures

This suggests that the traditional view of logical form as necessary for valid inference may be mistaken.`;

// Count words
const words = content.trim().split(/\s+/).filter(word => word.length > 0);
console.log(`Total words: ${words.length}`);

// Test chunking logic
function generateChunks(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';
  let chunkIndex = 0;
  let wordCount = 0;
  
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // If adding this sentence would exceed 800 words, start a new chunk
    if (wordCount + sentenceWords > 800 && currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        wordCount: wordCount
      });
      currentChunk = sentence.trim();
      wordCount = sentenceWords;
      chunkIndex++;
    } else {
      currentChunk += (currentChunk ? '. ' : '') + sentence.trim();
      wordCount += sentenceWords;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      index: chunkIndex,
      wordCount: wordCount
    });
  }
  
  return chunks;
}

const chunks = generateChunks(content);
console.log(`Generated ${chunks.length} chunks:`);
chunks.forEach((chunk, i) => {
  console.log(`\nChunk ${i + 1} (${chunk.wordCount} words):`);
  console.log(chunk.text.substring(0, 150) + '...');
});