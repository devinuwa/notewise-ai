import { getDb, type NotePage } from "@/lib/db";
import type { FlaggedWord } from "@/lib/ocr/types";

export function asFlags(value: unknown, text = ""): FlaggedWord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") {
      const at = text.toLowerCase().indexOf(item.toLowerCase());
      return [{ text: item, index: at >= 0 ? at : 0 }];
    }
    if (!item || typeof item !== "object") return [];
    const word = item as FlaggedWord;
    if (typeof word.text !== "string") return [];
    const index = typeof word.index === "number" ? word.index : 0;
    if (text.slice(index, index + word.text.length) === word.text) return [{ text: word.text, index }];
    const at = text.indexOf(word.text);
    return [{ text: word.text, index: at >= 0 ? at : index }];
  });
}

export function sentenceParts(text: string, index: number, word: string) {
  // Demo flags point at the raw reading. Only cut the sentence when that exact word is in the text.
  const at = text.slice(index, index + word.length) === word ? index : text.indexOf(word);
  if (at < 0) {
    return { before: "", after: text.trim(), placed: false };
  }
  const beforeAll = text.slice(0, Math.max(0, at));
  const breaks = [beforeAll.lastIndexOf("."), beforeAll.lastIndexOf("!"), beforeAll.lastIndexOf("?"), beforeAll.lastIndexOf("\n")];
  const start = Math.max(...breaks);
  const from = start < 0 ? 0 : start + 1;
  const rest = text.slice(at + word.length);
  const nextBreak = rest.search(/[.!?\n]/);
  const to = nextBreak < 0 ? text.length : at + word.length + nextBreak + 1;
  return {
    before: text.slice(from, at).replace(/^\s+/, ""),
    after: text.slice(at + word.length, to).replace(/\s+$/, ""),
    placed: true,
  };
}

export function replaceFlag(text: string, flags: FlaggedWord[], cursor: number, replacement: string) {
  const flag = flags[cursor];
  if (!flag) return { text, flags };
  let at = text.indexOf(flag.text);
  const length = flag.text.length;
  if (at < 0 && text.slice(flag.index, flag.index + flag.text.length) === flag.text) at = flag.index;
  if (at < 0) return { text, flags: flags.filter((_, index) => index !== cursor) };
  const nextText = text.slice(0, at) + replacement + text.slice(at + length);
  const delta = replacement.length - length;
  const nextFlags = flags
    .filter((_, index) => index !== cursor)
    .map((item) => (item.index > at ? { ...item, index: item.index + delta } : item));
  return { text: nextText, flags: nextFlags };
}

export function dropFlag(flags: FlaggedWord[], cursor: number) {
  return flags.filter((_, index) => index !== cursor);
}

export async function savePageDraft(
  id: string,
  draft: { text: string; flaggedWords: FlaggedWord[]; flagsFixed: number },
) {
  const db = getDb();
  const page = await db.notePages.get(id);
  if (!page) return;
  const next: NotePage = {
    ...page,
    text: draft.text,
    flaggedWords: draft.flaggedWords,
    flagsFixed: draft.flagsFixed,
  };
  await db.notePages.put(next);
}

export async function markPageDone(
  id: string,
  draft: { text: string; flaggedWords: FlaggedWord[]; flagsFixed: number },
) {
  const db = getDb();
  const page = await db.notePages.get(id);
  if (!page) return;
  const next: NotePage = {
    ...page,
    text: draft.text,
    flaggedWords: draft.flaggedWords,
    flagsFixed: draft.flagsFixed,
    status: "digitized",
    correctedAt: Date.now(),
  };
  delete next.ocrError;
  await db.notePages.put(next);
}
