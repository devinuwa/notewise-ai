export const SPEECH_RATES = [0.75, 1, 1.25, 1.5] as const;

export type SpeechRate = (typeof SPEECH_RATES)[number];

export function isSpeechRate(value: unknown): value is SpeechRate {
  return typeof value === "number" && (SPEECH_RATES as readonly number[]).includes(value);
}

export function rateLabel(rate: SpeechRate) {
  return `${rate}x`;
}
