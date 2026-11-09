"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { OrbCanvas } from "@/components/live/OrbCanvas";
import { useListen } from "@/components/listen/ListenProvider";
import { ReviewedIndex } from "@/components/library/NoteSearch";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { getDb, type ChatSource, type NotePage, type Subject, type Topic } from "@/lib/db";
import { shownPages, shownSubjects, shownTopics } from "@/lib/demo";
import { openMicMeter, type MicMeter } from "@/lib/live/mic";
import {
  createRecognition,
  safeAbort,
  safeStart,
  safeStop,
  speechRecognitionSupported,
  type LiveRecognition,
} from "@/lib/live/recog";
import { readySentences } from "@/lib/live/sentences";
import { LiveSpeaker } from "@/lib/live/speak-live";
import { LIVE_QUICK, LIVE_SILENCE_MS, type LivePhase } from "@/lib/live/types";
import { isSpeechRate } from "@/lib/listen/rates";
import { stopSpeaking } from "@/lib/listen/speak";
import { search } from "@/lib/rag/search";
import { plainTutorText } from "@/lib/tutor/plain";
import { readTutorStream } from "@/lib/tutor/stream";
import { addChatMessage, bumpLiveTutorSession, makeChatMessage } from "@/lib/tutor/store";
import { isNotebookError, useNotebook } from "@/lib/use-notebook";

function pageLabel(pages: NotePage[], subjects: Subject[], topics: Topic[], pageId: string, topicId: string, subjectId: string) {
  const subject = subjects.find((item) => item.id === subjectId)?.name ?? "Notes";
  const topic = topics.find((item) => item.id === topicId)?.name ?? "Topic";
  const siblings = pages.filter((page) => page.topicId === topicId).sort((left, right) => left.createdAt - right.createdAt);
  const index = siblings.findIndex((page) => page.id === pageId);
  return `${subject} > ${topic} > page ${index >= 0 ? index + 1 : 1}`;
}

