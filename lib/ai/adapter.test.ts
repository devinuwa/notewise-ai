import assert from "node:assert/strict";
import test from "node:test";

import { openGeminiContent, type GeminiSetup } from "./adapter";

const setup: GeminiSetup = { apiKey: "test-key", model: "gemini-old-model" };

type Call = { url: string; body: Record<string, unknown> };

function stubFetch(handler: (call: Call, index: number) => Response) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    };
    calls.push(call);
    return handler(call, calls.length - 1);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

function reply(status: number) {
  return new Response(status === 200 ? "{}" : "error", { status });
}

test("a retired configured model falls back to a current model", async () => {
  const stub = stubFetch((call) => (call.url.includes("gemini-old-model") ? reply(404) : reply(200)));
  try {
    const response = await openGeminiContent(setup, { contents: [] });
    assert.equal(response.ok, true);
    assert.equal(stub.calls.length, 2);
    assert.match(stub.calls[1].url, /gemini-3\.5-flash-lite/);
  } finally {
    stub.restore();
  }
});

test("a 400 with thinkingConfig retries the same model without it", async () => {
  const stub = stubFetch((call) => {
    const config = call.body.generationConfig as Record<string, unknown> | undefined;
    return config && "thinkingConfig" in config ? reply(400) : reply(200);
  });
  try {
    const response = await openGeminiContent(setup, {
      contents: [],
      generationConfig: { temperature: 0, thinkingConfig: { thinkingLevel: "MINIMAL" } },
    });
    assert.equal(response.ok, true);
    assert.equal(stub.calls.length, 2);
    assert.match(stub.calls[1].url, /gemini-old-model/);
    const config = stub.calls[1].body.generationConfig as Record<string, unknown>;
    assert.equal("thinkingConfig" in config, false);
  } finally {
    stub.restore();
  }
});

test("an overloaded configured model falls back to the next model", async () => {
  const stub = stubFetch((call) => (call.url.includes("gemini-old-model") ? reply(503) : reply(200)));
  try {
    const response = await openGeminiContent(setup, { contents: [] });
    assert.equal(response.ok, true);
    assert.equal(stub.calls.length, 2);
    assert.match(stub.calls[1].url, /gemini-3\.5-flash-lite/);
  } finally {
    stub.restore();
  }
});

test("a network error on the configured model falls back, and total failure returns 502 instead of throwing", async () => {
  const stub = stubFetch((call) => {
    if (call.url.includes("gemini-old-model")) throw new Error("socket hang up");
    return reply(200);
  });
  try {
    const response = await openGeminiContent(setup, { contents: [] });
    assert.equal(response.ok, true);
    assert.equal(stub.calls.length, 2);
  } finally {
    stub.restore();
  }

  const dead = stubFetch(() => {
    throw new Error("socket hang up");
  });
  try {
    const response = await openGeminiContent(setup, { contents: [] });
    assert.equal(response.status, 502);
  } finally {
    dead.restore();
  }
});

test("a 403 is returned at once, without trying other models", async () => {
  const stub = stubFetch(() => reply(403));
  try {
    const response = await openGeminiContent(setup, { contents: [] });
    assert.equal(response.status, 403);
    assert.equal(stub.calls.length, 1);
  } finally {
    stub.restore();
  }
});
