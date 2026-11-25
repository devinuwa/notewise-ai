import { openGeminiStream, readGeminiSetup } from "@/lib/ai/adapter";
import { groqDeltaText, openGroqStream, readGroqSetup, type GroqMessage } from "@/lib/ai/groq";
import { handleExamProfile } from "@/lib/exam/analyse";
import { handleQuiz } from "@/lib/ai/quiz";
import { TUTOR_SPOKEN_EXTRA, tutorSystemPrompt } from "@/lib/ai/prompts";
import { notesForPrompt, parseTutorRequest, type TutorTurn } from "@/lib/tutor/request";
import { tutorLanguageOrDefault } from "@/lib/tutor/languages";

export const maxDuration = 60;

const WINDOW_MS = 60_000;
const LIMIT = 15;

// One process only. A restart, or a second server, starts the count again.
const buckets = new Map<string, { count: number; reset: number }>();

type GeminiPart = { text?: string; thought?: boolean };
type GeminiChunk = { candidates?: { content?: { parts?: GeminiPart[] } }[] };

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip") ?? "local";
}

function allow(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now >= bucket.reset) {
    buckets.set(ip, { count: 1, reset: now + WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= LIMIT) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

function piece(payload: GeminiChunk) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("");
}

function sse(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function pushTurn(contents: { role: "user" | "model"; parts: { text: string }[] }[], role: "user" | "model", text: string) {
  const last = contents[contents.length - 1];
  if (last && last.role === role) {
    last.parts[0] = { text: `${last.parts[0]?.text ?? ""}\n\n${text}` };
    return;
  }
  contents.push({ role, parts: [{ text }] });
}

function contentsFor(history: TutorTurn[], question: string, notes: string) {
  const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const turn of history) {
    pushTurn(contents, turn.role === "tutor" ? "model" : "user", turn.text);
  }
  pushTurn(contents, "user", `${notes}\n\nQuestion:\n${question}`);
  return contents;
}

/** The same conversation in Groq's chat shape, for the backup tutor. */
function messagesForGroq(system: string, history: TutorTurn[], question: string, notes: string): GroqMessage[] {
  const messages: GroqMessage[] = [{ role: "system", content: system }];
  const push = (role: "user" | "assistant", text: string) => {
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n\n${text}`;
      return;
    }
    messages.push({ role, content: text });
  };
  for (const turn of history) {
    push(turn.role === "tutor" ? "assistant" : "user", turn.text);
  }
  push("user", `${notes}\n\nQuestion:\n${question}`);
  return messages;
}

/**
 * Relay a provider stream to the student in NoteWise's own event shape.
 * Only the text pieces cross; the question and the notes stay out of the log.
 */
function relayStream(body: ReadableStream<Uint8Array>, extract: (payload: unknown) => string) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const text = extract(JSON.parse(data));
              if (text) controller.enqueue(encoder.encode(sse({ text })));
            } catch {
              // A broken event is skipped.
            }
          }
        }
        controller.enqueue(encoder.encode(sse({ done: true })));
      } catch {
        controller.enqueue(encoder.encode(sse({ error: "The tutor stopped while answering." })));
      } finally {
        controller.close();
      }
    },
    cancel() {
      void reader.cancel();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  const gate = allow(clientIp(request));
  if (!gate.ok) {
    return Response.json(
      { error: "Too many questions. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That question could not be sent." }, { status: 400 });
  }

  const mode = body && typeof body === "object" && !Array.isArray(body) ? (body as { mode?: unknown }).mode : undefined;
  if (mode === "exam-profile") return handleExamProfile(body, request.signal);
  if (mode === "quiz") return handleQuiz(body, request.signal);

  const parsed = parseTutorRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: parsed.status });
  }

  const gemini = readGeminiSetup();
  const groq = readGroqSetup();
  if (!gemini && !groq) {
    return Response.json({ error: "The tutor is not set up on this computer yet." }, { status: 503 });
  }

  const language = tutorLanguageOrDefault(parsed.value.language);
  const base = tutorSystemPrompt(language);
  const system = parsed.value.spoken ? `${base}${TUTOR_SPOKEN_EXTRA}` : base;
  const notes = notesForPrompt(parsed.value.chunks);
  const maxOutputTokens = parsed.value.spoken ? 512 : 768;

  // Gemini first. Its adapter already retries across Gemini models.
  let geminiStatus = 502;
  if (gemini) {
    const upstream = await openGeminiStream(
      gemini,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: contentsFor(parsed.value.history, parsed.value.question, notes),
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens,
          thinkingConfig: { thinkingLevel: "MINIMAL" },
        },
      },
      request.signal,
    );
    if (upstream.ok && upstream.body) {
      return relayStream(upstream.body, (payload) => piece(payload as GeminiChunk));
    }
    geminiStatus = upstream.status;
    await upstream.body?.cancel().catch(() => undefined);
  }

  // Backup: Groq answers only when Gemini could not.
  if (groq) {
    try {
      const backup = await openGroqStream(
        groq,
        {
          messages: messagesForGroq(system, parsed.value.history, parsed.value.question, notes),
          temperature: 0.2,
          maxTokens: maxOutputTokens,
        },
        request.signal,
      );
      if (backup.ok && backup.body) {
        return relayStream(backup.body, groqDeltaText);
      }
      await backup.body?.cancel().catch(() => undefined);
    } catch {
      // A failed backup falls through to the same error as a failed Gemini call.
    }
  }

  // Keep the student's friendly message, but pass Gemini's real status through
  // (and in the body) so a bad key or model is diagnosable instead of a flat 502.
  const status = geminiStatus >= 400 && geminiStatus < 600 ? geminiStatus : 502;
  return Response.json(
    { error: "The tutor could not answer just now.", code: "upstream_error", upstreamStatus: geminiStatus },
    { status },
  );
}
