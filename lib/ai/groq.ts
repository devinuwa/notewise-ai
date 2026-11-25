/**
 * Groq is the backup text provider for the Tutor and Practice quizzes.
 * Gemini is always tried first: it reads the handwriting and enforces the
 * quiz JSON schema. Groq (open Llama models on fast hardware) only answers
 * when every Gemini attempt has failed, so a Gemini outage no longer takes
 * the tutor and quizzes down with it. OCR and Exam mode stay Gemini-only.
 */

export type GroqSetup = {
  apiKey: string;
  model: string;
};

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

/** The key stays on the server, like the Gemini key. No key, no backup. */
export function readGroqSetup(): GroqSetup | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  if (!/^[a-zA-Z0-9._/-]+$/.test(model)) return null;
  return { apiKey, model };
}

type GroqRequest = {
  messages: GroqMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
};

function groqBody(setup: GroqSetup, input: GroqRequest, stream: boolean) {
  return JSON.stringify({
    model: setup.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 768,
    ...(input.json ? { response_format: { type: "json_object" } } : {}),
    ...(stream ? { stream: true } : {}),
  });
}

function groqFetch(setup: GroqSetup, input: GroqRequest, stream: boolean, signal?: AbortSignal) {
  return fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${setup.apiKey}`,
    },
    body: groqBody(setup, input, stream),
    signal,
  });
}

/** A streaming chat call for the Tutor. The caller translates the deltas. */
export function openGroqStream(setup: GroqSetup, input: GroqRequest, signal?: AbortSignal) {
  return groqFetch(setup, input, true, signal);
}

type GroqChunk = { choices?: { delta?: { content?: string | null } }[] };
type GroqReply = { choices?: { message?: { content?: string | null } }[] };

/** The text piece of one parsed Groq stream chunk, or "" when it carries none. */
export function groqDeltaText(payload: unknown): string {
  const chunk = payload as GroqChunk | null;
  return chunk?.choices?.[0]?.delta?.content ?? "";
}

/**
 * One complete chat answer as plain text (used for quiz JSON), or null when
 * Groq could not answer. Errors are logged with the status only, never the key.
 */
export async function groqChatText(
  setup: GroqSetup,
  input: GroqRequest,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const response = await groqFetch(setup, input, false, signal);
    if (!response.ok) {
      console.error(`NoteWise: Groq call failed (model=${setup.model}, status=${response.status}).`);
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const payload = (await response.json()) as GroqReply;
    const text = payload.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    if (signal?.aborted) return null;
    console.error(`NoteWise: Groq call failed (model=${setup.model}, network error).`);
    return null;
  }
}
