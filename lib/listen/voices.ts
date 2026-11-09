"use client";

import { useSyncExternalStore } from "react";

export type VoiceSnapshot = {
  voices: SpeechSynthesisVoice[];
  settled: boolean;
  supported: boolean;
};

const EMPTY: VoiceSnapshot = { voices: [], settled: false, supported: true };

let snapshot: VoiceSnapshot = EMPTY;
let started = false;
const listeners = new Set<() => void>();

function sameVoices(left: SpeechSynthesisVoice[], right: SpeechSynthesisVoice[]) {
  if (left.length !== right.length) return false;
  return left.every((voice, index) => voice.voiceURI === right[index]?.voiceURI && voice.lang === right[index]?.lang);
}

function publish(next: VoiceSnapshot) {
  if (
    next.settled === snapshot.settled &&
    next.supported === snapshot.supported &&
    sameVoices(next.voices, snapshot.voices)
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function readVoices(settled: boolean) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    publish({ voices: [], settled: true, supported: false });
    return;
  }
  const voices = window.speechSynthesis.getVoices();
  publish({
    voices,
    settled: settled || voices.length > 0,
    supported: true,
  });
}

function ensure() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!window.speechSynthesis) {
    publish({ voices: [], settled: true, supported: false });
    return;
  }
  const onChange = () => readVoices(true);
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  readVoices(false);
  window.setTimeout(() => readVoices(true), 1200);
}

export function getVoiceSnapshot() {
  ensure();
  return snapshot;
}

export function getServerVoices() {
  return EMPTY;
}

export function subscribeVoices(listener: () => void) {
  listeners.add(listener);
  ensure();
  return () => listeners.delete(listener);
}

export function useVoices() {
  return useSyncExternalStore(subscribeVoices, () => snapshot, getServerVoices);
}

function langOf(voice: SpeechSynthesisVoice) {
  return voice.lang.replace(/_/g, "-").toLowerCase();
}

const PREFERRED = ["en-ng", "en-gb", "en-us"];

export function preferredVoice(voices: SpeechSynthesisVoice[], savedURI?: string) {
  if (savedURI) {
    const saved = voices.find((voice) => voice.voiceURI === savedURI);
    if (saved) return saved;
  }
  for (const lang of PREFERRED) {
    const match = voices.find((voice) => langOf(voice).startsWith(lang));
    if (match) return match;
  }
  return voices.find((voice) => langOf(voice).startsWith("en")) ?? voices[0] ?? null;
}

/** Only returns a voice whose lang matches one of the BCP-47 prefixes. No silent English fallback. */
export function voiceForLanguageTags(voices: SpeechSynthesisVoice[], tags: string[], savedURI?: string) {
  const prefixes = tags.map((tag) => tag.replace(/_/g, "-").toLowerCase());
  const matches = (voice: SpeechSynthesisVoice) => prefixes.some((tag) => langOf(voice).startsWith(tag));
  if (savedURI) {
    const saved = voices.find((voice) => voice.voiceURI === savedURI && matches(voice));
    if (saved) return saved;
  }
  return voices.find(matches) ?? null;
}

export function orderedVoices(voices: SpeechSynthesisVoice[]) {
  const rank = (voice: SpeechSynthesisVoice) => {
    const lang = langOf(voice);
    const index = PREFERRED.findIndex((item) => lang.startsWith(item));
    if (index >= 0) return index;
    if (lang.startsWith("en")) return PREFERRED.length;
    return PREFERRED.length + 1;
  };
  return [...voices].sort((left, right) => rank(left) - rank(right) || left.name.localeCompare(right.name));
}
