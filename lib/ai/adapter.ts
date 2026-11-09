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

/** One JSON answer. Practice uses this so the quiz can be checked before it is shown. */
export function openGeminiContent(setup: GeminiSetup, body: unknown, signal?: AbortSignal) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(setup.model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": setup.apiKey,
      },
      body: JSON.stringify(body),
      signal,
    },
  );
}

export function openGeminiStream(setup: GeminiSetup, body: unknown, signal?: AbortSignal) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(setup.model)}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": setup.apiKey,
      },
      body: JSON.stringify(body),
      signal,
    },
  );
}
