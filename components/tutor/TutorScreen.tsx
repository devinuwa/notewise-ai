"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { useListen } from "@/components/listen/ListenProvider";
import { ReviewedIndex, StudyBrainLoader } from "@/components/library/NoteSearch";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getDb, type ChatMessage, type ChatSource, type NotePage, type Subject, type Topic } from "@/lib/db";
import { shownPages, shownSubjects, shownTopics } from "@/lib/demo";
import { splitSentences } from "@/lib/listen/sentences";
import { search } from "@/lib/rag/search";
import { isNotebookError, useNotebook } from "@/lib/use-notebook";
import { plainTutorText } from "@/lib/tutor/plain";
import { readTutorStream } from "@/lib/tutor/stream";
import { addChatMessage, clearChat, makeChatMessage } from "@/lib/tutor/store";

const QUICK = ["Explain simpler", "Give an example", "Quiz me on this"] as const;

type Phase = "" | "search" | "think";

function loadMessages() {
  if (typeof indexedDB === "undefined") return Promise.resolve([] as ChatMessage[]);
  return getDb().chatMessages.orderBy("createdAt").toArray();
}

function pageLabel(pages: NotePage[], subjects: Subject[], topics: Topic[], pageId: string, topicId: string, subjectId: string) {
  const subject = subjects.find((item) => item.id === subjectId)?.name ?? "Notes";
  const topic = topics.find((item) => item.id === topicId)?.name ?? "Topic";
  const siblings = pages.filter((page) => page.topicId === topicId).sort((left, right) => left.createdAt - right.createdAt);
  const index = siblings.findIndex((page) => page.id === pageId);
  return `${subject} > ${topic} > page ${index >= 0 ? index + 1 : 1}`;
}

