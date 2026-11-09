"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ExamProfile } from "@/lib/db";
import { examStyleLabel, styleFromProfile } from "@/lib/exam/style";
import type { ExamStyle } from "@/lib/practice/check";

const typeLabels = [
  ["recall", "Recall"],
  ["calculation", "Calculation"],
  ["comprehension", "Comprehension"],
  ["application", "Application"],
] as const;

export function ExamSummary({
  profile,
  readySubjects,
  busy,
  onPractice,
}: {
  profile: ExamProfile;
  readySubjects: { id: string; name: string }[];
  busy: boolean;
  onPractice: (input: { subjectId: string; style: ExamStyle; styleLabel: string }) => void;
}) {
  const [picked, setPicked] = useState("");
  const [openSamples, setOpenSamples] = useState(false);
  const matched =
    readySubjects.find((subject) => subject.name.trim().toLowerCase() === profile.subjectName.trim().toLowerCase())?.id ??
    "";
  const chosen = readySubjects.some((subject) => subject.id === picked) ? picked : matched;
  const maxTopic = Math.max(...profile.topics.map((topic) => topic.count), 1);

  return (
    <section className="mt-4 border-2 border-ink bg-paper px-4 py-4 text-ink shadow-[4px_4px_0_var(--shadow)]">
      <h3 className="nw-display text-[clamp(28px,6vw,40px)]">What this exam tests</h3>
      <p className="mt-2 text-base text-ink">
        {profile.examBody} {profile.subjectName} {profile.year}. Questions are usually about {profile.averageQuestionLength}{" "}
        words
        {profile.optionCount === 4
          ? " and have 4 options."
          : ` and have ${profile.optionCount} options. Practice questions still have 4, so each one can be checked against your notes.`}
      </p>
      <p className="nw-mono mt-4 text-[12px] text-muted">Topics</p>
      <ul className="mt-2 grid gap-3">
        {profile.topics.map((topic) => (
          <li key={topic.topic}>
            <div className="flex items-baseline justify-between gap-3">
              <span>{topic.topic}</span>
              <span className="nw-mono text-[12px] text-muted">{topic.count}</span>
            </div>
            <div
              className="mt-1 border-2 border-ink bg-page"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={maxTopic}
              aria-valuenow={topic.count}
              aria-label={`${topic.topic}, ${topic.count} questions`}
            >
              <div className="h-3 bg-green-600" style={{ width: `${Math.round((topic.count / maxTopic) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="nw-mono mt-4 text-[12px] text-muted">Question types</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {typeLabels.map(([key, label]) => (
          <li key={key} className="nw-chip bg-page text-ink">
            {label} {profile.questionTypes[key]}
          </li>
        ))}
      </ul>
      <p className="nw-mono mt-4 text-[12px] text-muted">Difficulty mix</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        <li className="nw-chip bg-page text-ink">Easy {profile.difficultyMix.easy}</li>
        <li className="nw-chip bg-page text-ink">Hard {profile.difficultyMix.hard}</li>
      </ul>
      <p className="nw-mono mt-4 text-[12px] text-muted">How questions are worded</p>
      <ul className="mt-2 list-disc pl-5">
        {profile.wordingPatterns.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button
        type="button"
        className="nw-mono mt-4 min-h-11 text-[12px] text-ink underline"
        aria-expanded={openSamples}
        onClick={() => setOpenSamples((open) => !open)}
      >
        {openSamples ? "Hide sample questions" : `Show ${profile.samples.length} sample questions from your copy`}
      </button>
      {openSamples ? (
        <ol className="mt-3 grid gap-3">
          {profile.samples.map((sample) => (
            <li key={sample.question} className="border-2 border-ink bg-page px-3 py-2">
              <p>{sample.question}</p>
              <p className="mt-1 text-sm text-muted">{sample.options.join(" · ")}</p>
            </li>
          ))}
        </ol>
      ) : null}
      <label className="mt-4 block">
        <span className="nw-mono text-[12px] text-muted">Use reviewed notes from</span>
        <select
          className="nw-input mt-2 w-full"
          value={chosen}
          onChange={(event) => setPicked(event.target.value)}
        >
          <option value="">Choose a subject</option>
          {readySubjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </select>
      </label>
      {readySubjects.length === 0 ? (
        <p className="mt-3 text-sm text-ink">Mark a page done before you practice in this style.</p>
      ) : null}
      <div className="mt-4">
        <Button
          type="button"
          disabled={!chosen || busy}
          onClick={() =>
            onPractice({
              subjectId: chosen,
              style: styleFromProfile(profile),
              styleLabel: examStyleLabel(profile.examBody),
            })
          }
        >
          Practice in this style
        </Button>
      </div>
    </section>
  );
}
