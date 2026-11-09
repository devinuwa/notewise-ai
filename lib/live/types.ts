export type LivePhase = "idle" | "listening" | "thinking" | "speaking";

export const LIVE_QUICK = ["Explain simpler", "Give an example", "Quiz me on this"] as const;

export const LIVE_SILENCE_MS = 1200;
