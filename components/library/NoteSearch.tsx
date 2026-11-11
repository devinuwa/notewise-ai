"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { getBrain, getServerBrain, subscribeBrain } from "@/lib/rag/brain";
import { search, type SearchHit } from "@/lib/rag/search";
import { syncReviewed } from "@/lib/rag/sync";
import type { NotePage, Subject, Topic } from "@/lib/db";
import { snippet } from "@/lib/library";

function useStudyBrain() {
  return useSyncExternalStore(subscribeBrain, getBrain, getServerBrain);
}

export function StudyBrainLoader() {
  const brain = useStudyBrain();
  useEffect(() => {
    void import("@/lib/rag/embed-client").then((mod) => mod.kickEmbedder());
  }, []);
  if (brain.phase === "failed") {
    return (
      <div className="mt-4 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
        <p>The study brain could not download. Search still works by keywords.</p>
        <Button
          type="button"
          className="mt-2"
          onClick={() => {
            void import("@/lib/rag/embed-client").then((mod) => mod.retryEmbedder({ manual: true }));
          }}
        >
          Try again
        </Button>
      </div>
    );
  }
  if (brain.phase !== "downloading") return null;
  return (
    <div className="mt-4">
      <PixelLoader caption="Preparing your study brain, one time download" tone="on-paper" />
      {brain.progress > 0 ? <p className="nw-mono mt-2 text-[12px] text-muted">{brain.progress}% downloaded</p> : null}
    </div>
  );
}

export function ReviewedIndex({ pages }: { pages: NotePage[] }) {
  const brain = useStudyBrain();
  const pagesRef = useRef(pages);
  const sig = pages
    .filter((page) => page.status === "digitized")
    .map((page) => `${page.id}:${page.topicId}:${page.text.length}:${page.correctedAt ?? 0}`)
    .join("|");

  useEffect(() => {
    pagesRef.current = pages;
  });

  useEffect(() => {
    void syncReviewed(pagesRef.current);
  }, [sig, brain.phase]);

  return null;
}

function preview(text: string, query: string, mode: "semantic" | "keyword") {
  const clean = text.replace(/\s+/g, " ").trim();
  if (mode === "keyword") return snippet(clean, query);
  if (clean.length <= 220) return clean;
  return `${clean.slice(0, 220).trim()}…`;
}

export function NoteSearch({
  subjects,
  topics,
  hasUnreviewed,
  query,
  onQuery,
}: {
  subjects: Subject[];
  topics: Topic[];
  hasUnreviewed: boolean;
  query: string;
  onQuery: (value: string) => void;
}) {
  const brain = useStudyBrain();
  const [pending, setPending] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [mode, setMode] = useState<"semantic" | "keyword">("keyword");
  const ticket = useRef(0);

  function onChange(value: string) {
    onQuery(value);
    if (!value.trim()) {
      ticket.current += 1;
      setHits(null);
      setPending(false);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const id = ++ticket.current;
    const handle = window.setTimeout(() => {
      const slow = window.setTimeout(() => {
        if (id === ticket.current) setPending(true);
      }, 150);
      void search(trimmed, { k: 8 })
        .then((found) => {
          if (id !== ticket.current) return;
          setHits(found.hits);
          setMode(found.mode);
        })
        .catch(() => {
          if (id !== ticket.current) return;
          setHits([]);
          setMode("keyword");
        })
        .finally(() => {
          window.clearTimeout(slow);
          if (id === ticket.current) setPending(false);
        });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, brain.phase, brain.revision]);

  const trimmed = query.trim();
  const caption =
    mode === "semantic"
      ? "Matched by meaning."
      : brain.phase === "ready"
        ? "Matched by words."
        : "Matching words until the study brain is ready.";

  return (
    <div className="mt-6">
      <label className="block max-w-xl">
        <span className="nw-mono text-[12px] text-muted">Search reviewed notes</span>
        <input
          className="nw-input mt-2 w-full"
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Try mitosis or how cells divide"
          type="search"
        />
      </label>
      <StudyBrainLoader />
      {trimmed && pending && hits === null ? (
        <div className="mt-4">
          <PixelLoader caption="Searching your notes…" tone="on-paper" />
        </div>
      ) : null}
      {trimmed && hits ? (
        <SearchList
          hits={hits}
          subjects={subjects}
          topics={topics}
          query={trimmed}
          mode={mode}
          caption={caption}
          hasUnreviewed={hasUnreviewed}
        />
      ) : null}
    </div>
  );
}

function SearchList({
  hits,
  subjects,
  topics,
  query,
  mode,
  caption,
  hasUnreviewed,
}: {
  hits: SearchHit[];
  subjects: Subject[];
  topics: Topic[];
  query: string;
  mode: "semantic" | "keyword";
  caption: string;
  hasUnreviewed: boolean;
}) {
  return (
    <div className="mt-4">
      <p className="nw-mono text-[12px] text-muted">{caption}</p>
      {hits.length === 0 ? (
        <p className="mt-4 text-lg text-ink">No reviewed note matches that search.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {hits.map((hit, index) => {
            const subject = subjects.find((item) => item.id === hit.subjectId);
            const topic = topics.find((item) => item.id === hit.topicId);
            return (
              <li key={`${hit.pageId}:${index}`} className="border-2 border-ink bg-paper p-4">
                <p className="nw-mono text-[12px] text-muted">
                  {subject?.name ?? "Note"}
                  {topic ? ` · ${topic.name}` : ""}
                </p>
                <p className="mt-2 text-base text-ink">{preview(hit.text, query, mode)}</p>
                <div className="mt-3">
                  <Button href={`/library/${hit.subjectId}/${hit.topicId}/${hit.pageId}`}>Open page</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasUnreviewed ? <p className="mt-4 text-sm text-ink">Pages that still need review are left out.</p> : null}
    </div>
  );
}
