import assert from "node:assert/strict";
import test from "node:test";

import { groqChatText, groqDeltaText, openGroqStream, type GroqSetup } from "./groq";

const setup: GroqSetup = { apiKey: "test-key", model: "llama-test" };

type Call = { url: string; init?: RequestInit };

function stubFetch(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const call: Call = { url: String(url), init };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

test("groqDeltaText reads the delta content and ignores empty chunks", () => {
  assert.equal(groqDeltaText({ choices: [{ delta: { content: "Hello" } }] }), "Hello");
  assert.equal(groqDeltaText({ choices: [{ delta: {} }] }), "");
  assert.equal(groqDeltaText({ choices: [] }), "");
  assert.equal(groqDeltaText(null), "");
  assert.equal(groqDeltaText("noise"), "");
});

test("groqChatText posts to Groq with the key as a bearer token and returns the message", async () => {
  const stub = stubFetch(
    () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "{\"questions\":[]}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  try {
    const text = await groqChatText(setup, {
      messages: [{ role: "user", content: "Write a quiz" }],
      json: true,
    });
    assert.equal(text, "{\"questions\":[]}");
    assert.equal(stub.calls.length, 1);
    assert.match(stub.calls[0].url, /api\.groq\.com\/openai\/v1\/chat\/completions/);
    const headers = stub.calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.authorization, "Bearer test-key");
    const body = JSON.parse(String(stub.calls[0].init?.body)) as Record<string, unknown>;
    assert.equal(body.model, "llama-test");
    assert.deepEqual(body.response_format, { type: "json_object" });
  } finally {
    stub.restore();
  }
});

test("groqChatText returns null when Groq rejects the call", async () => {
  const stub = stubFetch(() => new Response("nope", { status: 429 }));
  try {
    const text = await groqChatText(setup, { messages: [{ role: "user", content: "Hi" }] });
    assert.equal(text, null);
  } finally {
    stub.restore();
  }
});

test("openGroqStream asks for a stream", async () => {
  const stub = stubFetch(() => new Response("", { status: 200 }));
  try {
    const response = await openGroqStream(setup, { messages: [{ role: "user", content: "Hi" }] });
    assert.equal(response.ok, true);
    const body = JSON.parse(String(stub.calls[0].init?.body)) as Record<string, unknown>;
    assert.equal(body.stream, true);
  } finally {
    stub.restore();
  }
});
