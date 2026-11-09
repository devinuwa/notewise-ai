import { getDb, type Attempt, type AttemptAnswer, type Quiz, type QuizDifficulty, type QuizQuestion } from "@/lib/db";

export function buildQuiz(input: {
  subjectId: string;
  topicId?: string;
  difficulty: QuizDifficulty;
  requestedCount: number;
  questions: Omit<QuizQuestion, "id">[];
  note?: string;
  styleLabel?: string;
}): Quiz {
  return {
    id: crypto.randomUUID(),
    subjectId: input.subjectId,
    topicId: input.topicId,
    difficulty: input.difficulty,
    requestedCount: input.requestedCount,
    questions: input.questions.map((question) => ({ ...question, id: crypto.randomUUID() })),
    createdAt: Date.now(),
    note: input.note,
    styleLabel: input.styleLabel,
  };
}

export function buildAttempt(quizId: string, answers: AttemptAnswer[]): Attempt {
  return {
    id: crypto.randomUUID(),
    quizId,
    takenAt: Date.now(),
    total: answers.length,
    correct: answers.filter((answer) => answer.correct).length,
    answers,
  };
}

export async function saveQuiz(quiz: Quiz) {
  await getDb().quizzes.add(quiz);
}

export async function saveAttempt(attempt: Attempt) {
  await getDb().attempts.add(attempt);
}

/** Home fills the quiz bar from the longest quiz the student actually finished. */
export async function finishedQuizQuestions() {
  if (typeof indexedDB === "undefined") return 0;
  const attempts = await getDb().attempts.toArray();
  return attempts.reduce((best, attempt) => Math.max(best, attempt.total), 0);
}

export type WeakTopic = {
  topic: string;
  missed: number;
};

/** A topic stays weak while misses outnumber correct answers. */
export async function weakTopics(): Promise<WeakTopic[]> {
  if (typeof indexedDB === "undefined") return [];
  const attempts = await getDb().attempts.toArray();
  const tally = new Map<string, { missed: number; correct: number }>();
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const topic = answer.topic.trim();
      if (!topic) continue;
      const row = tally.get(topic) ?? { missed: 0, correct: 0 };
      if (answer.correct) row.correct += 1;
      else row.missed += 1;
      tally.set(topic, row);
    }
  }
  return [...tally.entries()]
    .filter(([, row]) => row.missed > row.correct)
    .map(([topic, row]) => ({ topic, missed: row.missed }))
    .sort((left, right) => right.missed - left.missed || left.topic.localeCompare(right.topic))
    .slice(0, 4);
}
