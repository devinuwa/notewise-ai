import { z } from "zod";

export const quizCounts = [5, 10, 20] as const;
export const quizDifficulties = ["mixed", "easy", "hard"] as const;
export const questionDifficulties = ["easy", "hard"] as const;

export type QuizCount = (typeof quizCounts)[number];
export type QuizDifficulty = (typeof quizDifficulties)[number];

const questionSchema = z.object({
  question: z.string().trim().min(12).max(400),
  options: z.array(z.string().trim().min(1).max(180)).length(4),
  answerIndex: z.coerce.number().int().min(0).max(3),
  explanation: z.string().trim().min(8).max(500),
  topic: z.string().trim().min(1).max(80),
  difficulty: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(questionDifficulties),
  ),
  sourceQuote: z.string().trim().min(8).max(280),
});

export type QuestionDraft = z.infer<typeof questionSchema>;

export type NoteChunk = {
  label: string;
  text: string;
  pageId?: string;
  topicId?: string;
  subjectId?: string;
};

export type KeptQuestion = QuestionDraft & {
  pageId?: string;
  topicId?: string;
  subjectId?: string;
};

export function fold(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** The quote has to be found in the notes. A paraphrase is rejected. */
export function quoteInNotes(quote: string, notes: string) {
  const needle = fold(quote);
  if (needle.length < 8) return false;
  return fold(notes).includes(needle);
}

export function wordCount(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * About twelve words can carry one fact. A short page cannot fill a 20-question quiz,
 * so the request is lowered before it is sent.
 */
export function fitQuestionCount(words: number, requested: number) {
  if (words < 8 || requested < 1) return 0;
  return Math.min(requested, Math.max(1, Math.floor(words / 12)));
}

export function shortfallReason(words: number, requested: number, made: number) {
  if (made >= requested) return "";
  if (words < 8) return "These reviewed notes are too short to make a question.";
  const noun = made === 1 ? "question" : "questions";
  return `These reviewed notes are about ${words} words, so this quiz has ${made} ${noun} instead of ${requested}.`;
}

/** Keep a question only when the shape is right and the quote is in the notes. */
export function keepQuestions(raw: unknown[], chunks: NoteChunk[], difficulty: QuizDifficulty) {
  const notes = chunks.map((chunk) => chunk.text).join("\n");
  const kept: KeptQuestion[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = questionSchema.safeParse(item);
    if (!parsed.success) continue;
    const row = parsed.data;
    if (difficulty !== "mixed" && row.difficulty !== difficulty) continue;
    const options = new Set(row.options.map((option) => fold(option)));
    if (options.size !== 4) continue;
    if (!quoteInNotes(row.sourceQuote, notes)) continue;
    const key = fold(row.question);
    if (seen.has(key)) continue;
    seen.add(key);
    const source = chunks.find((chunk) => quoteInNotes(row.sourceQuote, chunk.text));
    kept.push({
      ...row,
      pageId: source?.pageId,
      topicId: source?.topicId,
      subjectId: source?.subjectId,
    });
  }
  return kept;
}

export const examStyleSchema = z.object({
  examBody: z.string().trim().min(1).max(40),
  year: z.number().int().min(1990).max(2030),
  subjectName: z.string().trim().min(1).max(80),
  optionCount: z.number().int().min(2).max(6),
  averageQuestionLength: z.number().int().min(1).max(80),
  questionTypes: z.string().trim().min(1).max(200),
  /** Copied from the paper profile so the quiz can lean easy or hard the same way. */
  difficultyMix: z.object({
    easy: z.number().int().min(0).max(200),
    hard: z.number().int().min(0).max(200),
  }),
  wordingPatterns: z.array(z.string().trim().min(1).max(140)).max(6),
  samples: z
    .array(
      z.object({
        question: z.string().trim().min(8).max(400),
        options: z.array(z.string().trim().min(1).max(180)).min(2).max(6),
      }),
    )
    .min(1)
    .max(10),
});

export type ExamStyle = z.infer<typeof examStyleSchema>;

export const quizRequestSchema = z.object({
  mode: z.literal("quiz"),
  count: z.number().int().min(1).max(20),
  difficulty: z.enum(quizDifficulties),
  subject: z.string().trim().min(1).max(80),
  topic: z.string().trim().max(80).optional(),
  style: examStyleSchema.optional(),
  chunks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(160),
        text: z.string().trim().min(1).max(2000),
        pageId: z.string().trim().max(80).optional(),
        topicId: z.string().trim().max(80).optional(),
        subjectId: z.string().trim().max(80).optional(),
      }),
    )
    .min(1)
    .max(12),
});

export type QuizRequest = z.infer<typeof quizRequestSchema>;
