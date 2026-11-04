import { getDb } from "@/lib/db";
import type { OcrMode } from "@/lib/db";
import { ocrPage } from "@/lib/ocr/index";

export type PageRead = {
  id: string;
  ok: boolean;
  usedFallback: boolean;
  provider: "gemini" | "tesseract" | "";
  error: string;
};

const FAILED = "This page could not be read. The photo is still saved.";

export async function readSavedPages(
  ids: string[],
  mode: OcrMode,
  onProgress: (current: number, total: number) => void,
): Promise<PageRead[]> {
  const db = getDb();
  const results: PageRead[] = [];

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    onProgress(index + 1, ids.length);
    const page = await db.notePages.get(id);
    if (!page) {
      results.push({ id, ok: false, usedFallback: false, provider: "", error: FAILED });
      continue;
    }

    try {
      const run = await ocrPage(page.imageBlob, mode);
      const next = { ...page };
      delete next.ocrError;
      await db.notePages.put({
        ...next,
        rawOcrText: run.rawOcrText,
        text: run.result.text,
        flaggedWords: run.result.flaggedWords,
        ocrProvider: run.result.provider,
        status: "needs-review",
      });
      results.push({
        id,
        ok: true,
        usedFallback: run.usedFallback,
        provider: run.result.provider,
        error: "",
      });
    } catch {
      await db.notePages.put({
        ...page,
        status: "needs-review",
        ocrError: FAILED,
      });
      results.push({ id, ok: false, usedFallback: false, provider: "", error: FAILED });
    }
  }

  return results;
}
