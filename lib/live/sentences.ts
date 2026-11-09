import { splitSentences } from "@/lib/listen/sentences";

/**
 * New complete sentences from a growing stream.
 * While the stream is open, the last slice may still be growing, so it stays back.
 */
export function readySentences(full: string, from: number, finished: boolean) {
  const slices = splitSentences(full);
  const closed = finished ? slices : slices.slice(0, Math.max(0, slices.length - 1));
  const next = closed.filter((slice) => slice.end > from && slice.text.trim());
  const cursor = next.length > 0 ? (next[next.length - 1]?.end ?? from) : from;
  return { sentences: next.map((slice) => slice.text), cursor };
}
