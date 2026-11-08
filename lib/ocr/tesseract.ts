type Engine = {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>;
};

let workerPromise: Promise<Engine> | null = null;

async function englishWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      // The language file is served from this app, then cached, so a later read can work offline.
      return createWorker("eng", 1, {
        langPath: "/tessdata",
        gzip: true,
        workerBlobURL: false,
        workerPath: "/tessdata/worker.min.js",
        corePath: "/tessdata",
      });
    })().catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export async function recognizeOnDevice(blob: Blob) {
  const worker = await englishWorker();
  const recognized = await worker.recognize(blob);
  return recognized.data.text ?? "";
}

/** Warm the on-device reader during idle time. Cloud reading never calls this. */
export function preloadOnDevice() {
  return englishWorker().then(() => undefined);
}
