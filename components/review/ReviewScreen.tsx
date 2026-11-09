"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { PageImage } from "@/components/review/PageImage";
import { StudyBrainLoader } from "@/components/library/NoteSearch";
import { getDb, type NotePage, type Subject, type Topic } from "@/lib/db";
import type { FlaggedWord } from "@/lib/ocr/types";
import { kickOcrQueue } from "@/lib/ocr/queue";
import { setSessionBusy } from "@/lib/pwa/session-busy";
import { asFlags, dropFlag, markPageDone, replaceFlag, savePageDraft, sentenceParts } from "@/lib/review";
import { isNotebookError, useNotebook } from "@/lib/use-notebook";

type Mode = "flags" | "text";

export function ReviewScreen({ pageId }: { pageId: string }) {
  const notebook = useNotebook();

  if (!notebook) {
    return (
      <main className="nw-page mx-auto grid w-full max-w-[1100px] place-items-center">
        <PixelLoader caption="Opening this page…" tone="on-paper" />
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

  const page = notebook.pages.find((item) => item.id === pageId);
  if (!page) {
    return (
      <main className="nw-page mx-auto w-full max-w-[720px]">
        <p className="text-lg text-ink">That page is not on this device.</p>
        <div className="mt-6">
          <Button href="/library">Back to the library</Button>
        </div>
      </main>
    );
  }

  const subject = notebook.subjects.find((item) => item.id === page.subjectId);
  const topic = notebook.topics.find((item) => item.id === page.topicId);
  if (page.ocrStatus === "queued" || page.ocrStatus === "reading" || page.ocrStatus === "error") {
    return <ReadProgress page={page} subject={subject} topic={topic} />;
  }
  return (
    <CorrectionEditor
      key={`${page.id}-ready`}
      page={page}
      kicker={`${subject?.name ?? "Note"}${topic ? ` · ${topic.name}` : ""}`}
      doneLabel="Done, save to library"
      doneCaption="Saved to your library"
      doneHref={`/library/${page.subjectId}/${page.topicId}/${page.id}`}
      doneLinkLabel="See it in the library"
      backLabel="Back to the library"
      backHref="/library"
      showIndexHint
      saveDraft={(draft) => savePageDraft(page.id, draft)}
      markDone={(draft) => markPageDone(page.id, draft)}
    />
  );
}

function ReadProgress({
  page,
  subject,
  topic,
}: {
  page: NotePage;
  subject: Subject | undefined;
  topic: Topic | undefined;
}) {
  const label = `${subject?.name ?? "Note"} ${topic?.name ?? ""}`.trim();
  const waiting = page.ocrStatus === "queued" || page.ocrStatus === "reading";
  const caption = page.ocrStatus === "queued" ? "Queued" : page.ocrStatus === "reading" ? "Reading" : "Could not read";

  async function retry() {
    await getDb().notePages.update(page.id, { ocrStatus: "queued", ocrError: "" });
    kickOcrQueue();
  }

  return (
    <main className="nw-page mx-auto w-full max-w-[1100px]">
      <p className="nw-mono text-[12px] text-muted">
        {subject?.name ?? "Note"}
        {topic ? ` · ${topic.name}` : ""}
      </p>
      <div className="mt-3">
        <SectionHeading before="Check this" highlight="page" />
      </div>
      <p className="nw-mono mt-3 text-[12px] text-ink">{caption}</p>
      <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
        <PageImage blob={page.imageBlob} label={label} />
        <section aria-live="polite">
          {waiting ? <PixelLoader caption={caption} tone="on-paper" /> : null}
          {page.ocrStatus === "error" ? (
            <div className="border-2 border-ink bg-yellow px-3 py-3 text-ink" role="alert">
              <p>{page.ocrError || "This page could not be read. The photo is still saved."}</p>
              <div className="mt-3">
                <Button type="button" variant="secondary" onClick={() => void retry()}>
                  Retry
                </Button>
              </div>
            </div>
          ) : null}
          <p className="mt-4 whitespace-pre-wrap text-lg leading-relaxed text-ink">
            {page.text || (waiting ? "Waiting for the first words." : "")}
          </p>
        </section>
      </div>
    </main>
  );
}

export type CorrectionDraft = {
  text: string;
  flaggedWords: FlaggedWord[];
  flagsFixed: number;
};

export function CorrectionEditor({
  page,
  kicker,
  doneLabel,
  doneCaption,
  doneHref,
  doneLinkLabel,
  backLabel,
  backHref,
  showIndexHint,
  emptyPhoto,
  minText = 0,
  notice,
  saveDraft,
  markDone,
}: {
  page: {
    id: string;
    imageBlob: Blob;
    text: string;
    flaggedWords: FlaggedWord[];
    flagsFixed?: number;
    ocrStatus?: string;
    ocrProvider?: string;
  };
  kicker: string;
  doneLabel: string;
  doneCaption: string;
  doneHref: string;
  doneLinkLabel: string;
  backLabel: string;
  backHref: string;
  showIndexHint: boolean;
  emptyPhoto?: string;
  minText?: number;
  notice?: string;
  saveDraft: (draft: CorrectionDraft) => Promise<void>;
  markDone: (draft: CorrectionDraft) => Promise<void>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(asFlags(page.flaggedWords, page.text).length > 0 ? "flags" : "text");
  const [text, setText] = useState(page.text);
  const [flags, setFlags] = useState(() => asFlags(page.flaggedWords, page.text));
  const [fixed, setFixed] = useState(page.flagsFixed ?? 0);
  const [saved, setSaved] = useState(true);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const dirty = useRef(false);
  const closed = useRef(false);
  const saveDraftRef = useRef(saveDraft);

  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

  useEffect(() => {
    // Block PWA reload while a draft has not finished writing to Dexie.
    setSessionBusy(`edit:${page.id}`, !saved);
    return () => setSessionBusy(`edit:${page.id}`, false);
  }, [page.id, saved]);

  useEffect(() => {
    if (!dirty.current || closed.current) return;
    const snapshot = { text, flaggedWords: flags, flagsFixed: fixed };
    const handle = window.setTimeout(() => {
      if (closed.current) return;
      void saveDraftRef.current(snapshot)
        .then(() => setSaved(true))
        .catch(() => setError("The correction could not be saved on this device."));
    }, 600);
    return () => window.clearTimeout(handle);
  }, [text, flags, fixed]);

  async function finish() {
    if (text.trim().length < minText) {
      setError("Type the questions on this page before you finish.");
      return;
    }
    closed.current = true;
    setError("");
    try {
      await markDone({ text, flaggedWords: flags, flagsFixed: fixed });
      setDone(true);
    } catch {
      closed.current = false;
      setError("The page could not be marked done.");
    }
  }

  if (done) {
    return (
      <main className="nw-page mx-auto grid min-h-[50vh] w-full max-w-[720px] place-items-center">
        <div className="text-center">
          <PixelLoader caption={doneCaption} tone="on-paper" />
          {showIndexHint ? <StudyBrainLoader /> : null}
          <div className="mt-8">
            <Button href={doneHref}>{doneLinkLabel}</Button>
          </div>
        </div>
      </main>
    );
  }

  const label = kicker;

  return (
    <main className="nw-page mx-auto w-full max-w-[1100px]">
      <p className="nw-mono text-[12px] text-muted">{kicker}</p>
      <div className="mt-3">
        <SectionHeading before="Check this" highlight="page" />
      </div>
      {showIndexHint ? <StudyBrainLoader /> : null}
      {page.ocrStatus === "ready" ? <p className="nw-mono mt-3 text-[12px] text-ink">Ready</p> : null}
      {page.ocrProvider === "tesseract" ? (
        <p className="mt-3 max-w-xl border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
          This page was read on this phone. Handwriting accuracy is lower.
        </p>
      ) : null}
      {notice ? (
        <p className="mt-3 max-w-xl border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
          {notice}
        </p>
      ) : null}
      <p className="mt-3 text-base text-ink" role="status">
        {saved ? "Saved on this device." : "Saving…"}
      </p>
      <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
        <PageImage blob={page.imageBlob} label={label} emptyLabel={emptyPhoto} />
        <section>
          <div className="flex flex-col gap-3 sm:flex-row" role="group" aria-label="How to correct">
            <Button type="button" variant={mode === "flags" ? "primary" : "secondary"} aria-pressed={mode === "flags"} onClick={() => setMode("flags")}>
              Fix flagged words
            </Button>
            <Button type="button" variant={mode === "text" ? "primary" : "secondary"} aria-pressed={mode === "text"} onClick={() => setMode("text")}>
              Edit full text
            </Button>
          </div>
          {mode === "flags" ? (
            <FlagMode
              text={text}
              flags={flags}
              onText={(value) => {
                dirty.current = true;
                setSaved(false);
                setText(value);
              }}
              onFlags={(value) => {
                dirty.current = true;
                setSaved(false);
                setFlags(value);
              }}
              onFixed={() => {
                dirty.current = true;
                setSaved(false);
                setFixed((count) => count + 1);
              }}
            />
          ) : (
            <label className="mt-4 block">
              <span className="nw-mono text-[12px] text-muted">Full text</span>
              <textarea
                className="nw-input mt-2 min-h-64 w-full"
                value={text}
                onChange={(event) => {
                  dirty.current = true;
                  setSaved(false);
                  setText(event.target.value);
                }}
              />
            </label>
          )}
        </section>
      </div>
      {error ? (
        <p className="mt-4 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button type="button" className="w-full sm:w-auto" onClick={() => void finish()}>
          {doneLabel}
        </Button>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => router.push(backHref)}>
          {backLabel}
        </Button>
      </div>
    </main>
  );
}

function FlagMode({
  text,
  flags,
  onText,
  onFlags,
  onFixed,
}: {
  text: string;
  flags: FlaggedWord[];
  onText: (value: string) => void;
  onFlags: (value: FlaggedWord[]) => void;
  onFixed: () => void;
}) {
  const [cursor, setCursor] = useState(0);
  const safe = Math.min(cursor, Math.max(0, flags.length - 1));
  const flag = flags[safe];

  if (!flag) {
    return <p className="mt-4 text-lg text-ink">No flagged words on this page. You can still edit the full text.</p>;
  }

  function accept(replacement: string) {
    const next = replaceFlag(text, flags, safe, replacement);
    onText(next.text);
    onFlags(next.flags);
    onFixed();
  }

  function keep() {
    onFlags(dropFlag(flags, safe));
    onFixed();
  }

  const parts = sentenceParts(text, flag.index, flag.text);

  return (
    <div className="mt-4">
      <p className="nw-mono text-[12px] text-muted">
        Word {safe + 1} of {flags.length}
      </p>
      <FlagStep
        key={`${safe}-${flag.index}-${flag.text}`}
        flag={flag}
        before={parts.before}
        after={parts.after}
        placed={parts.placed}
        onAccept={accept}
        onKeep={keep}
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="secondary" disabled={safe === 0} onClick={() => setCursor(safe - 1)}>
          Previous
        </Button>
        <Button type="button" variant="secondary" disabled={safe >= flags.length - 1} onClick={() => setCursor(safe + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function FlagStep({
  flag,
  before,
  after,
  placed,
  onAccept,
  onKeep,
}: {
  flag: FlaggedWord;
  before: string;
  after: string;
  placed: boolean;
  onAccept: (replacement: string) => void;
  onKeep: () => void;
}) {
  const [value, setValue] = useState(flag.text === "?" ? "" : flag.text);

  return (
    <div>
      <p className="mt-3 text-lg leading-relaxed text-ink">
        {placed ? before : null}
        <span className="mx-1 inline-block border-2 border-ink bg-yellow px-2 py-1 text-ink">{flag.text}</span>
        {after}
      </p>
      <label className="mt-4 block">
        <span className="nw-mono text-[12px] text-muted">Correction</span>
        <input className="nw-input mt-2 w-full" value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <Button type="button" disabled={value.trim().length === 0} onClick={() => onAccept(value.trim())}>
          Use this word
        </Button>
        <Button type="button" variant="secondary" onClick={onKeep}>
          This is OK
        </Button>
      </div>
    </div>
  );
}
