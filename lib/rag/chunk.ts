import { splitSentences } from "@/lib/listen/sentences";

const MAX_WORDS = 200;
const OVERLAP_WORDS = 40;

function wordsOf(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}

/** A sentence longer than the chunk size is cut on words, with a short repeated tail. */
function splitLong(text: string) {
  const words = wordsOf(text);
  if (words.length <= MAX_WORDS) return [text.trim()];
  const step = MAX_WORDS - OVERLAP_WORDS;
  const parts: string[] = [];
  for (let start = 0; start < words.length; start += step) {
    parts.push(words.slice(start, start + MAX_WORDS).join(" "));
    if (start + MAX_WORDS >= words.length) break;
  }
  return parts;
}

function overlapTail(parts: string[]) {
  const kept: string[] = [];
  let count = 0;
  for (let index = parts.length - 1; index >= 0 && count < OVERLAP_WORDS; index -= 1) {
    const size = wordsOf(parts[index] ?? "").length;
    if (count + size > OVERLAP_WORDS && kept.length > 0) break;
    kept.unshift(parts[index] ?? "");
    count += size;
  }
  // Keeping every part would repeat the whole chunk as the next start.
  if (kept.length === parts.length) return [];
  return kept;
}

/**
 * Reviewed text is split on sentence boundaries into about 120–200 words.
 * The next chunk repeats a few words so a fact on the boundary is still found.
 */
export function chunkText(source: string): string[] {
  const sentences = splitSentences(source)
    .map((slice) => slice.text.trim())
    .filter(Boolean);
  const pieces = (sentences.length > 0 ? sentences : wordsOf(source).length > 0 ? [source.trim()] : []).flatMap(
    splitLong,
  );
  if (pieces.length === 0) return [];

  const chunks: string[] = [];
  let buffer: string[] = [];
  let count = 0;

  const emit = () => {
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text) chunks.push(text);
    buffer = overlapTail(buffer);
    count = buffer.reduce((sum, part) => sum + wordsOf(part).length, 0);
  };

  for (const piece of pieces) {
    const size = wordsOf(piece).length;
    if (count > 0 && count + size > MAX_WORDS) emit();
    buffer.push(piece);
    count += size;
    if (count >= MAX_WORDS) emit();
  }

  const tail = buffer.join(" ").replace(/\s+/g, " ").trim();
  const tailWords = wordsOf(tail).length;
  // The remainder of an emitted chunk is only the overlap, so it is not a new chunk.
  if (tail && !(chunks.length > 0 && tailWords <= OVERLAP_WORDS && chunks[chunks.length - 1]?.endsWith(tail))) {
    chunks.push(tail);
  }
  return chunks;
}
