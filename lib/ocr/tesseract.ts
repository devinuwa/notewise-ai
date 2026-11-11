import type { FlaggedWord } from "@/lib/ocr/types";

type TessWord = {
  text?: string;
  confidence?: number;
};

type TessResult = {
  data: {
    text?: string;
    words?: TessWord[];
  };
};

type Engine = {
  setParameters: (params: Record<string, string>) => Promise<void>;
  recognize: (image: Blob) => Promise<TessResult>;
};

let workerPromise: Promise<Engine> | null = null;

/** Words under this confidence get flagged for Review (Tesseract scale is 0–100). */
const CONFIDENCE_FLOOR = 70;

async function englishWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      // The language file is served from this app, then cached, so a later read can work offline.
      const worker = (await createWorker("eng", 1, {
        langPath: "/tessdata",
        gzip: true,
        workerBlobURL: false,
        workerPath: "/tessdata/worker.min.js",
        corePath: "/tessdata",
      })) as unknown as Engine;
      // Notebook pages are usually one block of lined writing / print.
      await worker.setParameters({
        tessedit_pageseg_mode: String(PSM.SINGLE_BLOCK),
        preserve_interword_spaces: "1",
      });
      return worker;
    })().catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function tidyText(raw: string) {
  return raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Flag low-confidence words while keeping Tesseract's original layout text. */
function flagUncertainWords(text: string, words: TessWord[] | undefined): FlaggedWord[] {
  if (!words?.length || !text) return [];
  const flagged: FlaggedWord[] = [];
  let cursor = 0;
  for (const word of words) {
    const piece = word.text ?? "";
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const at = text.indexOf(trimmed, cursor);
    if (at < 0) continue;
    cursor = at + trimmed.length;
    const confidence = typeof word.confidence === "number" ? word.confidence : 100;
    if (confidence < CONFIDENCE_FLOOR) {
      flagged.push({ text: trimmed, index: at });
    }
  }
  return flagged;
}

export async function recognizeOnDevice(blob: Blob) {
  const worker = await englishWorker();
  const recognized = await worker.recognize(blob);
  // rawText stays exactly what Tesseract returned; text is whitespace-tidied for review UI.
  const rawText = recognized.data.text ?? "";
  const text = tidyText(rawText);
  const flaggedWords = flagUncertainWords(text, recognized.data.words);
  return { rawText, text, flaggedWords };
}

/** Warm the on-device reader during idle time. Cloud reading never calls this. */
export function preloadOnDevice() {
  return englishWorker().then(() => undefined);
}
