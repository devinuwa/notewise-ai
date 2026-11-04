import type { FlaggedWord } from "@/lib/ocr/types";

// Index is the start of the word in the cleaned text, so a later review screen can highlight it.
const marker = /\[\?([^[\]]*)\]/g;

export function parseTranscription(rawOcrText: string): { text: string; flaggedWords: FlaggedWord[] } {
  const flaggedWords: FlaggedWord[] = [];
  let text = "";
  let cursor = 0;

  for (const match of rawOcrText.matchAll(marker)) {
    const start = match.index ?? 0;
    text += rawOcrText.slice(cursor, start);
    const guess = match[1]?.trim() ?? "";
    const index = text.length;
    if (guess) text += guess;
    flaggedWords.push({ text: guess || "?", index });
    cursor = start + match[0].length;
  }

  text += rawOcrText.slice(cursor);
  return { text, flaggedWords };
}
