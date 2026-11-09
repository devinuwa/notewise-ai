/** Tutor explanation languages. Speech only when the browser lists a matching voice. */

export const TUTOR_LANGUAGES = ["en", "ha", "yo", "ig", "pcm"] as const;

export type TutorLanguage = (typeof TUTOR_LANGUAGES)[number];

export const TUTOR_LANGUAGE_LABELS: Record<TutorLanguage, string> = {
  en: "English",
  ha: "Hausa",
  yo: "Yoruba",
  ig: "Igbo",
  pcm: "Nigerian Pidgin",
};

/** BCP-47 prefixes we accept as a real voice for that language. No English stand-in for others. */
export const TUTOR_LANGUAGE_VOICE_TAGS: Record<TutorLanguage, string[]> = {
  en: ["en"],
  ha: ["ha"],
  yo: ["yo"],
  ig: ["ig"],
  pcm: ["pcm"],
};

export function isTutorLanguage(value: unknown): value is TutorLanguage {
  return typeof value === "string" && (TUTOR_LANGUAGES as readonly string[]).includes(value);
}

export function tutorLanguageOrDefault(value: unknown): TutorLanguage {
  return isTutorLanguage(value) ? value : "en";
}

/** Extra system rules so answers match the chosen language without inventing speech support. */
export function tutorLanguageInstruction(language: TutorLanguage) {
  const name = TUTOR_LANGUAGE_LABELS[language];
  if (language === "en") {
    return " Write in clear, simple English. Keep technical terms plain. If you are not sure, say you are not sure and tell the student to check with their teacher.";
  }
  return ` Write the whole answer in ${name}. Keep every technical or syllabus term in English inside brackets, for example: (photosynthesis). If you are not sure, say so in ${name} and tell the student to check with their teacher.`;
}

export function noVoiceForLanguageMessage(language: TutorLanguage) {
  const name = TUTOR_LANGUAGE_LABELS[language];
  return `This device has no ${name} speaking voice. You can still read the answer. Listen stays off for ${name} until a matching voice is installed.`;
}
