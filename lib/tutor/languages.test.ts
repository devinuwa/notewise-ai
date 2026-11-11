import assert from "node:assert/strict";
import test from "node:test";
import {
  recognitionLangForTutor,
  tutorLanguageInstruction,
  TUTOR_LANGUAGE_LABELS,
  TUTOR_LANGUAGE_VOICE_TAGS,
} from "@/lib/tutor/languages";

test("recognition locales map to Nigerian BCP-47 tags", () => {
  assert.equal(recognitionLangForTutor("en"), "en-NG");
  assert.equal(recognitionLangForTutor("ha"), "ha-NG");
  assert.equal(recognitionLangForTutor("yo"), "yo-NG");
  assert.equal(recognitionLangForTutor("ig"), "ig-NG");
  assert.equal(recognitionLangForTutor("pcm"), "en-NG");
});

test("Pidgin may use English voices; other local languages do not", () => {
  assert.ok(TUTOR_LANGUAGE_VOICE_TAGS.pcm.includes("en-NG"));
  assert.ok(TUTOR_LANGUAGE_VOICE_TAGS.pcm.includes("en"));
  assert.equal(TUTOR_LANGUAGE_VOICE_TAGS.ha.includes("en"), false);
  assert.equal(TUTOR_LANGUAGE_VOICE_TAGS.yo.includes("en"), false);
  assert.equal(TUTOR_LANGUAGE_VOICE_TAGS.ig.includes("en"), false);
});

test("UI labels use native orthography and tone marks where available", () => {
  assert.equal(TUTOR_LANGUAGE_LABELS.yo, "Yorùbá");
  assert.equal(TUTOR_LANGUAGE_LABELS.ig, "Ígbò");
  assert.equal(TUTOR_LANGUAGE_LABELS.pcm, "Naijá");
  assert.equal(TUTOR_LANGUAGE_LABELS.ha, "Hausa");
});

test("Pidgin system instruction names Naija Pidgin explicitly", () => {
  const text = tutorLanguageInstruction("pcm");
  assert.match(text, /Nigerian Pidgin|Naijá/i);
  assert.match(text, /brackets/i);
});

test("Yoruba and Igbo instructions ask for tone marks", () => {
  assert.match(tutorLanguageInstruction("yo"), /tone marks/i);
  assert.match(tutorLanguageInstruction("yo"), /Yorùbá/);
  assert.match(tutorLanguageInstruction("ig"), /tone marks/i);
  assert.match(tutorLanguageInstruction("ig"), /Ígbò/);
});

test("Hausa instruction does not duplicate Hausa (Hausa)", () => {
  const text = tutorLanguageInstruction("ha");
  assert.match(text, /Write the whole answer in Hausa\./);
  assert.equal(text.includes("Hausa (Hausa)"), false);
});
