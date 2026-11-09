"use client";

import {
  noVoiceForLanguageMessage,
  TUTOR_LANGUAGE_LABELS,
  TUTOR_LANGUAGE_VOICE_TAGS,
  TUTOR_LANGUAGES,
  tutorLanguageOrDefault,
  type TutorLanguage,
} from "@/lib/tutor/languages";
import { saveTutorLanguage } from "@/lib/notebook";
import { useVoices, voiceForLanguageTags } from "@/lib/listen/voices";

export function TutorLanguageSettings({ value }: { value?: TutorLanguage }) {
  const language = tutorLanguageOrDefault(value);
  const voices = useVoices();
  const hasVoice = Boolean(voiceForLanguageTags(voices.voices, TUTOR_LANGUAGE_VOICE_TAGS[language]));

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
        <p className="nw-mono text-[12px] text-muted" id="tutor-language">
          Tutor language
        </p>
        <span className="nw-chip bg-yellow text-ink">Beta</span>
      </div>
      <p className="mt-2 max-w-xl text-base text-ink">
        Tutor explanations use this language. Technical terms stay in English in brackets. Live Tutor and chat both
        follow this choice.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap" role="radiogroup" aria-labelledby="tutor-language">
        {TUTOR_LANGUAGES.map((code) => (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={language === code}
            className={`nw-btn min-h-11 w-full sm:w-auto ${language === code ? "" : "nw-btn-secondary"}`}
            onClick={() => void saveTutorLanguage(code)}
          >
            {TUTOR_LANGUAGE_LABELS[code]}
          </button>
        ))}
      </div>
      {voices.settled && !hasVoice ? (
        <p className="mt-3 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
          {noVoiceForLanguageMessage(language)}
        </p>
      ) : null}
      {voices.settled && hasVoice && language !== "en" ? (
        <p className="mt-3 text-sm text-muted">
          This device has a matching voice for {TUTOR_LANGUAGE_LABELS[language]}, so Listen can speak Tutor answers.
        </p>
      ) : null}
    </section>
  );
}
