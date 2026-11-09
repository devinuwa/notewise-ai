"use client";

import { getDb } from "@/lib/db";
import { refreshPaperStatus } from "@/lib/exam/store";
import { sha256Hex } from "@/lib/ocr/hash";
import { readCloudStream, readOnDevice } from "@/lib/ocr/index";
import { parseTranscription } from "@/lib/ocr/parse";
import { makeOcrJpeg } from "@/lib/scan/prepare-image";

const FAILED = "This page could not be read. You can type the questions on the check screen.";
const reading = new Set<string>();

async function remember(
  id: string,
  paperId: string,
  row: { raw: string; text: string; flags: { text: string; index: number }[]; provider: string; hash: string },
) {
  const db = getDb();
  const sheet = await db.examSheets.get(id);
  if (!sheet) return;
  await db.examSheets.put({
    ...sheet,
    rawOcrText: row.raw,
    text: row.text,
    flaggedWords: row.flags,
    ocrProvider: row.provider,
    ocrStatus: "ready",
    status: "needs-review",
    ocrError: "",
  });
  await db.ocrCache.put({
    hash: row.hash,
    rawOcrText: row.raw,
    text: row.text,
    flaggedWords: row.flags,
    provider: row.provider,
  });
  await refreshPaperStatus(paperId);
}

/** Read one exam photo with the same cloud or on-device path as a note. The page is not queued as a note. */
export async function readExamSheet(id: string) {
  if (reading.has(id)) return;
  const db = getDb();
  const sheet = await db.examSheets.get(id);
  if (!sheet || sheet.ocrStatus === "ready" || sheet.ocrStatus === "reading") return;
  if (sheet.source === "pdf-text") {
    await db.examSheets.update(id, { ocrStatus: "ready", status: "needs-review" });
    await refreshPaperStatus(sheet.paperId);
    return;
  }
  if (!sheet.imageBlob || sheet.imageBlob.size === 0) {
    await db.examSheets.update(id, { ocrStatus: "error", ocrError: FAILED });
    await refreshPaperStatus(sheet.paperId);
    return;
  }

  reading.add(id);
  await db.examSheets.update(id, { ocrStatus: "reading", ocrError: "" });
  try {
    const settings = await db.settings.get("local");
    const mode = settings?.ocrMode ?? "cloud";
    const prepared = await makeOcrJpeg(sheet.imageBlob);
    const hash = await sha256Hex(prepared);
    const cached = await db.ocrCache.get(hash);
    const reusable = cached && (mode !== "cloud" || cached.provider === "gemini");
    if (cached && reusable) {
      await remember(id, sheet.paperId, {
        raw: cached.rawOcrText,
        text: cached.text,
        flags: cached.flaggedWords,
        provider: cached.provider,
        hash,
      });
      return;
    }

    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const useDevice = mode === "on-device" || offline || !settings?.aiConsent;
    if (useDevice) {
      const run = await readOnDevice(prepared, mode === "cloud");
      await remember(id, sheet.paperId, {
        raw: run.rawOcrText,
        text: run.result.text,
        flags: run.result.flaggedWords,
        provider: run.result.provider,
        hash,
      });
      return;
    }

    try {
      const raw = await readCloudStream(prepared, () => undefined);
      const parsed = parseTranscription(raw);
      await remember(id, sheet.paperId, {
        raw,
        text: parsed.text,
        flags: parsed.flaggedWords,
        provider: "gemini",
        hash,
      });
    } catch {
      const run = await readOnDevice(prepared, true);
      await remember(id, sheet.paperId, {
        raw: run.rawOcrText,
        text: run.result.text,
        flags: run.result.flaggedWords,
        provider: run.result.provider,
        hash,
      });
    }
  } catch {
    await getDb().examSheets.update(id, { ocrStatus: "error", ocrError: FAILED });
    await refreshPaperStatus(sheet.paperId);
  } finally {
    reading.delete(id);
  }
}
