"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { AttemptAnswer, QuizQuestion } from "@/lib/db";
import { setSessionBusy } from "@/lib/pwa/session-busy";

export function QuizPlay({
  questions,
  note,
  styleLabel,
  onFinish,
}: {
  questions: QuizQuestion[];
  note?: string;
  styleLabel?: string;
  onFinish: (answers: AttemptAnswer[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AttemptAnswer[]>([]);

  useEffect(() => {
    setSessionBusy("quiz", true);
    return () => setSessionBusy("quiz", false);
  }, []);

  const question = questions[index];
  if (!question) return null;
  const total = questions.length;
  const width = Math.round(((index + 1) / total) * 100);
  const revealed = picked !== null;

  function choose(option: number) {
    if (picked !== null) return;
    setPicked(option);
  }

  function next() {
    if (picked === null) return;
    const row: AttemptAnswer = {
      questionId: question.id,
      topic: question.topic,
      correct: picked === question.answerIndex,
    };
    const nextAnswers = [...answers, row];
    if (index + 1 >= total) {
      onFinish(nextAnswers);
      return;
    }
    setAnswers(nextAnswers);
    setIndex(index + 1);
    setPicked(null);
  }

  return (
    <div>
      {note ? <p className="border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink">{note}</p> : null}
      <p className={`nw-mono text-[12px] text-muted ${note ? "mt-4" : ""}`}>
        {styleLabel ?? "Practice question made from your notes"}
      </p>
      <p className="nw-mono mt-3 text-[12px] text-ink">
        Question {index + 1} of {total}
      </p>
      <div
        className="mt-2 border-2 border-ink bg-page"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-label="Quiz progress"
      >
        <div className="h-3 bg-green-600" style={{ width: `${width}%` }} />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-ink">{question.question}</h2>
      <div className="mt-4 grid gap-3" role="group" aria-label="Answer choices">
        {question.options.map((option, optionIndex) => {
          const correct = optionIndex === question.answerIndex;
          const chosen = picked === optionIndex;
          const tone =
            revealed && correct
              ? "bg-green-800 text-paper"
              : revealed && chosen
                ? "bg-red text-paper"
                : "bg-paper text-ink";
          return (
            <button
              key={`${question.id}-${optionIndex}`}
              type="button"
              className={`min-h-11 w-full border-2 border-ink px-4 py-3 text-left text-base shadow-[4px_4px_0_var(--shadow)] ${tone}`}
              aria-disabled={revealed}
              aria-pressed={chosen}
              onClick={() => choose(optionIndex)}
            >
              <span className="nw-mono mr-2 text-[12px]">{String.fromCharCode(65 + optionIndex)}</span>
              {option}
              {revealed && correct ? <span className="nw-mono mt-2 block text-[12px]">Correct</span> : null}
              {revealed && chosen && !correct ? <span className="nw-mono mt-2 block text-[12px]">Not this one</span> : null}
            </button>
          );
        })}
      </div>
      {revealed ? (
        <div className="mt-4 border-2 border-ink bg-paper px-4 py-3 text-ink" role="status">
          <p>{question.explanation}</p>
          <p className="mt-3 text-sm">
            <span className="nw-mono text-[12px]">From your notes. </span>
            {question.sourceQuote}
          </p>
          {question.pageId && question.subjectId && question.topicId ? (
            <p className="mt-3">
              <Link className="font-semibold underline" href={`/library/${question.subjectId}/${question.topicId}/${question.pageId}`}>
                Open page
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4">
        <Button type="button" disabled={!revealed} onClick={next}>
          {index + 1 >= total ? "See score" : "Next"}
        </Button>
      </div>
    </div>
  );
}