export function LiveTutorScreen() {
  const notebook = useNotebook();
  const listen = useListen();
  const router = useRouter();
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [caption, setCaption] = useState("");
  const [captionKey, setCaptionKey] = useState(0);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [autoInterrupt, setAutoInterrupt] = useState(false);
  const [error, setError] = useState("");
  const [textMode, setTextMode] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);

  const phaseRef = useRef<LivePhase>("idle");
  const mutedRef = useRef(false);
  const autoRef = useRef(false);
  const subjectRef = useRef("");
  const busyRef = useRef(false);
  const countedRef = useRef(false);
  const historyRef = useRef<{ role: "user" | "tutor"; text: string }[]>([]);
  const lastUserRef = useRef("");
  const finalBufRef = useRef("");
  const silenceRef = useRef(0);
  const recognitionRef = useRef<LiveRecognition | null>(null);
  const wantListenRef = useRef(false);
  const micRef = useRef<MicMeter | null>(null);
  const speakerRef = useRef<LiveSpeaker | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ampRef = useRef(0);
  const pagesRef = useRef<NotePage[]>([]);
  const subjectsRef = useRef<Subject[]>([]);
  const topicsRef = useRef<Topic[]>([]);
  const askRef = useRef<(question: string) => void>(() => undefined);

  phaseRef.current = phase;
  mutedRef.current = muted;
  autoRef.current = autoInterrupt;
  subjectRef.current = subjectId;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    listen.close();
    // The Live room owns speech. The library player must stay quiet here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    const speaker = new LiveSpeaker({
      onAmplitude: (value) => {
        ampRef.current = value;
        if (phaseRef.current === "speaking") setLevel(value);
      },
      onSentence: (text) => {
        setCaption(text);
        setCaptionKey((value) => value + 1);
      },
      onIdle: () => {
        if (phaseRef.current === "speaking") {
          setPhase("listening");
          phaseRef.current = "listening";
          resumeListening();
        }
      },
      onError: (message) => setError(message),
    });
    speakerRef.current = speaker;

    void (async () => {
      const settings = await getDb().settings.get("local").catch(() => undefined);
      const rate = settings && isSpeechRate(settings.speechRate) ? settings.speechRate : 1;
      const voiceURI = settings?.voiceURI ?? "";
      speaker.setVoice(rate, voiceURI);

      const supported = speechRecognitionSupported();
      if (!supported) {
        if (!live) return;
        setTextMode(true);
        setError("Voice typing needs Chrome on Android or desktop, with internet and HTTPS. Type below. The orb and voice still work.");
        setReady(true);
        setPhase("idle");
        return;
      }

      const meter = await openMicMeter();
      if (!live) {
        meter?.stop();
        return;
      }
      if (!meter) {
        setTextMode(true);
        setError("Microphone permission was denied. Type below. The orb and voice still work.");
        setReady(true);
        setPhase("idle");
        return;
      }
      micRef.current = meter;

      const recognition = createRecognition();
      recognitionRef.current = recognition;
      if (recognition) {
        recognition.onresult = (event) => {
          if (mutedRef.current) return;
          if (phaseRef.current === "speaking" && !autoRef.current) return;
          if (phaseRef.current === "thinking") return;

          if (phaseRef.current === "speaking" && autoRef.current) {
            interrupt();
          }

          let interim = "";
          let finals = finalBufRef.current;
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const row = event.results[index];
            if (!row) continue;
            const piece = row[0]?.transcript?.trim() ?? "";
            if (!piece) continue;
            if (row.isFinal) {
              finals = `${finals} ${piece}`.trim();
            } else {
              interim = piece;
            }
          }
          finalBufRef.current = finals;
          const shown = `${finals} ${interim}`.trim();
          if (shown) {
            setCaption(shown);
            setCaptionKey((value) => value + 1);
            if (phaseRef.current === "idle" || phaseRef.current === "listening") {
              setPhase("listening");
              phaseRef.current = "listening";
            }
          }
          window.clearTimeout(silenceRef.current);
          silenceRef.current = window.setTimeout(() => {
            const text = finalBufRef.current.trim();
            if (!text || busyRef.current) return;
            finalBufRef.current = "";
            askRef.current(text);
          }, LIVE_SILENCE_MS);
        };
        recognition.onerror = (event) => {
          if (event.error === "aborted" || event.error === "no-speech") return;
          if (event.error === "not-allowed") {
            setTextMode(true);
            setError("Microphone permission was denied. Type below. The orb and voice still work.");
            wantListenRef.current = false;
            return;
          }
          if (event.error === "network") {
            setError("Speech recognition needs internet. Check the connection, or type below.");
            setTextMode(true);
          }
        };
        recognition.onend = () => {
          if (wantListenRef.current && !mutedRef.current && (phaseRef.current === "idle" || phaseRef.current === "listening")) {
            safeStart(recognitionRef.current);
          }
        };
      }

      wantListenRef.current = true;
      setPhase("listening");
      phaseRef.current = "listening";
      safeStart(recognition);
      setReady(true);
    })();

    const ampLoop = window.setInterval(() => {
      const current = phaseRef.current;
      if (current === "listening" && !mutedRef.current && micRef.current) {
        setLevel(micRef.current.level());
        return;
      }
      if (current === "speaking") {
        setLevel(ampRef.current);
        return;
      }
      setLevel(0);
    }, 50);

    return () => {
      live = false;
      wantListenRef.current = false;
      window.clearTimeout(silenceRef.current);
      window.clearInterval(ampLoop);
      abortRef.current?.abort();
      speaker.stop();
      stopSpeaking();
      safeAbort(recognitionRef.current);
      recognitionRef.current = null;
      micRef.current?.stop();
      micRef.current = null;
    };
    // Mount once for the room lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resumeListening() {
    if (textMode || mutedRef.current) {
      setPhase("idle");
      phaseRef.current = "idle";
      return;
    }
    wantListenRef.current = true;
    setPhase("listening");
    phaseRef.current = "listening";
    safeStart(recognitionRef.current);
  }

  function pauseListening() {
    wantListenRef.current = false;
    window.clearTimeout(silenceRef.current);
    safeStop(recognitionRef.current);
  }

  function interrupt() {
    abortRef.current?.abort();
    abortRef.current = null;
    speakerRef.current?.stop();
    stopSpeaking();
    busyRef.current = false;
    finalBufRef.current = "";
    setCaption("");
    resumeListening();
  }

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busyRef.current) return;
    busyRef.current = true;
    pauseListening();
    speakerRef.current?.stop();
    stopSpeaking();
    setError("");
    setSources([]);
    setSourcesOpen(false);
    setCaption(question);
    setCaptionKey((value) => value + 1);
    setPhase("thinking");
    phaseRef.current = "thinking";

    if (!countedRef.current) {
      countedRef.current = true;
      void bumpLiveTutorSession().catch(() => undefined);
    }

    const history = historyRef.current.slice(-6);
    const lastUser = lastUserRef.current;
    const retrieval =
      (LIVE_QUICK as readonly string[]).includes(question) && lastUser ? `${lastUser}. ${question}` : question;

    const userMessage = makeChatMessage({
      role: "user",
      text: question,
      subjectId: subjectRef.current || undefined,
    });
    try {
      await addChatMessage(userMessage);
    } catch {
      busyRef.current = false;
      setError("That question could not be saved on this device.");
      resumeListening();
      return;
    }
    historyRef.current = [...historyRef.current, { role: "user" as const, text: question }].slice(-6);
    lastUserRef.current = question;

    let answerSources: ChatSource[] = [];
    let chunks: { label: string; text: string }[] = [];
    try {
      const found = await search(retrieval, { subjectId: subjectRef.current || undefined, k: 4 });
      const labelled = found.hits.map((hit) => ({
        pageId: hit.pageId,
        topicId: hit.topicId,
        subjectId: hit.subjectId,
        label: pageLabel(pagesRef.current, subjectsRef.current, topicsRef.current, hit.pageId, hit.topicId, hit.subjectId),
        text: hit.text,
      }));
      answerSources = labelled.filter(
        (source, index) => labelled.findIndex((item) => item.pageId === source.pageId) === index,
      );
      chunks = labelled
        .map((hit) => ({ label: hit.label.slice(0, 160), text: hit.text.trim().slice(0, 2000) }))
        .filter((hit) => hit.label && hit.text);
    } catch {
      answerSources = [];
      chunks = [];
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let full = "";
    let spokenCursor = 0;
    let startedSpeaking = false;

    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, history, chunks, spoken: true }),
        signal: controller.signal,
      });
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("text/event-stream")) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        const message = payload && typeof payload.error === "string" ? payload.error : "The tutor could not answer just now.";
        throw new Error(message);
      }

      full = plainTutorText(
        await readTutorStream(response, (text) => {
          if (controller.signal.aborted) return;
          const plain = plainTutorText(text);
          const { sentences, cursor } = readySentences(plain, spokenCursor, false);
          if (sentences.length > 0) {
            spokenCursor = cursor;
            if (!startedSpeaking) {
              startedSpeaking = true;
              setPhase("speaking");
              phaseRef.current = "speaking";
              if (!autoRef.current) pauseListening();
              else {
                wantListenRef.current = true;
                safeStart(recognitionRef.current);
              }
            }
            speakerRef.current?.enqueue(sentences);
          }
        }),
      );

      if (controller.signal.aborted) return;
      const plain = plainTutorText(full);
      if (!plain) throw new Error("The tutor came back with an empty answer. Try again.");
      const { sentences, cursor } = readySentences(plain, spokenCursor, true);
      spokenCursor = cursor;
      if (sentences.length > 0) {
        if (!startedSpeaking) {
          startedSpeaking = true;
          setPhase("speaking");
          phaseRef.current = "speaking";
          if (!autoRef.current) pauseListening();
        }
        speakerRef.current?.enqueue(sentences);
      }

      await addChatMessage(
        makeChatMessage({
          role: "tutor",
          text: plain,
          subjectId: subjectRef.current || undefined,
          sources: answerSources,
        }),
      );
      historyRef.current = [...historyRef.current, { role: "tutor" as const, text: plain }].slice(-6);
      setSources(answerSources);
      if (answerSources.length > 0) setSourcesOpen(true);

      if (!speakerRef.current?.busy) {
        resumeListening();
      }
    } catch (caught) {
      if (controller.signal.aborted) return;
      const partial = plainTutorText(full).trim();
      if (partial) {
        await addChatMessage(
          makeChatMessage({
            role: "tutor",
            text: partial,
            subjectId: subjectRef.current || undefined,
            sources: answerSources,
          }),
        ).catch(() => undefined);
        historyRef.current = [...historyRef.current, { role: "tutor" as const, text: partial }].slice(-6);
        setSources(answerSources);
      }
      setError(caught instanceof Error ? caught.message : "The tutor could not answer just now.");
      resumeListening();
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      busyRef.current = false;
    }
  }

  askRef.current = (question) => {
    void ask(question);
  };

  function endSession() {
    wantListenRef.current = false;
    window.clearTimeout(silenceRef.current);
    abortRef.current?.abort();
    speakerRef.current?.stop();
    stopSpeaking();
    safeAbort(recognitionRef.current);
    micRef.current?.stop();
    micRef.current = null;
    router.push("/tutor");
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) {
      pauseListening();
      if (phaseRef.current === "listening") {
        setPhase("idle");
        phaseRef.current = "idle";
      }
    } else if (!textMode && (phaseRef.current === "idle" || phaseRef.current === "listening")) {
      resumeListening();
    }
  }

  if (!notebook) {
    return (
      <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-green-800 to-ink px-4 text-paper">
        <PixelLoader caption="Opening Live Tutor…" />
      </main>
    );
  }

  if (isNotebookError(notebook)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-green-800 to-ink px-4 text-paper">
        <p className="text-lg" role="alert">
          {notebook.error}
        </p>
        <Link className="mt-6 font-semibold underline" href="/tutor">
          Back to Tutor
        </Link>
      </main>
    );
  }

  const subjects = shownSubjects(notebook.subjects);
  const topics = shownTopics(notebook.topics);
  const pages = shownPages(notebook.pages);
  pagesRef.current = pages;
  subjectsRef.current = subjects;
  topicsRef.current = topics;
  const subjectName = subjects.find((item) => item.id === subjectId)?.name ?? "All notes";
  const canQuick = Boolean(lastUserRef.current) && !busyRef.current && phase !== "thinking";

  function onTextSubmit(event: FormEvent) {
    event.preventDefault();
    const value = textInput.trim();
    if (!value) return;
    setTextInput("");
    void ask(value);
  }

  return (
    <main className="relative flex min-h-dvh flex-col bg-gradient-to-b from-green-800 to-ink text-paper">
      <ReviewedIndex pages={pages} />
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="nw-mono text-[12px] text-paper/80">Live Tutor</p>
        <label className="flex items-center gap-2 text-xs text-paper/90">
          <input
            type="checkbox"
            className="size-4 border-2 border-paper accent-yellow"
            checked={autoInterrupt}
            onChange={(event) => {
              setAutoInterrupt(event.target.checked);
              autoRef.current = event.target.checked;
            }}
          />
          Auto-interrupt (use headphones)
        </label>
      </div>

      <div className="relative mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center px-4">
        <div className="relative">
          <OrbCanvas phase={ready ? phase : "idle"} level={level} reducedMotion={reducedMotion} />
          {phase === "speaking" || phase === "thinking" ? (
            <button
              type="button"
              className="absolute inset-0 grid place-items-center rounded-full bg-ink/20 text-center text-sm font-semibold text-paper"
              onClick={interrupt}
            >
              Tap to interrupt
            </button>
          ) : null}
        </div>

        <p
          key={captionKey}
          className="live-caption mt-6 min-h-12 max-w-md text-center text-base text-paper"
          aria-live="polite"
        >
          {caption || (phase === "listening" ? "Listening…" : phase === "thinking" ? "" : "Ask about your notes")}
        </p>

        {phase === "thinking" ? (
          <div className="mt-4">
            <PixelLoader caption="Tutor is thinking…" size={22} />
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 max-w-md border-2 border-paper bg-yellow px-3 py-2 text-sm text-ink" role="alert">
            {error}
          </p>
        ) : null}

        <div className="relative mt-4 min-h-10 w-full max-w-md">
          {sources.length > 0 ? (
            <div className={`live-sources ${sourcesOpen ? "is-open" : ""}`}>
              <button
                type="button"
                className="nw-mono mx-auto block rounded-full border-2 border-paper bg-ink px-4 py-2 text-[12px] text-paper"
                aria-expanded={sourcesOpen}
                onClick={() => setSourcesOpen((open) => !open)}
              >
                Sources
              </button>
              {sourcesOpen ? (
                <ul className="mt-2 flex flex-wrap justify-center gap-2">
                  {sources.map((source) => (
                    <li key={source.pageId}>
                      <Link
                        className="nw-chip bg-yellow text-ink"
                        href={`/library/${source.subjectId}/${source.topicId}/${source.pageId}`}
                      >
                        {source.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[520px] px-4 pb-6">
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {LIVE_QUICK.map((label) => (
            <button
              key={label}
              type="button"
              className="nw-chip min-h-10 border-paper bg-ink/40 text-paper disabled:opacity-50"
              disabled={!canQuick}
              onClick={() => void ask(label)}
            >
              {label}
            </button>
          ))}
        </div>

        {textMode ? (
          <form className="mb-4" onSubmit={onTextSubmit}>
            <label className="sr-only" htmlFor="live-text">
              Type your question
            </label>
            <div className="flex gap-2">
              <input
                id="live-text"
                className="nw-input min-h-12 flex-1 border-paper bg-ink/40 text-paper placeholder:text-paper/50"
                value={textInput}
                maxLength={1000}
                placeholder="Type your question"
                disabled={phase === "thinking" || phase === "speaking"}
                onChange={(event) => setTextInput(event.target.value)}
              />
              <button
                type="submit"
                className="nw-btn min-h-12 px-4"
                disabled={!textInput.trim() || phase === "thinking" || phase === "speaking"}
              >
                Ask
              </button>
            </div>
          </form>
        ) : null}

        <div className="flex items-end justify-center gap-5">
          <button
            type="button"
            className="grid size-14 place-items-center rounded-full border-2 border-paper bg-ink text-paper"
            aria-pressed={muted}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            onClick={toggleMute}
          >
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          <div className="relative">
            <button
              type="button"
              className="nw-chip min-h-12 border-paper bg-ink/50 px-4 text-paper"
              aria-expanded={subjectOpen}
              onClick={() => setSubjectOpen((open) => !open)}
            >
              {subjectName}
            </button>
            {subjectOpen ? (
              <ul className="absolute bottom-14 left-1/2 z-10 max-h-48 w-44 -translate-x-1/2 overflow-y-auto border-2 border-paper bg-ink p-2 shadow-[4px_4px_0_#000]">
                <li>
                  <button
                    type="button"
                    className={`nw-chip mb-1 w-full ${subjectId === "" ? "bg-paper text-ink" : "bg-ink text-paper"}`}
                    onClick={() => {
                      setSubjectId("");
                      setSubjectOpen(false);
                    }}
                  >
                    All notes
                  </button>
                </li>
                {subjects.map((subject) => (
                  <li key={subject.id}>
                    <button
                      type="button"
                      className={`nw-chip mb-1 w-full ${subjectId === subject.id ? "bg-paper text-ink" : "bg-ink text-paper"}`}
                      onClick={() => {
                        setSubjectId(subject.id);
                        setSubjectOpen(false);
                      }}
                    >
                      {subject.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <button
            type="button"
            className="grid size-14 place-items-center rounded-full border-2 border-ink bg-red text-paper"
            aria-label="End Live Tutor"
            onClick={endSession}
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </main>
  );
}
