import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors flag logic in tesseract.ts — kept local so the worker stays browser-only. */
function flagUncertainWords(
  text: string,
  words: { text?: string; confidence?: number }[] | undefined,
  floor = 70,
) {
  if (!words?.length || !text) return [];
  const flagged: { text: string; index: number }[] = [];
  let cursor = 0;
  for (const word of words) {
    const piece = word.text ?? "";
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const at = text.indexOf(trimmed, cursor);
    if (at < 0) continue;
    cursor = at + trimmed.length;
    const confidence = typeof word.confidence === "number" ? word.confidence : 100;
    if (confidence < floor) flagged.push({ text: trimmed, index: at });
  }
  return flagged;
}

test("low-confidence Tesseract words become review flags", () => {
  const text = "Mitosis splits one cell";
  const flags = flagUncertainWords(text, [
    { text: "Mitosis", confidence: 92 },
    { text: "splits", confidence: 88 },
    { text: "one", confidence: 40 },
    { text: "cell", confidence: 91 },
  ]);
  assert.equal(flags.length, 1);
  assert.equal(flags[0]?.text, "one");
  assert.equal(flags[0]?.index, text.indexOf("one"));
});

/** Mirrors tidyText in tesseract.ts — raw vs cleaned stay separate for the OCR cache contract. */
function tidyText(raw: string) {
  return raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

test("device OCR keeps raw Tesseract text apart from tidied review text", () => {
  const rawText = "Mitosis  \n\n\nsplits one cell\n";
  const text = tidyText(rawText);
  assert.notEqual(rawText, text);
  assert.equal(text, "Mitosis\n\nsplits one cell");
  // Cache contract: rawOcrText stores rawText; result.text stores tidied text.
  const run = { rawOcrText: rawText, result: { text } };
  assert.equal(run.rawOcrText, rawText);
  assert.equal(run.result.text, text);
});
