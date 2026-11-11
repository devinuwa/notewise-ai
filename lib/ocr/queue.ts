import { getDb, type NotePage, type OcrMode } from "@/lib/db";
import { isDemoId } from "@/lib/demo";
import { sha256Hex } from "@/lib/ocr/hash";
import { parseTranscription } from "@/lib/ocr/parse";
import { readCloudStream, readOnDevice } from "@/lib/ocr/index";
import { makeOcrJpeg } from "@/lib/scan/prepare-image";

/** How many pages read at the same time. Change this one number to go faster or slower. */
export const OCR_CONCURRENCY = 2;

const FAILED = "This page could not be read. The photo is still saved.";

const inFlight = new Set<string>();
let active = 0;
let pumping = false;
let again = false;

type Draft = {
  text: string;
  timer: number;
  chain: Promise<unknown>;
};

const drafts = new Map<string, Draft>();

function publish(id: string, text: string, immediate: boolean) {
  const slot = drafts.get(id) ?? { text: "", timer: 0, chain: Promise.resolve() };
  slot.text = text;
  if (immediate || typeof window === "undefined") {
    if (slot.timer) window.clearTimeout(slot.timer);
    slot.timer = 0;
    slot.chain = slot.chain.then(() => getDb().notePages.update(id, { text }));
  } else if (!slot.timer) {
    slot.timer = window.setTimeout(() => {
      slot.timer = 0;
      const next = slot.text;
      slot.chain = slot.chain.then(() => getDb().notePages.update(id, { text: next }));
    }, 80);
  }
  drafts.set(id, slot);
}

async function flush(id: string) {
  const slot = drafts.get(id);
  if (!slot) return;
  if (slot.timer) window.clearTimeout(slot.timer);
  slot.timer = 0;
  const next = slot.text;
  slot.chain = slot.chain.then(() => getDb().notePages.update(id, { text: next }));
  await slot.chain;
  drafts.delete(id);
}

function logTiming(row: { pageId: string; preprocessMs: number; uploadMs: number; totalMs: number }) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[ocr]", row);
}

export async function recoverInterrupted() {
  const pages = await getDb().notePages.toArray();
  for (const page of pages) {
    if (page.ocrStatus === "reading" && !inFlight.has(page.id) && !isDemoId(page.id)) {
      await getDb().notePages.update(page.id, { ocrStatus: "queued" });
    }
  }
}

export function kickOcrQueue() {
  void pump();
}

async function pump() {
  if (pumping) {
    again = true;
    return;
  }
  pumping = true;
  try {
    do {
      again = false;
      await launch();
    } while (again);
  } finally {
    pumping = false;
    if (again) void pump();
  }
}

async function launch() {
  const db = getDb();
  const settings = await db.settings.get("local");
  const mode = settings?.ocrMode ?? "cloud";
  if (mode === "cloud" && !settings?.aiConsent) return;

  const queued = (await db.notePages.toArray())
    .filter((page) => page.ocrStatus === "queued" && !isDemoId(page.id) && !inFlight.has(page.id))
    .sort((left, right) => left.createdAt - right.createdAt);

  for (const page of queued) {
    if (active >= OCR_CONCURRENCY) break;
    inFlight.add(page.id);
    active += 1;
    void work(page.id, mode).finally(() => {
      inFlight.delete(page.id);
      active -= 1;
      void pump();
    });
  }
}

async function claim(id: string) {
  const db = getDb();
  return db.transaction("rw", db.notePages, async () => {
    const page = await db.notePages.get(id);
    if (!page || page.ocrStatus !== "queued") return null;
    await db.notePages.update(id, { ocrStatus: "reading" });
    return page;
  });
}

async function work(id: string, mode: OcrMode) {
  const page = await claim(id);
  if (!page) return;
  const started = performance.now();
  try {
    await readClaimed(page, mode, started);
  } catch {
    await flush(page.id);
    const elapsed = Math.round(performance.now() - started);
    await getDb().notePages.update(page.id, {
      ocrStatus: "error",
      ocrError: FAILED,
      ocrMs: (page.preprocessMs ?? 0) + elapsed,
    });
    logTiming({
      pageId: page.id,
      preprocessMs: page.preprocessMs ?? 0,
      uploadMs: page.uploadMs ?? 0,
      totalMs: (page.preprocessMs ?? 0) + elapsed,
    });
  }
}

