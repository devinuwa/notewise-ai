import assert from "node:assert/strict";
import test from "node:test";

import { handleExamProfile } from "./analyse";

const PAPER =
  "School exam. Digital Electronics. Answer all questions. 1. What is the binary of 10? A. 1010 B. 1100 C. 1001 D. 1111";

const PROFILE = {
  optionCount: 4,
  averageQuestionLength: 6,
  questionTypes: { recall: 1, calculation: 0, comprehension: 0, application: 0 },
  topics: [{ topic: "Number systems", count: 1 }],
  difficultyMix: { easy: 1, hard: 0 },
  wordingPatterns: ["What is the"],
  samples: [{ question: "What is the binary of 10?", options: ["1010", "1100", "1001", "1111"] }],
};

function withEnv(run: () => Promise<void>) {
  const saved = { ...process.env };
  process.env.GEMINI_API_KEY = "test-gemini-key";
  process.env.GEMINI_MODEL = "gemini-test-model";
  process.env.GROQ_API_KEY = "test-groq-key";
  return run().finally(() => {
    process.env = saved;
  });
}

test("exam profile falls back to Groq when every Gemini model fails", async () => {
  await withEnv(async () => {
    const original = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (url: string | URL) => {
      const target = String(url);
      urls.push(target);
      if (target.includes("generativelanguage.googleapis.com")) {
        return new Response("overloaded", { status: 503 });
      }
      if (target.includes("api.groq.com")) {
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(PROFILE) } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch to ${target}`);
    }) as typeof fetch;
    try {
      const response = await handleExamProfile({
        mode: "exam-profile",
        examBody: "School exam",
        subject: "Digital Electronics",
        year: 2017,
        text: PAPER,
      });
      assert.equal(response.status, 200);
      const payload = (await response.json()) as { profile?: { topics?: unknown[]; samples?: unknown[] } };
      assert.equal(payload.profile?.topics?.length, 1);
      assert.equal(payload.profile?.samples?.length, 1);
      assert.ok(urls.some((url) => url.includes("api.groq.com")), "Groq should have been asked");
    } finally {
      globalThis.fetch = original;
    }
  });
});

test("exam profile rejects a request with too little paper text", async () => {
  await withEnv(async () => {
    const response = await handleExamProfile({
      mode: "exam-profile",
      examBody: "School exam",
      subject: "Digital Electronics",
      year: 2017,
      text: "too short",
    });
    assert.equal(response.status, 400);
  });
});
