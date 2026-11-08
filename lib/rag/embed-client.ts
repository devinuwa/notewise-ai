"use client";

import { getBrain, setBrain, subscribeBrain, getServerBrain } from "@/lib/rag/brain";

export { getBrain, subscribeBrain, getServerBrain };

type ProgressNote = {
  status?: string;
  file?: string;
  name?: string;
  loaded?: number;
  total?: number;
  progress?: number;
};

type WorkerOut =
  | { type: "progress"; note: ProgressNote }
  | { type: "ready" }
  | { type: "result"; id: number; embeddings: Float32Array[] }
  | { type: "error"; id?: number; message: string };

type Waiter = {
  resolve: (vectors: Float32Array[]) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let loadPromise: Promise<void> | null = null;
let ready = false;
const files = new Map<string, { loaded: number; total: number }>();
const waiters = new Map<number, Waiter>();
let nextId = 0;
let chain: Promise<unknown> = Promise.resolve();

function postProgress(note: ProgressNote) {
  const key = note.file || note.name || "model";
  if (typeof note.total === "number" && note.total > 0) {
    files.set(key, { loaded: note.loaded ?? Math.round(((note.progress ?? 0) / 100) * note.total), total: note.total });
  }
  let loaded = 0;
  let total = 0;
  for (const file of files.values()) {
    loaded += file.loaded;
    total += file.total;
  }
  const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : Math.round(note.progress ?? 0);
  const downloading = note.status === "download" || note.status === "progress";
  if (downloading) setBrain({ phase: "downloading", progress });
}

function onMessage(event: MessageEvent<WorkerOut>) {
  const message = event.data;
  if (message.type === "progress") {
    postProgress(message.note);
    return;
  }
  if (message.type === "ready") {
    ready = true;
    setBrain({ phase: "ready", progress: 100 });
    return;
  }
  if (message.type === "result") {
    waiters.get(message.id)?.resolve(message.embeddings);
    waiters.delete(message.id);
    return;
  }
  if (message.type === "error") {
    if (message.id === undefined) {
      ready = false;
      setBrain({ phase: "failed", progress: 0 });
      return;
    }
    waiters.get(message.id)?.reject(new Error(message.message));
    waiters.delete(message.id);
  }
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" });
  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", () => {
    ready = false;
    setBrain({ phase: "failed", progress: 0 });
    loadPromise = null;
    for (const waiter of waiters.values()) waiter.reject(new Error("The study brain stopped."));
    waiters.clear();
  });
  return worker;
}

/** Starts the one-time model download. Later calls reuse the cached model. */
export function kickEmbedder() {
  if (typeof window === "undefined") return;
  if (ready || getBrain().phase === "failed") return;
  if (getBrain().phase === "idle") setBrain({ phase: "downloading", progress: 0 });
  if (!loadPromise) {
    loadPromise = new Promise<void>((resolve, reject) => {
      try {
        getWorker().postMessage({ type: "load" });
      } catch {
        setBrain({ phase: "failed", progress: 0 });
        reject(new Error("The study brain could not start."));
        return;
      }
      const stop = subscribeBrain(() => {
        const phase = getBrain().phase;
        if (phase === "ready") {
          stop();
          resolve();
        } else if (phase === "failed") {
          stop();
          reject(new Error("The study brain could not download."));
        }
      });
    });
    loadPromise.catch(() => undefined);
  }
}

export function isEmbedderReady() {
  return ready;
}

export function embedTexts(texts: string[]) {
  if (!ready) return Promise.reject(new Error("not-ready"));
  if (texts.length === 0) return Promise.resolve([]);
  const run = chain.then(
    () =>
      new Promise<Float32Array[]>((resolve, reject) => {
        const id = ++nextId;
        waiters.set(id, { resolve, reject });
        getWorker().postMessage({ type: "embed", id, texts });
      }),
  );
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
