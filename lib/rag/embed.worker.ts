import { env, pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const MODEL = "Xenova/all-MiniLM-L6-v2";

type ProgressNote = {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
  progress?: number;
};

type Incoming = { type: "load" } | { type: "embed"; id: number; texts: string[] };

// One WASM thread. Extra threads need page headers that would block the camera and the fonts.
env.allowRemoteModels = true;
env.useBrowserCache = true;
const wasm = env.backends.onnx.wasm;
if (wasm) wasm.numThreads = 1;

let extractor: FeatureExtractionPipeline | null = null;
let loading: Promise<void> | null = null;

const scope = self as unknown as DedicatedWorkerGlobalScope;

function plainProgress(update: object): ProgressNote {
  const note = update as ProgressNote;
  return {
    status: note.status,
    file: note.file,
    loaded: typeof note.loaded === "number" ? note.loaded : undefined,
    total: typeof note.total === "number" ? note.total : undefined,
    progress: typeof note.progress === "number" ? note.progress : undefined,
  };
}

function errorText(error: unknown) {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? error.cause.message : error.cause ? String(error.cause) : "";
    return cause ? `${error.message} (${cause})` : error.message;
  }
  return "The study brain could not download.";
}

function load() {
  if (!loading) {
    loading = pipeline("feature-extraction", MODEL, {
      dtype: "q8",
      device: "wasm",
      progress_callback: (update) => {
        if (update && typeof update === "object") {
          scope.postMessage({ type: "progress", note: plainProgress(update) });
        }
      },
    })
      .then((created) => {
        extractor = created;
        scope.postMessage({ type: "ready" });
      })
      .catch((error: unknown) => {
        loading = null;
        extractor = null;
        throw error;
      });
  }
  return loading;
}

scope.addEventListener("message", (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type === "load") {
    load().catch((error: unknown) => {
      scope.postMessage({ type: "error", message: errorText(error) });
    });
    return;
  }

  const requestId = message.id;
  load()
    .then(async () => {
      if (!extractor) throw new Error("The study brain is not ready.");
      const tensor = await extractor(message.texts, { pooling: "mean", normalize: true });
      const width = tensor.dims[tensor.dims.length - 1] ?? 0;
      const raw = tensor.data;
      if (!(raw instanceof Float32Array) || width === 0 || raw.length < message.texts.length * width) {
        throw new Error("The study brain returned a short vector.");
      }
      const embeddings = message.texts.map((_, index) => raw.slice(index * width, (index + 1) * width));
      scope.postMessage({ type: "result", id: requestId, embeddings });
    })
    .catch((error: unknown) => {
      const text = error instanceof Error ? error.message : "This note could not be read for search.";
      scope.postMessage({ type: "error", id: requestId, message: text });
    });
});
