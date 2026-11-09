"use client";

import { Suspense, useState, useSyncExternalStore, type ReactNode } from "react";
import { ExamMode } from "@/components/exam/ExamMode";
import { QuizPlay } from "@/components/practice/QuizPlay";
import { Button } from "@/components/ui/Button";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/StateBlock";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { AttemptAnswer, QuizQuestion } from "@/lib/db";
import { shownPages, shownSubjects, shownTopics } from "@/lib/demo";
import { OFFLINE_QUIZ, onlineServerSnapshot, onlineSnapshot, subscribeOnline } from "@/lib/offline";
import { isNotebookError, useNotebook } from "@/lib/use-notebook";
import {
  fitQuestionCount,
  quizCounts,
  quizDifficulties,
  shortfallReason,
  type ExamStyle,
  type QuizCount,
  type QuizDifficulty,
} from "@/lib/practice/check";
import { notesForQuiz } from "@/lib/practice/gather";
import { buildAttempt, buildQuiz, saveAttempt, saveQuiz } from "@/lib/practice/store";

type Phase = "setup" | "loading" | "play" | "score";

type Round = {
  quizId: string;
  questions: QuizQuestion[];
  note: string;
  styleLabel?: string;
  round: number;
};

export function PracticeScreen() {
  const notebook = useNotebook();
  const online = useSyncExternalStore(subscribeOnline, onlineSnapshot, onlineServerSnapshot);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [count, setCount] = useState<QuizCount>(5);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("mixed");
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState("");
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState<AttemptAnswer[]>([]);

  if (!notebook) {
    return (
      <main className="nw-page mx-auto w-full max-w-[760px]">
        <LoadingState caption="Opening practice…" />
      </main>
    );
  }

  if (isNotebookError(notebook)) {
    return (
      <main className="nw-page mx-auto w-full max-w-[720px]">
        <ErrorState message={notebook.error} />
      </main>
    );
  }

  const subjects = shownSubjects(notebook.subjects);
  const topics = shownTopics(notebook.topics);
  const pages = shownPages(notebook.pages);
  const reviewed = pages.filter((page) => page.status === "digitized" && page.text.trim());
  const readySubjects = subjects.filter((subject) => reviewed.some((page) => page.subjectId === subject.id));
  const subjectTopics = topics.filter(
    (topic) => topic.subjectId === subjectId && reviewed.some((page) => page.topicId === topic.id),
  );

  async function start(extra?: { subjectId: string; style: ExamStyle; styleLabel: string }) {
    const chosenId = extra?.subjectId || subjectId;
    if (!chosenId || phase === "loading") return;
    if (!online) {
      setError(OFFLINE_QUIZ);
      return;
    }
    const subject = readySubjects.find((item) => item.id === chosenId);
    if (!subject) return;
    setPhase("loading");
    setError("");
    setScore([]);
    window.scrollTo(0, 0);
    try {
      const packed = await notesForQuiz(chosenId, extra ? undefined : topicId || undefined);
      const made = fitQuestionCount(packed.words, count);
      const note = shortfallReason(packed.words, count, made);
      if (made < 1 || packed.chunks.length === 0) {
        setPhase("setup");
        setError(note || "Mark a page done in this subject before you practice.");
        return;
      }
      const topic = extra ? undefined : subjectTopics.find((item) => item.id === topicId)?.name;
      const usedDifficulty = extra ? "mixed" : difficulty;
      const response = await fetch("/api/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "quiz",
          count: made,
          difficulty: usedDifficulty,
          subject: subject.name,
          topic,
          chunks: packed.chunks,
          style: extra?.style,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        questions?: QuizQuestion[];
      } | null;
      if (!response.ok || !payload || !Array.isArray(payload.questions) || payload.questions.length === 0) {
        const message = payload && typeof payload.error === "string" ? payload.error : "The quiz could not be written just now.";
        throw new Error(message);
      }
      const dropped =
        (payload.questions?.length ?? 0) < made
          ? "Some questions were left out because the quote was not in your notes."
          : "";
      const quiz = buildQuiz({
        subjectId: chosenId,
        topicId: extra ? undefined : topicId || undefined,
        difficulty: usedDifficulty,
        requestedCount: count,
        questions: (payload.questions ?? []).slice(0, made).map((item) => ({
          ...item,
          options: item.options.slice(0, 4),
        })),
        note: [note, dropped].filter(Boolean).join(" "),
        styleLabel: extra?.styleLabel,
      });
      await saveQuiz(quiz);
      setRound({ quizId: quiz.id, questions: quiz.questions, note: quiz.note ?? "", styleLabel: quiz.styleLabel, round: 1 });
      setPhase("play");
    } catch (caught) {
      setPhase("setup");
      setError(caught instanceof Error ? caught.message : "The quiz could not be written just now.");
    }
  }

  async function finish(answers: AttemptAnswer[]) {
    if (!round) return;
    try {
      await saveAttempt(buildAttempt(round.quizId, answers));
    } catch {
      setError("The score could not be saved on this device.");
    }
    setScore(answers);
    setPhase("score");
  }

  function retryMissed() {
    if (!round) return;
    const missedIds = new Set(score.filter((answer) => !answer.correct).map((answer) => answer.questionId));
    const questions = round.questions.filter((question) => missedIds.has(question.id));
    if (questions.length === 0) return;
    setScore([]);
    setRound({ ...round, questions, note: "", round: round.round + 1 });
    setPhase("play");
  }

  const correct = score.filter((answer) => answer.correct).length;
  const missedTopics = [...new Set(score.filter((answer) => !answer.correct).map((answer) => answer.topic))];

  return (
    <main className="nw-page mx-auto w-full max-w-[760px]">
      <p className="nw-mono text-[12px] text-muted">Practice</p>
      <div className="mt-3">
        <SectionHeading before="Questions from your" highlight="notes" />
      </div>
      {phase === "setup" || phase === "loading" ? (
        <>
          <p className="mt-4 max-w-xl text-lg text-ink">
            Pick a subject, then a number of questions. Only reviewed pages are used. Exam mode, under this quiz, reads a past paper you already have.
          </p>
          {!online ? (
            <p className="mt-4 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
              {OFFLINE_QUIZ}
            </p>
          ) : null}
          {readySubjects.length === 0 ? (
            <EmptyState
              title="No reviewed pages yet"
              body="Mark a page done before you practice. Pages that still need review stay out."
            />
          ) : (
            <>
              <ChoiceRow label="Subject">
                {readySubjects.map((subject) => (
                  <Chip
                    key={subject.id}
                    pressed={subjectId === subject.id}
                    onClick={() => {
                      setSubjectId(subject.id);
                      setTopicId("");
                    }}
                  >
                    {subject.name}
                  </Chip>
                ))}
              </ChoiceRow>
              {subjectId ? (
                <ChoiceRow label="Topic">
                  <Chip pressed={topicId === ""} onClick={() => setTopicId("")}>
                    Any topic
                  </Chip>
                  {subjectTopics.map((topic) => (
                    <Chip key={topic.id} pressed={topicId === topic.id} onClick={() => setTopicId(topic.id)}>
                      {topic.name}
                    </Chip>
                  ))}
                </ChoiceRow>
              ) : null}
              <ChoiceRow label="Questions">
                {quizCounts.map((value) => (
                  <Chip key={value} pressed={count === value} onClick={() => setCount(value)}>
                    {String(value)}
                  </Chip>
                ))}
              </ChoiceRow>
              <ChoiceRow label="Difficulty">
                {quizDifficulties.map((value) => (
                  <Chip key={value} pressed={difficulty === value} onClick={() => setDifficulty(value)}>
                    {value}
                  </Chip>
                ))}
              </ChoiceRow>
              <div className="mt-6">
                {phase === "loading" ? (
                  <PixelLoader caption="Writing questions from your notes…" tone="on-paper" />
                ) : (
                  <Button type="button" disabled={!subjectId || !online} onClick={() => void start()}>
                    Make quiz
                  </Button>
                )}
              </div>
            </>
          )}
          {error ? <div className="mt-4"><ErrorState message={error} /></div> : null}
        </>
      ) : null}

      {phase === "play" && round ? (
        <div className="mt-6">
          <QuizPlay
            key={round.round}
            questions={round.questions}
            note={round.note}
            styleLabel={round.styleLabel}
            onFinish={(answers) => void finish(answers)}
          />
        </div>
      ) : null}

      {phase === "score" ? (
        <div className="mt-6">
          <p className="nw-display text-[clamp(32px,8vw,56px)] text-ink">
            You got {correct} of {score.length}.
          </p>
          {missedTopics.length > 0 ? (
            <>
              <p className="nw-mono mt-4 text-[12px] text-muted">Weak topics</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {missedTopics.map((topic) => (
                  <li key={topic} className="nw-chip bg-yellow text-ink">
                    {topic}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-lg text-ink">Every question matched your notes.</p>
          )}
          {error ? (
            <p className="mt-4 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            {missedTopics.length > 0 ? (
              <Button type="button" onClick={retryMissed}>
                Retry missed questions
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPhase("setup");
                setRound(null);
                setScore([]);
                setError("");
              }}
            >
              Another quiz
            </Button>
          </div>
        </div>
      ) : null}
      {phase === "setup" || phase === "loading" ? (
        <Suspense fallback={null}>
          <ExamMode
            subjectNames={subjects.map((subject) => subject.name)}
            readySubjects={readySubjects.map((subject) => ({ id: subject.id, name: subject.name }))}
            busy={phase === "loading"}
            onPractice={(extra) => void start(extra)}
          />
        </Suspense>
      ) : null}
    </main>
  );
}

function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-6" role="group" aria-label={label}>
      <p className="nw-mono text-[12px] text-muted">{label}</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: string }) {
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
