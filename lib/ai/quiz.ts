import { z } from "zod";
import { openGeminiContent, readGeminiSetup } from "@/lib/ai/adapter";
import { QUIZ_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { notesForPrompt } from "@/lib/tutor/request";
import {
  keepQuestions,
  quizRequestSchema,
  type KeptQuestion,
  type ExamStyle,
  type NoteChunk,
  type QuizDifficulty,
} from "@/lib/practice/check";

type GeminiPart = { text?: string; thought?: boolean };
type GeminiReply = { candidates?: { content?: { parts?: GeminiPart[] } }[] };

const envelopeSchema = z.object({
  questions: z.array(z.unknown()),
});

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" }, minItems: 4, maxItems: 4 },
          answerIndex: { type: "INTEGER", minimum: 0, maximum: 3 },
          explanation: { type: "STRING" },
          topic: { type: "STRING" },
          difficulty: { type: "STRING", enum: ["easy", "hard"] },
          sourceQuote: { type: "STRING" },
        },
        required: ["question", "options", "answerIndex", "explanation", "topic", "difficulty", "sourceQuote"],
      },
    },
  },
  required: ["questions"],
};

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
    throw new Error("The quiz was not JSON.");
  }
}

function styleBlock(style: ExamStyle | undefined) {
  if (!style) return "";
  const samples = style.samples
    .map((sample, index) => `${index + 1}. ${sample.question}\nOptions: ${sample.options.join(" | ")}`)
    .join("\n");
  const wording = style.wordingPatterns.length > 0 ? style.wordingPatterns.join("; ") : "plain school English";
  return `\n\nWrite in the style of ${style.examBody} ${style.year} ${style.subjectName}. That paper usually has ${style.optionCount} options and question stems of about ${style.averageQuestionLength} words. You still write exactly 4 options. Follow this mix of question types: ${style.questionTypes}. Aim for about the same difficulty mix: easy ${style.difficultyMix.easy}, hard ${style.difficultyMix.hard}. Typical wording: ${wording}. The examples below are style only. Do not copy them. Do not take sourceQuote from them. sourceQuote must be copied from the NOTES.\n${samples}`;
}

function askText(input: {
  subject: string;
  topic: string;
  difficulty: QuizDifficulty;
  count: number;
  notes: string;
  already: string[];
  style?: ExamStyle;
}) {
  const topicLine = input.topic ? `Topic: ${input.topic}` : "Topic: any topic in this subject";
  const again =
    input.already.length > 0
      ? `\n\nDo not repeat these questions:\n${input.already.map((line) => `- ${line}`).join("\n")}\nCopy sourceQuote as an exact phrase from the NOTES.`
      : "";
  return `${input.notes}\n\nSubject: ${input.subject}\n${topicLine}\nDifficulty: ${input.difficulty}\nWrite ${input.count} question${input.count === 1 ? "" : "s"}.${again}${styleBlock(input.style)}`;
}

async function once(
  setup: { apiKey: string; model: string },
  input: {
    subject: string;
    topic: string;
    difficulty: QuizDifficulty;
    count: number;
    notes: string;
    chunks: NoteChunk[];
    already: string[];
    style?: ExamStyle;
  },
  signal: AbortSignal | undefined,
) {
  const upstream = await openGeminiContent(
    setup,
    {
      systemInstruction: { parts: [{ text: QUIZ_SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [{ text: askText(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: Math.min(8192, 500 * input.count + 256),
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        thinkingConfig: { thinkingLevel: "MINIMAL" },
      },
    },
    signal,
  );
  if (!upstream.ok) return [];
  try {
    const payload = (await upstream.json()) as GeminiReply;
    const parsed = envelopeSchema.safeParse(readJson(replyText(payload)));
    if (!parsed.success) return [];
    return keepQuestions(parsed.data.questions, input.chunks, input.difficulty);
  } catch {
    return [];
  }
}

function merge(current: KeptQuestion[], next: KeptQuestion[], limit: number) {
  const seen = new Set(current.map((row) => row.question.toLowerCase()));
  const combined = [...current];
  for (const row of next) {
    const key = row.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(row);
    if (combined.length >= limit) break;
  }
  return combined;
}

/** Ask, check, and ask again up to twice when a question is not grounded in the notes. */
export async function handleQuiz(body: unknown, signal?: AbortSignal) {
  const parsed = quizRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Choose a subject and a number of questions." }, { status: 400 });
  }
  const setup = readGeminiSetup();
  if (!setup) {
    return Response.json({ error: "Practice is not set up on this computer yet." }, { status: 503 });
  }

  const request = parsed.data;
  const notes = notesForPrompt(request.chunks);
  let accepted: KeptQuestion[] = [];
  let failed = false;
  for (let attempt = 0; attempt < 3 && accepted.length < request.count; attempt += 1) {
    if (signal?.aborted) break;
    try {
      const batch = await once(
        setup,
        {
          subject: request.subject,
          topic: request.topic ?? "",
          difficulty: request.difficulty,
          count: request.count - accepted.length,
          notes,
          chunks: request.chunks,
          already: accepted.map((row) => row.question),
          style: request.style,
        },
        signal,
      );
      accepted = merge(accepted, batch, request.count);
      failed = false;
    } catch {
      failed = true;
    }
  }
  if (accepted.length === 0 && failed) {
    return Response.json({ error: "The quiz could not be written just now." }, { status: 502 });
  }

  if (accepted.length === 0) {
    return Response.json(
      { error: "No question stayed tied to your notes. Try another subject or add a reviewed page." },
      { status: 422 },
    );
  }

  return Response.json({
    questions: accepted.slice(0, request.count),
  });
}
