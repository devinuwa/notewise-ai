import type { OcrMode } from "@/lib/db";
import { parseTranscription } from "@/lib/ocr/parse";
import { recognizeOnDevice } from "@/lib/ocr/tesseract";
import type { OcrRun } from "@/lib/ocr/types";

const MAX_TRIES = 3;

type CloudFailure = {
  status: number;
  retryAfter: number;
  code: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitMs(attempt: number, retryAfter: number) {
  if (retryAfter > 0) return retryAfter * 1000;
  const base = Math.min(1000 * 2 ** (attempt - 1), 8000);
  return base / 2 + Math.random() * (base / 2);
}

function retryable(failure: CloudFailure) {
  if (failure.code === "not_configured") return false;
  return failure.status === 429 || failure.status >= 500;
}

async function readCloud(blob: Blob): Promise<string> {
  let last: CloudFailure = { status: 0, retryAfter: 0, code: "" };

  for (let attempt = 1; attempt <= MAX_TRIES; attempt += 1) {
    try {
      const body = new FormData();
      body.append("image", blob, "page.jpg");
      const response = await fetch("/api/ocr", { method: "POST", body });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { code?: string } | null;
        last = {
          status: response.status,
          retryAfter: Number(response.headers.get("retry-after") ?? 0) || 0,
          code: payload?.code ?? "",
        };
        if (!retryable(last) || attempt === MAX_TRIES) {
          throw new Error("Cloud reading failed.");
        }
        await sleep(waitMs(attempt, last.retryAfter));
        continue;
      }
      const payload = (await response.json()) as { text?: unknown };
      if (typeof payload.text !== "string") throw new Error("Cloud reading failed.");
      return payload.text;
    } catch (caught) {
      if (caught instanceof Error && caught.message === "Cloud reading failed.") throw caught;
      last = { status: 0, retryAfter: 0, code: "" };
      if (attempt === MAX_TRIES) throw new Error("Cloud reading failed.");
      await sleep(waitMs(attempt, 0));
    }
  }

  throw new Error("Cloud reading failed.");
}

async function readOnDevice(blob: Blob, usedFallback: boolean): Promise<OcrRun> {
  const rawOcrText = await recognizeOnDevice(blob);
  const parsed = parseTranscription(rawOcrText);
  return {
    rawOcrText,
    usedFallback,
    result: { text: parsed.text, flaggedWords: parsed.flaggedWords, provider: "tesseract" },
  };
}

export async function ocrPage(blob: Blob, mode: OcrMode): Promise<OcrRun> {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (mode === "on-device" || offline) {
    return readOnDevice(blob, mode === "cloud");
  }

  try {
    const rawOcrText = await readCloud(blob);
    const parsed = parseTranscription(rawOcrText);
    return {
      rawOcrText,
      usedFallback: false,
      result: { text: parsed.text, flaggedWords: parsed.flaggedWords, provider: "gemini" },
    };
  } catch {
    return readOnDevice(blob, true);
  }
}
