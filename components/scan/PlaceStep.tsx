"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Subject, Topic } from "@/lib/db";
import { canonicalSubjectName, SUBJECT_SUGGESTIONS } from "@/lib/scan/subjects";

export function PlaceStep({
  subjects,
  topics,
  pageCount,
  error,
  onBack,
  onSave,
}: {
  subjects: Subject[];
  topics: Topic[];
  pageCount: number;
  error: string;
  onBack: () => void;
  onSave: (subjectName: string, topicName: string) => void;
}) {
  const [subjectName, setSubjectName] = useState("");
  const [topicName, setTopicName] = useState("");
  const chosen = canonicalSubjectName(subjectName);
  const existing = subjects.find((subject) => subject.name.toLowerCase() === chosen.toLowerCase());
  const suggestions = SUBJECT_SUGGESTIONS.filter(
    (name) => !subjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase()),
  );
  const topicQuery = topicName.trim().toLowerCase();
  const topicMatches = existing
    ? topics
        .filter((topic) => topic.subjectId === existing.id)
        .filter((topic) => !topicQuery || topic.name.toLowerCase().includes(topicQuery))
        .slice(0, 6)
    : [];
  const ready = chosen.length > 0 && topicName.trim().length > 0;

  return (
    <section>
      <SectionHeading before="Where does this" highlight="belong" />
      <p className="mt-4 max-w-xl text-lg text-ink">
        {pageCount} {pageCount === 1 ? "page" : "pages"} will be saved on this device as needing review.
        Cloud reading sends the photo to Google AI Studio. On-device reading stays on this phone and is less
        accurate.
      </p>

      <div className="mt-8">
        <p className="nw-mono text-[12px] text-muted" id="subject-label">
          Subject
        </p>
        {subjects.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby="subject-label">
            {subjects.map((subject) => {
              const selected = existing?.id === subject.id;
              return (
                <button
                  key={subject.id}
                  type="button"
                  className={`nw-mono border-2 border-ink px-2 py-2 text-left text-[11px] leading-tight ${selected ? "bg-yellow text-ink" : "bg-paper text-ink"}`}
                  aria-pressed={selected}
                  onClick={() => setSubjectName(subject.name)}
                >
                  <span aria-hidden className="mr-2 inline-block h-3 w-3 border-2 border-ink align-middle" style={{ background: subject.color }} />
                  {subject.name}
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((name) => {
            const selected = chosen.toLowerCase() === name.toLowerCase() && !existing;
            return (
              <button
                key={name}
                type="button"
                className={`nw-mono border-2 border-ink px-2 py-2 text-left text-[11px] leading-tight ${selected ? "bg-yellow text-ink" : "bg-paper text-ink"}`}
                aria-pressed={selected}
                onClick={() => setSubjectName(name)}
              >
                {name}
              </button>
            );
          })}
        </div>
        <label className="nw-mono mt-4 block text-[12px] text-muted" htmlFor="subject-name">
          Or type a subject
        </label>
        <input
          id="subject-name"
          className="nw-input mt-2 max-w-full"
          value={subjectName}
          maxLength={60}
          onChange={(event) => setSubjectName(event.target.value)}
        />
      </div>

      <div className="mt-8">
        <label className="nw-mono text-[12px] text-muted" htmlFor="topic-name">
          Topic
        </label>
        <input
          id="topic-name"
          className="nw-input mt-2 max-w-full"
          value={topicName}
          maxLength={80}
          list="topic-options"
          autoComplete="off"
          onChange={(event) => setTopicName(event.target.value)}
        />
        <datalist id="topic-options">
          {topicMatches.map((topic) => (
            <option key={topic.id} value={topic.name} />
          ))}
        </datalist>
        {topicMatches.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {topicMatches.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className="nw-mono border-2 border-ink bg-paper px-2 py-2 text-[11px] text-ink"
                onClick={() => setTopicName(topic.name)}
              >
                {topic.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-base text-ink">Type the topic. Suggestions appear when this subject already has some.</p>
        )}
      </div>

      {error ? (
        <p className="mt-4 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" className="w-full sm:w-auto" disabled={!ready} onClick={() => onSave(subjectName, topicName)}>
          Read my handwriting
        </Button>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onBack}>
          Back to pages
        </Button>
      </div>
    </section>
  );
}
