import assert from "node:assert/strict";
import test from "node:test";
import {
  recognitionLangForTutor,
  tutorLanguageInstruction,
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
  assert.ok(TUTOR_LANGUAGE_VOICE_TAGS.pcm.includes("en-ng"));
  assert.ok(TUTOR_LANGUAGE_VOICE_TAGS.pcm.includes("en"));
  assert.equal(TUTOR_LANGUAGE_VOICE_TAGS.ha.includes("en"), false);
  assert.equal(TUTOR_LANGUAGE_VOICE_TAGS.yo.includes("en"), false);
  assert.equal(TUTOR_LANGUAGE_VOICE_TAGS.ig.includes("en"), false);
});

test("Pidgin system instruction names Naija Pidgin explicitly", () => {
  const text = tutorLanguageInstruction("pcm");
  assert.match(text, /Nigerian Pidgin|Naija/i);
  assert.match(text, /brackets/i);
});
