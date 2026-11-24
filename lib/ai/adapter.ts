export type GeminiSetup = {
  apiKey: string;
  model: string;
};

/** The key and model name stay on the server. Handwriting and the tutor both use them. */
export function readGeminiSetup(): GeminiSetup | null {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model || !/^[a-zA-Z0-9._-]+$/.test(model)) return null;
  return { apiKey, model };
}

/**
 * Models tried, in order, when Gemini rejects the configured one with a
 * 400 or 404. That rejection usually means the configured model name is
 * retired or not available to this key, or that the model does not accept
 * one of the request options. Trying the current Flash-Lite / Flash models
 * keeps the app working when a model name ages out, instead of every AI
 * feature failing at once. The configured model is always tried first.
 */
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

function candidateModels(setup: GeminiSetup): string[] {
  return [...new Set([setup.model, ...FALLBACK_MODELS])];
}

/** A copy of the request body without generationConfig.thinkingConfig, or null when there is none to strip. */
function withoutThinkingConfig(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const config = record.generationConfig;
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const generationConfig = { ...(config as Record<string, unknown>) };
  if (!("thinkingConfig" in generationConfig)) return null;
  delete generationConfig.thinkingConfig;
  return { ...record, generationConfig };
}

async function callGemini(
  setup: GeminiSetup,
  method: "generateContent" | "streamGenerateContent?alt=sse",
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  let last: Response | null = null;
  for (const model of candidateModels(setup)) {
    let payload = body;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": setup.apiKey,
          },
          body: JSON.stringify(payload),
          signal,
        },
      );
      if (response.ok) return response;
      last = response;
      // Status and model only. The key and the student's text never go to the log.
      console.error(`NoteWise: Gemini call failed (model=${model}, status=${response.status}).`);
      if (attempt === 0 && response.status === 400) {
        const stripped = withoutThinkingConfig(payload);
        if (stripped) {
          payload = stripped;
          await response.body?.cancel().catch(() => undefined);
          continue;
        }
      }
      if (response.status === 400 || response.status === 404) {
        await response.body?.cancel().catch(() => undefined);
        break; // Try the next candidate model.
      }
      return response; // 401, 403, 429 and 5xx are not model problems; hand the response back as before.
    }
  }
  // Every candidate was rejected. last is always set here because the loop ran at least once.
  return last as Response;
}

/** One JSON answer. Practice uses this so the quiz can be checked before it is shown. */
export function openGeminiContent(setup: GeminiSetup, body: unknown, signal?: AbortSignal) {
  return callGemini(setup, "generateContent", body, signal);
}

export function openGeminiStream(setup: GeminiSetup, body: unknown, signal?: AbortSignal) {
  return callGemini(setup, "streamGenerateContent?alt=sse", body, signal);
}
