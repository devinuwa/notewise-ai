export type SentenceSlice = {
  text: string;
  start: number;
  end: number;
};

const MAX_CHARS = 180;

/** A dot in "3.14", "1." at the start of a line, or "Mr." is not the end of a sentence. */
function dotIsInside(source: string, dot: number) {
  const prev = source[dot - 1] ?? "";
  const next = source[dot + 1] ?? "";
  if (/\d/.test(prev) && /\d/.test(next)) return true;
  const before = source.slice(0, dot);
  if (/(?:^|\n)\s*\d+$/.test(before)) return true;
  if (/(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e)$/i.test(before)) return true;
  return false;
}

function pushSlice(source: string, start: number, end: number, slices: SentenceSlice[]) {
  const raw = source.slice(start, end);
  const text = raw.trim();
  if (!text) return;
  const lead = raw.indexOf(text);
  slices.push({ text, start: start + lead, end: start + lead + text.length });
}

/** A very long sentence is still one utterance on Android, so it is split at a space. */
function splitLong(slice: SentenceSlice): SentenceSlice[] {
  if (slice.text.length <= MAX_CHARS) return [slice];
  const parts: SentenceSlice[] = [];
  let offset = 0;
  while (offset < slice.text.length) {
    let take = Math.min(MAX_CHARS, slice.text.length - offset);
    if (offset + take < slice.text.length) {
      const chunk = slice.text.slice(offset, offset + take);
      const breakAt = Math.max(chunk.lastIndexOf(", "), chunk.lastIndexOf(" "));
      if (breakAt > 40) take = breakAt + 1;
    }
    const raw = slice.text.slice(offset, offset + take);
    const text = raw.trim();
    if (text) {
      const lead = raw.indexOf(text);
      parts.push({
        text,
        start: slice.start + offset + lead,
        end: slice.start + offset + lead + text.length,
      });
    }
    offset += take;
  }
  return parts;
}

export function splitSentences(source: string): SentenceSlice[] {
  const slices: SentenceSlice[] = [];
  let start = 0;
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === "\n") {
      pushSlice(source, start, index, slices);
      index += 1;
      start = index;
      continue;
    }
    if ((char === "." || char === "!" || char === "?") && !(char === "." && dotIsInside(source, index))) {
      let end = index + 1;
      while (end < source.length && ".!?".includes(source[end] ?? "")) end += 1;
      pushSlice(source, start, end, slices);
      index = end;
      start = index;
      continue;
    }
    index += 1;
  }
  pushSlice(source, start, source.length, slices);
  return slices.flatMap(splitLong);
}
