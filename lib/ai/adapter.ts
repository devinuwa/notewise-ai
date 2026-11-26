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
 * Models tried, in order, when Gemini cannot serve the configured one.
 * A 400 or 404 usually means the model name is retired, not available to
 * this key, or does not accept one of the request options; a 429, 500 or
 * 503 is usually that one model being out of quota or overloaded, and
 * another model often answers. Trying the current Flash-Lite / Flash
 * models keeps the app working instead of every AI feature failing at
 * once. The configured model is always tried first. Only 401 and 403
 * stop the chain: a key or permission problem affects every model.
 */
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];

const FALLBACK_STATUSES = new Set([400, 404, 429, 500, 503]);

/** One attempt never waits longer than this, so a hung model cannot eat the whole request budget. */
const ATTEMPT_TIMEOUT_MS = 20_000;

function attemptSignal(signal: AbortSignal | undefined, budgetMs?: number): AbortSignal {
  const cap = budgetMs === undefined ? ATTEMPT_TIMEOUT_MS : Math.max(1, Math.min(ATTEMPT_TIMEOUT_MS, budgetMs));
  const timeout = AbortSignal.timeout(cap);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

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
  deadlineMs?: number,
): Promise<Response> {
  // Callers on a serverless time limit pass a deadline so the whole model
  // cascade fits inside it. Without one, a row of hung models could run past
  // the function's limit, the platform would cut the connection, and the
  // student would see a raw "Failed to fetch" instead of an answer or a
  // proper error.
  const startedAt = Date.now();
  const remaining = () => (deadlineMs === undefined ? undefined : deadlineMs - (Date.now() - startedAt));
  let last: Response | null = null;
  for (const model of candidateModels(setup)) {
    let payload = body;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const budget = remaining();
      if (budget !== undefined && budget <= 250) {
        return last ?? Response.json({ error: "Gemini could not be reached in time." }, { status: 502 });
      }
      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": setup.apiKey,
            },
            body: JSON.stringify(payload),
            signal: attemptSignal(signal, budget),
          },
        );
      } catch (caught) {
        // The student cancelling (navigating away) is not a failure to retry.
        if (signal?.aborted) throw caught;
        // A network error or the per-attempt timeout: log it and try the next model
        // instead of throwing, which the routes would surface as a bare 500.
        console.error(`NoteWise: Gemini call failed (model=${model}, network error).`);
        break;
      }
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
      if (FALLBACK_STATUSES.has(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        break; // Try the next candidate model.
      }
      return response; // 401 and 403 are key or permission problems; hand the response back as before.
    }
  }
  // Every candidate was rejected or unreachable. When no response ever came back,
  // return a synthetic 502 so callers keep their normal error handling.
  if (last) return last;
  return Response.json({ error: "Gemini could not be reached." }, { status: 502 });
}

/** One JSON answer. Practice uses this so the quiz can be checked before it is shown. */
export function openGeminiContent(setup: GeminiSetup, body: unknown, signal?: AbortSignal, deadlineMs?: number) {
  return callGemini(setup, "generateContent", body, signal, deadlineMs);
}

export function openGeminiStream(setup: GeminiSetup, body: unknown, signal?: AbortSignal, deadlineMs?: number) {
  return callGemini(setup, "streamGenerateContent?alt=sse", body, signal, deadlineMs);
}
