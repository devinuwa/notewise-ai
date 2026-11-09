import { z } from "zod";
import { openGeminiContent, readGeminiSetup } from "@/lib/ai/adapter";
import { EXAM_PROFILE_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { examBodies } from "@/lib/exam/bodies";
import { fold } from "@/lib/practice/check";

const requestSchema = z.object({
  mode: z.literal("exam-profile"),
  examBody: z.enum(examBodies),
  subject: z.string().trim().min(1).max(80),
  year: z.number().int().min(1990).max(2030),
  text: z.string().trim().min(40).max(14_000),
});

const profileSchema = z.object({
  optionCount: z.coerce.number().int().min(2).max(6),
  averageQuestionLength: z.coerce.number().int().min(1).max(80),
  questionTypes: z.object({
    recall: z.coerce.number().int().min(0).max(200),
    calculation: z.coerce.number().int().min(0).max(200),
    comprehension: z.coerce.number().int().min(0).max(200),
    application: z.coerce.number().int().min(0).max(200),
  }),
  topics: z
    .array(
      z.object({
        topic: z.string().trim().min(1).max(80),
        count: z.coerce.number().int().min(1).max(200),
      }),
    )
    .min(1)
    .max(8),
  difficultyMix: z.object({
    easy: z.coerce.number().int().min(0).max(200),
    hard: z.coerce.number().int().min(0).max(200),
  }),
  wordingPatterns: z.array(z.string().trim().min(3).max(140)).min(1).max(6),
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

export type ExamProfileDraft = z.infer<typeof profileSchema>;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    optionCount: { type: "INTEGER" },
    averageQuestionLength: { type: "INTEGER" },
    questionTypes: {
      type: "OBJECT",
      properties: {
        recall: { type: "INTEGER" },
        calculation: { type: "INTEGER" },
        comprehension: { type: "INTEGER" },
        application: { type: "INTEGER" },
      },
      required: ["recall", "calculation", "comprehension", "application"],
    },
    topics: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          topic: { type: "STRING" },
          count: { type: "INTEGER" },
        },
        required: ["topic", "count"],
      },
    },
    difficultyMix: {
      type: "OBJECT",
      properties: {
        easy: { type: "INTEGER" },
        hard: { type: "INTEGER" },
      },
      required: ["easy", "hard"],
    },
    wordingPatterns: { type: "ARRAY", items: { type: "STRING" } },
    samples: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["question", "options"],
      },
    },
  },
  required: [
    "optionCount",
    "averageQuestionLength",
    "questionTypes",
    "topics",
    "difficultyMix",
    "wordingPatterns",
    "samples",
  ],
};

type GeminiPart = { text?: string; thought?: boolean };
type GeminiReply = { candidates?: { content?: { parts?: GeminiPart[] } }[] };

function replyText(payload: GeminiReply) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
}

function readJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("The exam pattern was not JSON.");
  }
}

/** A copied question has to show up in the paper. A made-up sample is dropped. */
export function sampleInPaper(question: string, paper: string) {
  const needle = fold(question).slice(0, 40);
  if (needle.length < 12) return false;
  return fold(paper).includes(needle);
}

function grounded(raw: unknown, paper: string): ExamProfileDraft | null {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return null;
  const samples = parsed.data.samples.filter((sample) => sampleInPaper(sample.question, paper));
  if (samples.length === 0) return null;
  return { ...parsed.data, samples: samples.slice(0, 10) };
}

function askText(input: { examBody: string; subject: string; year: number; text: string }, reminder: string) {
  const extra = reminder ? `\n\n${reminder}` : "";
  return `Exam body: ${input.examBody}\nSubject: ${input.subject}\nYear: ${input.year}\n\nPAPER:\n${input.text}${extra}`;
}

async function once(
  setup: { apiKey: string; model: string },
  input: { examBody: string; subject: string; year: number; text: string },
  reminder: string,
  signal: AbortSignal | undefined,
) {
  const upstream = await openGeminiContent(
    setup,
    {
      systemInstruction: { parts: [{ text: EXAM_PROFILE_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: askText(input, reminder) }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: "MINIMAL" },
      },
    },
    signal,
  );
  if (!upstream.ok) return null;
  try {
    const payload = (await upstream.json()) as GeminiReply;
    return grounded(readJson(replyText(payload)), input.text);
  } catch {
    return null;
  }
}

/** Ask for the exam pattern, then keep only samples that appear in the reviewed text. */
export async function handleExamProfile(body: unknown, signal?: AbortSignal) {
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Add the exam body, subject, year, and the reviewed text." }, { status: 400 });
  }
  const setup = readGeminiSetup();
  if (!setup) {
    return Response.json({ error: "Exam mode is not set up on this computer yet." }, { status: 503 });
  }

  const request = parsed.data;
  let failed = false;
  let reminder = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (signal?.aborted) break;
    try {
      const profile = await once(setup, request, reminder, signal);
      failed = false;
      if (profile) return Response.json({ profile });
      reminder = "Copy each sample question from the PAPER. A previous sample was not found in the paper, so it was rejected.";
    } catch {
      failed = true;
    }
  }

  if (failed) {
    return Response.json({ error: "The paper could not be read just now." }, { status: 502 });
  }
  return Response.json(
    { error: "The paper pattern could not be read. Check the text and try again." },
    { status: 422 },
  );
}