async function smallImage(page: NotePage) {
  if (page.ocrBlob) return { blob: page.ocrBlob, preprocessMs: page.preprocessMs ?? 0 };
  const started = performance.now();
  const blob = await makeOcrJpeg(page.imageBlob, "cloud");
  const preprocessMs = (page.preprocessMs ?? 0) + Math.round(performance.now() - started);
  await getDb().notePages.update(page.id, { ocrBlob: blob, preprocessMs });
  return { blob, preprocessMs };
}

async function remember(
  page: NotePage,
  reading: { raw: string; text: string; flags: NotePage["flaggedWords"]; provider: string; hash: string },
  timing: { preprocessMs: number; uploadMs: number; totalMs: number },
  ocrBlob: Blob,
) {
  await flush(page.id);
  const next = { ...page };
  delete next.ocrError;
  await getDb().notePages.put({
    ...next,
    ocrBlob,
    ocrHash: reading.hash,
    rawOcrText: reading.raw,
    text: reading.text,
    flaggedWords: reading.flags,
    ocrProvider: reading.provider,
    ocrStatus: "ready",
    status: "needs-review",
    preprocessMs: timing.preprocessMs,
    uploadMs: timing.uploadMs,
    ocrMs: timing.totalMs,
  });
  await getDb().ocrCache.put({
    hash: reading.hash,
    rawOcrText: reading.raw,
    text: reading.text,
    flaggedWords: reading.flags,
    provider: reading.provider,
  });
  logTiming({ pageId: page.id, preprocessMs: timing.preprocessMs, uploadMs: timing.uploadMs, totalMs: timing.totalMs });
}

async function readClaimed(page: NotePage, mode: OcrMode, started: number) {
  const prepared = await smallImage(page);
  const hash = await sha256Hex(prepared.blob);
  const cached = await getDb().ocrCache.get(hash);
  const reusable = cached && (mode !== "cloud" || cached.provider === "gemini");
  if (cached && reusable) {
    const totalMs = prepared.preprocessMs + Math.round(performance.now() - started);
    await remember(
      page,
      { raw: cached.rawOcrText, text: cached.text, flags: cached.flaggedWords, provider: cached.provider, hash },
      { preprocessMs: prepared.preprocessMs, uploadMs: 0, totalMs },
      prepared.blob,
    );
    return;
  }

  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (mode === "on-device" || offline) {
    const run = await readOnDevice(prepared.blob, mode === "cloud");
    const totalMs = prepared.preprocessMs + Math.round(performance.now() - started);
    await remember(
      page,
      {
        raw: run.rawOcrText,
        text: run.result.text,
        flags: run.result.flaggedWords,
        provider: run.result.provider,
        hash,
      },
      { preprocessMs: prepared.preprocessMs, uploadMs: 0, totalMs },
      prepared.blob,
    );
    return;
  }

  const uploadStarted = performance.now();
  let raw = "";
  try {
    let opened = false;
    raw = await readCloudStream(prepared.blob, (text) => {
      publish(page.id, text, !opened);
      opened = true;
    });
  } catch {
    const run = await readOnDevice(prepared.blob, true);
    const uploadMs = Math.round(performance.now() - uploadStarted);
    const totalMs = prepared.preprocessMs + Math.round(performance.now() - started);
    await remember(
      page,
      {
        raw: run.rawOcrText,
        text: run.result.text,
        flags: run.result.flaggedWords,
        provider: run.result.provider,
        hash,
      },
      { preprocessMs: prepared.preprocessMs, uploadMs, totalMs },
      prepared.blob,
    );
    return;
  }

  const parsed = parseTranscription(raw);
  const uploadMs = Math.round(performance.now() - uploadStarted);
  const totalMs = prepared.preprocessMs + Math.round(performance.now() - started);
  await remember(
    page,
    { raw, text: parsed.text, flags: parsed.flaggedWords, provider: "gemini", hash },
    { preprocessMs: prepared.preprocessMs, uploadMs, totalMs },
    prepared.blob,
  );
}