export function TutorScreen() {
  const notebook = useNotebook();
  const messages = useLiveQuery(loadMessages);
  const listen = useListen();
  const [subjectId, setSubjectId] = useState("");
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const clearRef = useRef(false);
  const draftRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages?.length, draft, phase]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!notebook || !messages) {
    return (
      <main className="nw-page mx-auto grid w-full max-w-[760px] place-items-center">
        <PixelLoader caption="Opening the tutor…" tone="on-paper" />
      </main>
    );
  }

  if (isNotebookError(notebook)) {
    return (
      <main className="nw-page mx-auto w-full max-w-[720px]">
        <p className="text-lg text-ink" role="alert">
          {notebook.error}
        </p>
      </main>
    );
  }

  const subjects = shownSubjects(notebook.subjects);
  const topics = shownTopics(notebook.topics);
  const pages = shownPages(notebook.pages);
  const busy = phase !== "";
  const lastTutor = [...messages].reverse().find((message) => message.role === "tutor");

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || busyRef.current) return;
    busyRef.current = true;
    draftRef.current = "";
    setPhase("search");
    setError("");
    setConfirmClear(false);
    setDraft("");
    const history = messages
      .slice(-6)
      .map((message) => ({ role: message.role, text: message.text }));
    const lastUser = [...messages].reverse().find((message) => message.role === "user")?.text ?? "";
    // A follow-up chip is too short to search on its own, so the previous question stays in the search.
    const retrieval =
      (QUICK as readonly string[]).includes(question) && lastUser ? `${lastUser}. ${question}` : question;

    const userMessage = makeChatMessage({
      role: "user",
      text: question,
      subjectId: subjectId || undefined,
    });

    try {
      await addChatMessage(userMessage);
    } catch {
      busyRef.current = false;
      setPhase("");
      setError("That question could not be saved on this device.");
      return;
    }

    let sources: ChatSource[] = [];
    let chunks: { label: string; text: string }[] = [];
    try {
      const found = await search(retrieval, { subjectId: subjectId || undefined, k: 4 });
      const labelled = found.hits.map((hit) => ({
        pageId: hit.pageId,
        topicId: hit.topicId,
        subjectId: hit.subjectId,
        label: pageLabel(pages, subjects, topics, hit.pageId, hit.topicId, hit.subjectId),
        text: hit.text,
      }));
      sources = labelled.filter(
        (source, index) => labelled.findIndex((item) => item.pageId === source.pageId) === index,
      );
      chunks = labelled
        .map((hit) => ({ label: hit.label.slice(0, 160), text: hit.text.trim().slice(0, 2000) }))
        .filter((hit) => hit.label && hit.text);
    } catch {
      sources = [];
      chunks = [];
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("think");
    let full = "";

    try {
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, history, chunks }),
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
          const shown = plainTutorText(text);
          draftRef.current = shown;
          if (!controller.signal.aborted) setDraft(shown);
        }),
      );
      if (!full) throw new Error("The tutor came back with an empty answer. Try again.");
      await addChatMessage(
        makeChatMessage({
          role: "tutor",
          text: full,
          subjectId: subjectId || undefined,
          sources,
        }),
      );
      if (!controller.signal.aborted) setDraft("");
    } catch (caught) {
      const stopped = controller.signal.aborted || clearRef.current;
      const partial = plainTutorText(full || draftRef.current).trim();
      if (partial && !clearRef.current) {
        await addChatMessage(
          makeChatMessage({
            role: "tutor",
            text: partial,
            subjectId: subjectId || undefined,
            sources,
          }),
        ).catch(() => undefined);
      }
      if (!stopped) {
        setError(caught instanceof Error ? caught.message : "The tutor could not answer just now.");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      busyRef.current = false;
      if (!controller.signal.aborted) {
        setPhase("");
        setDraft("");
      }
    }
  }

  function speak(message: ChatMessage) {
    const cues = splitSentences(plainTutorText(message.text)).map((slice) => ({
      pageId: message.sources?.[0]?.pageId ?? "tutor",
      start: slice.start,
      end: slice.end,
      text: slice.text,
      label: "Tutor",
    }));
    listen.start(cues);
  }

  async function copy(message: ChatMessage) {
    const text = plainTutorText(message.text);
    let wrote = false;
    try {
      await navigator.clipboard.writeText(text);
      wrote = true;
    } catch {
      // Some browsers block the clipboard until a fallback selection is used.
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-999px";
      document.body.appendChild(area);
      area.select();
      wrote = document.execCommand("copy");
      area.remove();
    }
    if (!wrote) {
      setError("The answer could not be copied.");
      return;
    }
    setError("");
    setCopiedId(message.id);
    window.setTimeout(() => {
      setCopiedId((current) => (current === message.id ? "" : current));
    }, 2000);
  }

  async function wipe() {
    clearRef.current = true;
    abortRef.current?.abort();
    setDraft("");
    setPhase("");
    setError("");
    try {
      await clearChat();
      setConfirmClear(false);
    } catch {
      setError("The chat could not be cleared.");
    } finally {
      clearRef.current = false;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setInput("");
    void ask(value);
  }

  return (
    <main className="nw-page mx-auto w-full max-w-[760px]">
      <ReviewedIndex pages={pages} />
      <p className="nw-mono text-[12px] text-muted">Tutor</p>
      <div className="mt-3">
        <SectionHeading before="Ask your" highlight="notes" />
      </div>
      <p className="mt-4 max-w-xl text-lg text-ink">
        The tutor reads the matching reviewed pages, then answers. Your question and those notes are sent to the tutor.
        The chat stays on this device.
      </p>
      <StudyBrainLoader />

      <div className="mt-6" role="group" aria-label="Which notes to use">
        <p className="nw-mono text-[12px] text-muted">Subject</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <SubjectChip pressed={subjectId === ""} onClick={() => setSubjectId("")}>
            All notes
          </SubjectChip>
          {subjects.map((subject) => (
            <SubjectChip key={subject.id} pressed={subjectId === subject.id} onClick={() => setSubjectId(subject.id)}>
              {subject.name}
            </SubjectChip>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3" aria-live="polite">
        {messages.length === 0 && !busy ? (
          <p className="border-2 border-ink bg-paper px-4 py-3 text-ink shadow-[4px_4px_0_var(--shadow)]">
            Ask about a reviewed note, such as how cells divide. Pages that still need review stay out.
          </p>
        ) : null}
        {messages.map((message) => (
          <Bubble
            key={message.id}
            message={message}
            copied={copiedId === message.id}
            onCopy={() => void copy(message)}
            onListen={() => speak(message)}
          />
        ))}
        {phase === "search" ? <PixelLoader caption="Looking through your notes…" tone="on-paper" /> : null}
        {phase === "think" && !draft ? <PixelLoader caption="Tutor is thinking…" tone="on-paper" /> : null}
        {draft ? (
          <article className="max-w-[95%] border-2 border-ink bg-paper px-4 py-3 text-ink shadow-[4px_4px_0_var(--shadow)]">
            <p className="whitespace-pre-wrap text-base leading-relaxed">{draft}</p>
            <div className="mt-3">
              <PixelLoader caption="Still writing…" size={18} tone="on-paper" />
            </div>
          </article>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <p className="mt-4 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {QUICK.map((label) => (
          <button
            key={label}
            type="button"
            className="nw-chip min-h-11 bg-paper text-ink disabled:opacity-60"
            disabled={busy || !lastTutor}
            onClick={() => void ask(label)}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="mt-4" onSubmit={onSubmit}>
        <label className="nw-mono text-[12px] text-muted" htmlFor="tutor-question">
          Your question
        </label>
        <textarea
          id="tutor-question"
          className="nw-input mt-2 min-h-24 resize-y"
          value={input}
          maxLength={1000}
          placeholder="Ask about mitosis or osmosis"
          disabled={busy}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="mt-3 flex flex-wrap gap-3">
          <Button type="submit" disabled={busy || !input.trim()}>
            Ask
          </Button>
          {confirmClear ? (
            <>
              <Button type="button" variant="secondary" onClick={() => void wipe()}>
                Clear these questions
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirmClear(false)}>
                Keep chat
              </Button>
            </>
          ) : (
            <Button type="button" variant="secondary" disabled={busy || messages.length === 0} onClick={() => setConfirmClear(true)}>
              Clear chat
            </Button>
          )}
        </div>
        {confirmClear ? (
          <p className="mt-3 text-sm text-ink">Clearing the chat also resets Ask the Tutor on Home.</p>
        ) : null}
      </form>

      <p className="mt-6 text-sm text-ink">
        Prefer talking? Open{" "}
        <Link className="font-semibold underline" href="/tutor/live">
          Live Tutor
        </Link>{" "}
        for a full-screen voice room with your notes.
      </p>
    </main>
  );
}

function SubjectChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      className={`nw-chip min-h-11 shrink-0 ${pressed ? "bg-ink text-paper" : "bg-paper text-ink"}`}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Bubble({
  message,
  copied,
  onCopy,
  onListen,
}: {
  message: ChatMessage;
  copied: boolean;
  onCopy: () => void;
  onListen: () => void;
}) {
  const mine = message.role === "user";
  return (
    <article
      className={`max-w-[95%] border-2 border-ink px-4 py-3 text-ink shadow-[4px_4px_0_var(--shadow)] ${
        mine ? "ml-auto bg-salmon" : "bg-paper"
      }`}
    >
      <p className="nw-mono text-[12px]">{mine ? "You" : "Tutor"}</p>
      <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{plainTutorText(message.text)}</p>
      {message.role === "tutor" ? (
        <>
          {message.sources && message.sources.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {message.sources.map((source) => (
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
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="nw-btn nw-btn-secondary min-h-11 px-3" onClick={onCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className="nw-btn nw-btn-secondary min-h-11 px-3" onClick={onListen}>
              Listen
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}
