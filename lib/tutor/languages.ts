/** Tutor explanation languages. Speech only when the browser lists a matching voice. */

export const TUTOR_LANGUAGES = ["en", "ha", "yo", "ig", "pcm"] as const;

export type TutorLanguage = (typeof TUTOR_LANGUAGES)[number];

/** Button / chip labels — native orthography and tone marks where the language uses them. */
export const TUTOR_LANGUAGE_LABELS: Record<TutorLanguage, string> = {
  en: "English",
  ha: "Hausa",
  yo: "Yorùbá",
  ig: "Ígbò",
  pcm: "Naijá",
};

/** Plain English names for prompts and screen-reader hints. */
export const TUTOR_LANGUAGE_NAMES_EN: Record<TutorLanguage, string> = {
  en: "English",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
  pcm: "Nigerian Pidgin",
};

/**
 * BCP-47 prefixes we accept as a real voice for that language.
 * Hausa / Yoruba / Igbo never fall back to English (that would mislead students).
 * Nigerian Pidgin has no dedicated OS voice; English (especially en-NG) can read
 * Latin-script Pidgin aloud, which is how phones in Nigeria usually handle it.
 */
export const TUTOR_LANGUAGE_VOICE_TAGS: Record<TutorLanguage, string[]> = {
  en: ["en"],
  ha: ["ha"],
  yo: ["yo"],
  ig: ["ig"],
  pcm: ["pcm", "en-NG", "en"],
};

/** SpeechRecognition `lang` for Live Tutor listening. */
export function recognitionLangForTutor(language: TutorLanguage): string {
  switch (language) {
    case "ha":
      return "ha-NG";
    case "yo":
      return "yo-NG";
    case "ig":
      return "ig-NG";
    case "pcm":
      // Chrome rarely exposes pcm; en-NG is the practical listening locale in Nigeria.
      return "en-NG";
    default:
      return "en-NG";
  }
}

export function isTutorLanguage(value: unknown): value is TutorLanguage {
  return typeof value === "string" && (TUTOR_LANGUAGES as readonly string[]).includes(value);
}

export function tutorLanguageOrDefault(value: unknown): TutorLanguage {
  return isTutorLanguage(value) ? value : "en";
}

/** Extra system rules so answers match the chosen language without inventing speech support. */
export function tutorLanguageInstruction(language: TutorLanguage) {
  const name = TUTOR_LANGUAGE_NAMES_EN[language];
  const label = TUTOR_LANGUAGE_LABELS[language];
  if (language === "en") {
    return " Write in clear, simple English. Keep technical terms plain. If you are not sure, say you are not sure and tell the student to check with their teacher.";
  }
  if (language === "pcm") {
    return ` Write the whole answer in Nigerian Pidgin (Naijá). Keep every technical or syllabus term in English inside brackets, for example: (photosynthesis). Use everyday Naijá a secondary-school student in Nigeria would understand. If you are not sure, say so in Naijá and tell the student to check with their teacher.`;
  }
  if (language === "yo") {
    return ` Write the whole answer in Yoruba (Yorùbá). Use correct Yorùbá tone marks (à, é, ẹ, í, ó, ọ, ú, etc.) whenever you can. Keep every technical or syllabus term in English inside brackets, for example: (photosynthesis). If you are not sure, say so in Yorùbá and tell the student to check with their teacher.`;
  }
  if (language === "ig") {
    return ` Write the whole answer in Igbo (Ígbò). Use correct Igbo tone marks and dotted vowels (ị, ọ, ụ, etc.) whenever you can. Keep every technical or syllabus term in English inside brackets, for example: (photosynthesis). If you are not sure, say so in Ígbò and tell the student to check with their teacher.`;
  }
  // Hausa: Latin orthography; no English stand-in for the spoken language name.
  return ` Write the whole answer in ${name} (${label}). Keep every technical or syllabus term in English inside brackets, for example: (photosynthesis). If you are not sure, say so in ${name} and tell the student to check with their teacher.`;
}

export function noVoiceForLanguageMessage(language: TutorLanguage) {
  const label = TUTOR_LANGUAGE_LABELS[language];
  const english = TUTOR_LANGUAGE_NAMES_EN[language];
  const shown = label === english ? label : `${label} (${english})`;
  return `This device has no ${shown} speaking voice. You can still read the answer. Listen stays off for ${label} until a matching voice is installed.`;
}
