import { openGeminiStream, readGeminiSetup } from "@/lib/ai/adapter";
import { HANDWRITING_TRANSCRIPTION_PROMPT } from "@/lib/ai/prompts";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024;
const WINDOW_MS = 60_000;
const LIMIT = 12;

export const maxDuration = 30;

// One process only. A restart, or a second server, starts the count again.
const buckets = new Map<string, { count: number; reset: number }>();

class ImageProblem extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

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

function mimeOf(value: string) {
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

async function bytesFromBase64(value: string, mime: string) {
  const type = mimeOf(mime);
  if (!ALLOWED.has(type)) {
    throw new ImageProblem(415, "Use a JPEG, PNG, or WebP photo.");
  }
  const packed = value.replace(/\s/g, "");
  if (Math.floor((packed.length * 3) / 4) > MAX_BYTES) {
    throw new ImageProblem(413, "That photo is larger than 4 MB.");
  }
  const bytes = Buffer.from(packed, "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    throw new ImageProblem(413, "That photo is larger than 4 MB.");
  }
  return { bytes, mime: type };
}

async function readImage(request: Request) {
  const type = mimeOf(request.headers.get("content-type") ?? "");
  if (type.startsWith("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) throw new ImageProblem(400, "Choose a photo to read.");
    const mime = mimeOf(file.type);
    if (!ALLOWED.has(mime)) throw new ImageProblem(415, "Use a JPEG, PNG, or WebP photo.");
    if (file.size > MAX_BYTES) throw new ImageProblem(413, "That photo is larger than 4 MB.");
    return { bytes: Buffer.from(await file.arrayBuffer()), mime };
  }
  if (type === "application/json") {
    const body = (await request.json()) as { imageBase64?: unknown; mimeType?: unknown };
    if (typeof body.imageBase64 !== "string" || typeof body.mimeType !== "string") {
      throw new ImageProblem(400, "Choose a photo to read.");
    }
    return bytesFromBase64(body.imageBase64, body.mimeType);
  }
  throw new ImageProblem(415, "Use a JPEG, PNG, or WebP photo.");
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

export async function POST(request: Request) {
  const gate = allow(clientIp(request));
  if (!gate.ok) {
    return Response.json(
      { error: "Too many reading requests. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  let image: { bytes: Buffer; mime: string };
  try {
    image = await readImage(request);
  } catch (caught) {
    const status = caught instanceof ImageProblem ? caught.status : 400;
    const message = caught instanceof ImageProblem ? caught.message : "That photo could not be read.";
    return Response.json({ error: message }, { status });
  }

  const setup = readGeminiSetup();
  if (!setup) {
    return Response.json(
      { error: "Cloud reading is not set up.", code: "not_configured" },
      { status: 503 },
    );
  }

  const upstream = await openGeminiStream(
    setup,
    {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: image.mime, data: image.bytes.toString("base64") } },
            { text: HANDWRITING_TRANSCRIPTION_PROMPT },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: "MINIMAL" },
      },
    },
    request.signal,
  );

  if (!upstream.ok || !upstream.body) {
    return Response.json(
      { error: "The handwriting service could not read this page." },
      { status: upstream.ok ? 502 : upstream.status },
    );
  }

  const reader = upstream.body.getReader();
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
              const text = piece(JSON.parse(data) as GeminiChunk);
              if (text) controller.enqueue(encoder.encode(sse({ text })));
            } catch {
              // A broken event is skipped. The photo and any text stay out of the log.
            }
          }
        }
        controller.enqueue(encoder.encode(sse({ done: true })));
      } catch {
        controller.enqueue(encoder.encode(sse({ error: "The handwriting service stopped." })));
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
    },
  });
}
