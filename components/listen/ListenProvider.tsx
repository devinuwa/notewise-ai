"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ListenCue } from "@/lib/listen/cues";
import { isSpeechRate, type SpeechRate } from "@/lib/listen/rates";
import { speakSentence, stopSpeaking } from "@/lib/listen/speak";
import { getVoiceSnapshot, preferredVoice, subscribeVoices } from "@/lib/listen/voices";
import { saveListenPrefs } from "@/lib/notebook";
import { isNotebookError, useNotebook } from "@/lib/use-notebook";

type Status = "idle" | "playing" | "paused";

type ListenApi = {
  cues: ListenCue[];
  index: number;
  status: Status;
  rate: SpeechRate;
  voiceURI: string;
  error: string;
  start: (cues: ListenCue[]) => void;
  toggle: () => void;
  previous: () => void;
  next: () => void;
  seek: (index: number) => void;
  chooseRate: (rate: SpeechRate) => void;
  chooseVoice: (voiceURI: string) => void;
  close: () => void;
};

const ListenContext = createContext<ListenApi | null>(null);

export function useListen() {
  const value = useContext(ListenContext);
  if (!value) throw new Error("Listen is only available inside the app shell.");
  return value;
}

export function ListenProvider({ children }: { children: React.ReactNode }) {
  const notebook = useNotebook();
  const pathname = usePathname();
  const settings = notebook && !isNotebookError(notebook) ? notebook.settings : null;
  const savedRate = settings && isSpeechRate(settings.speechRate) ? settings.speechRate : 1;
  const savedVoice = settings?.voiceURI ?? "";

  const [cues, setCues] = useState<ListenCue[]>([]);
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [ratePick, setRatePick] = useState<SpeechRate | null>(null);
  const [voicePick, setVoicePick] = useState<string | null>(null);
  const [error, setError] = useState("");

  const rate = ratePick ?? savedRate;
  const voiceURI = voicePick ?? savedVoice;

  const cuesRef = useRef(cues);
  const indexRef = useRef(0);
  const statusRef = useRef<Status>("idle");
  const rateRef = useRef(rate);
  const voiceRef = useRef(voiceURI);
  const finishedRef = useRef(false);
  const pathRef = useRef(pathname);
  const waitRef = useRef<(() => void) | null>(null);

  cuesRef.current = cues;
  statusRef.current = status;
  rateRef.current = rate;
  voiceRef.current = voiceURI;

  function clearWait() {
    waitRef.current?.();
    waitRef.current = null;
  }

  function resolvedVoice() {
    return preferredVoice(getVoiceSnapshot().voices, voiceRef.current)?.voiceURI ?? "";
  }

  function speakCurrent() {
    const cue = cuesRef.current[indexRef.current];
    if (!cue) return;
    speakSentence(cue.text, rateRef.current, resolvedVoice(), {
      onDone: () => {
        const nextIndex = indexRef.current + 1;
        if (nextIndex >= cuesRef.current.length) {
          finishedRef.current = true;
          statusRef.current = "paused";
          setStatus("paused");
          return;
        }
        indexRef.current = nextIndex;
        setIndex(nextIndex);
        speakCurrent();
      },
      onError: (message) => {
        statusRef.current = "paused";
        setStatus("paused");
        setError(message);
      },
    });
  }

  function pause() {
    clearWait();
    stopSpeaking();
    if (statusRef.current !== "playing") return;
    statusRef.current = "paused";
    setStatus("paused");
  }

  function playFromHere() {
    if (cuesRef.current.length === 0) return;
    clearWait();
    const snap = getVoiceSnapshot();
    if (!snap.supported || (snap.settled && snap.voices.length === 0)) {
      statusRef.current = "paused";
      setStatus("paused");
      return;
    }
    if (finishedRef.current) {
      finishedRef.current = false;
      indexRef.current = 0;
      setIndex(0);
    }
    setError("");
    statusRef.current = "playing";
    setStatus("playing");
    if (!snap.settled && snap.voices.length === 0) {
      waitRef.current = subscribeVoices(() => {
        const next = getVoiceSnapshot();
        if (!next.settled && next.voices.length === 0) return;
        clearWait();
        if (statusRef.current !== "playing") return;
        if (next.voices.length === 0 || !next.supported) {
          statusRef.current = "paused";
          setStatus("paused");
          return;
        }
        speakCurrent();
      });
      return;
    }
    speakCurrent();
  }

  function start(next: ListenCue[]) {
    stopSpeaking();
    clearWait();
    finishedRef.current = false;
    cuesRef.current = next;
    indexRef.current = 0;
    setCues(next);
    setIndex(0);
    setError("");
    if (next.length === 0) {
      statusRef.current = "idle";
      setStatus("idle");
      return;
    }
    playFromHere();
  }

  function move(nextIndex: number) {
    if (cuesRef.current.length === 0) return;
    const last = cuesRef.current.length - 1;
    const clamped = Math.max(0, Math.min(last, nextIndex));
    finishedRef.current = false;
    indexRef.current = clamped;
    setIndex(clamped);
    if (statusRef.current === "playing") speakCurrent();
    else stopSpeaking();
  }

  function chooseRate(next: SpeechRate) {
    rateRef.current = next;
    setRatePick(next);
    void saveListenPrefs({ speechRate: next });
    if (statusRef.current === "playing") speakCurrent();
  }

  function chooseVoice(next: string) {
    voiceRef.current = next;
    setVoicePick(next);
    void saveListenPrefs({ voiceURI: next });
    if (statusRef.current === "playing") speakCurrent();
  }

  function close() {
    clearWait();
    finishedRef.current = false;
    stopSpeaking();
    cuesRef.current = [];
    indexRef.current = 0;
    statusRef.current = "idle";
    setCues([]);
    setIndex(0);
    setStatus("idle");
    setError("");
  }

  const controls = useRef({ pause, playFromHere, move });
  useEffect(() => {
    controls.current = { pause, playFromHere, move };
  });

  useEffect(() => {
    return () => {
      clearWait();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (pathRef.current === pathname) return;
    pathRef.current = pathname;
    controls.current.pause();
  }, [pathname]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) controls.current.pause();
    };
    const onPageHide = () => controls.current.pause();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  useEffect(() => {
    if (status !== "playing") return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (!nav.wakeLock) return;
    let released = false;
    let sentinel: WakeLockSentinel | null = null;
    nav.wakeLock
      .request("screen")
      .then((lock) => {
        if (released) {
          void lock.release();
          return;
        }
        sentinel = lock;
      })
      .catch(() => {
        // A phone can refuse the lock. Speaking still works.
      });
    return () => {
      released = true;
      void sentinel?.release();
    };
  }, [status]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const bind = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // This browser does not offer that lock-screen button.
      }
    };
    bind("play", () => {
      if (statusRef.current !== "playing") controls.current.playFromHere();
    });
    bind("pause", () => controls.current.pause());
    bind("previoustrack", () => controls.current.move(indexRef.current - 1));
    bind("nexttrack", () => controls.current.move(indexRef.current + 1));
    return () => {
      bind("play", null);
      bind("pause", null);
      bind("previoustrack", null);
      bind("nexttrack", null);
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const cue = cues[index];
    if (!cue || status === "idle") {
      session.playbackState = "none";
      return;
    }
    session.playbackState = status === "playing" ? "playing" : "paused";
    session.metadata = new MediaMetadata({
      title: cue.text.slice(0, 80),
      artist: "NoteWise AI",
      album: cue.label,
    });
  }, [cues, index, status]);

  const api: ListenApi = {
    cues,
    index,
    status,
    rate,
    voiceURI,
    error,
    start,
    toggle: () => {
      if (statusRef.current === "playing") pause();
      else playFromHere();
    },
    previous: () => move(indexRef.current - 1),
    next: () => move(indexRef.current + 1),
    seek: (next) => move(next),
    chooseRate,
    chooseVoice,
    close,
  };

  return <ListenContext.Provider value={api}>{children}</ListenContext.Provider>;
}
