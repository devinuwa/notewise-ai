const K1 = 1.2;
const B = 0.75;

function tokens(text: string) {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Word ranking used when the embedding model is not on the phone yet. */
export function rankByKeywords<T extends { text: string }>(query: string, docs: T[], k: number): (T & { score: number })[] {
  const queryTerms = tokens(query);
  if (queryTerms.length === 0 || docs.length === 0 || k <= 0) return [];

  const docsTokens = docs.map((doc) => tokens(doc.text));
  const average = docsTokens.reduce((sum, row) => sum + row.length, 0) / docs.length || 1;
  const documentFrequency = new Map<string, number>();
  for (const row of docsTokens) {
    for (const term of new Set(row)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = docs.length;
  const ranked = docs.map((doc, index) => {
    const row = docsTokens[index] ?? [];
    const frequency = new Map<string, number>();
    for (const term of row) frequency.set(term, (frequency.get(term) ?? 0) + 1);
    let score = 0;
    for (const term of queryTerms) {
      const seen = frequency.get(term) ?? 0;
      if (!seen) continue;
      const docsWithTerm = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (total - docsWithTerm + 0.5) / (docsWithTerm + 0.5));
      const normal = seen + K1 * (1 - B + B * (row.length / average));
      score += idf * ((seen * (K1 + 1)) / normal);
    }
    return { ...doc, score };
  });

  return ranked
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
