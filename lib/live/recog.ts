/** Minimal SpeechRecognition shape. Chrome ships webkitSpeechRecognition. */
export type LiveRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: LiveRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type LiveRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type RecognitionCtor = new () => LiveRecognition;

export function speechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const root = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return root.SpeechRecognition ?? root.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported() {
  return speechRecognitionCtor() !== null;
}

export function createRecognition(lang = "en-NG"): LiveRecognition | null {
  const Ctor = speechRecognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;
  return recognition;
}

/** Safe start. Chrome throws if start() is called while already listening. */
export function safeStart(recognition: LiveRecognition | null) {
  if (!recognition) return;
  try {
    recognition.start();
  } catch {
    // Already started.
  }
}

export function safeStop(recognition: LiveRecognition | null) {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch {
    // Already stopped.
  }
}

export function safeAbort(recognition: LiveRecognition | null) {
  if (!recognition) return;
  try {
    recognition.abort();
  } catch {
    // Already aborted.
  }
}
