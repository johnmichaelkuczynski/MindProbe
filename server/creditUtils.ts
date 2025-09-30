export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

export function calculateTotalWords(results: any[]): number {
  let totalWords = 0;
  
  for (const result of results) {
    if (result.data?.answer) {
      totalWords += countWords(result.data.answer);
    } else if (result.data?.content) {
      totalWords += countWords(result.data.content);
    }
  }
  
  return totalWords;
}
