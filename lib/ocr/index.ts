import { parseTranscription } from "@/lib/ocr/parse";
import { recognizeOnDevice } from "@/lib/ocr/tesseract";
import type { OcrRun } from "@/lib/ocr/types";

const MAX_TRIES = 3;

class CloudReadError extends Error {
  retry: boolean;
  retryAfter: number;

  constructor(retry: boolean, retryAfter = 0) {
    super("Cloud reading failed.");
    this.retry = retry;
    this.retryAfter = retryAfter;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitMs(attempt: number, retryAfter: number) {
  if (retryAfter > 0) return retryAfter * 1000;
  const base = Math.min(1000 * 2 ** (attempt - 1), 8000);
  return base / 2 + Math.random() * (base / 2);
}

function merge(previous: string, piece: string) {
  if (!piece) return previous;
  if (piece.startsWith(previous)) return piece;
  return previous + piece;
}

function eventOf(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return { done: true as const };
  const payload = JSON.parse(data) as { text?: unknown; done?: unknown; error?: unknown };
  if (payload.error) return { error: true as const };
  if (payload.done === true) return { done: true as const };
  if (typeof payload.text === "string" && payload.text) return { text: payload.text };
  return null;
}

async function consume(response: Response, onText: (full: string) => void) {
  if (!response.body) throw new CloudReadError(true);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  let done = false;

  while (!done) {
    const next = await reader.read();
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      let event: ReturnType<typeof eventOf>;
      try {
        event = eventOf(line);
      } catch {
        continue;
      }
      if (!event) continue;
      if ("error" in event) throw new CloudReadError(true);
      if ("done" in event) {
        done = true;
        continue;
      }
      full = merge(full, event.text);
      onText(full);
    }
  }

  if (!done && !full) throw new CloudReadError(true);
  return full;
}

async function once(blob: Blob, onText: (full: string) => void) {
  const body = new FormData();
  body.append("image", blob, "page.jpg");
  let response: Response;
  try {
    response = await fetch("/api/ocr", { method: "POST", body });
  } catch {
    throw new CloudReadError(true);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { code?: string } | null;
    const retryAfter = Number(response.headers.get("retry-after") ?? 0) || 0;
    const retry = payload?.code !== "not_configured" && (response.status === 429 || response.status >= 500);
    throw new CloudReadError(retry, retryAfter);
  }
  return consume(response, onText);
}

export async function readCloudStream(blob: Blob, onText: (full: string) => void) {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    try {
      return await once(blob, onText);
    } catch (caught) {
      const retry = caught instanceof CloudReadError ? caught.retry : true;
      const retryAfter = caught instanceof CloudReadError ? caught.retryAfter : 0;
      if (!retry || attempt === MAX_TRIES) throw new Error("Cloud reading failed.");
      await sleep(waitMs(attempt, retryAfter));
    }
  }
  throw new Error("Cloud reading failed.");
}

export async function readOnDevice(blob: Blob, usedFallback: boolean): Promise<OcrRun> {
  const rawOcrText = await recognizeOnDevice(blob);
  const parsed = parseTranscription(rawOcrText);
  return {
    rawOcrText,
    usedFallback,
    result: { text: parsed.text, flaggedWords: parsed.flaggedWords, provider: "tesseract" },
  };
}
