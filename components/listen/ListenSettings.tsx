"use client";

import { NO_SPEECH_MESSAGE, NO_VOICE_MESSAGE } from "@/lib/listen/copy";
import { rateLabel, SPEECH_RATES, type SpeechRate } from "@/lib/listen/rates";
import { orderedVoices, preferredVoice, useVoices } from "@/lib/listen/voices";
import { saveListenPrefs } from "@/lib/notebook";

export function ListenSettings({ rate, voiceURI }: { rate: SpeechRate; voiceURI: string }) {
  const voices = useVoices();
  const selected = preferredVoice(voices.voices, voiceURI)?.voiceURI ?? "";

  return (
    <section className="mt-8">
      <p className="nw-mono text-[12px] text-muted" id="listen-settings">
        Listening
      </p>
      <p className="mt-2 max-w-xl text-base text-ink">
        The voice and speed you pick here are used the next time you press Listen. Notes are read on this phone.
      </p>
      {!voices.supported ? (
        <p className="mt-3 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
          {NO_SPEECH_MESSAGE}
        </p>
      ) : null}
      {voices.settled && voices.voices.length === 0 ? (
        <p className="mt-3 border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
          {NO_VOICE_MESSAGE}
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-4 gap-2" role="radiogroup" aria-labelledby="listen-settings">
        {SPEECH_RATES.map((item) => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={rate === item}
            className={rate === item ? "listen-speed is-on" : "listen-speed"}
            onClick={() => void saveListenPrefs({ speechRate: item })}
          >
            {rateLabel(item)}
          </button>
        ))}
      </div>
      <label className="mt-4 block max-w-xl">
        <span className="nw-mono text-[12px] text-muted">Voice</span>
        <select
          className="nw-input mt-1"
          value={voices.voices.length === 0 ? "" : selected}
          disabled={!voices.settled || voices.voices.length === 0}
          onChange={(event) => void saveListenPrefs({ voiceURI: event.target.value })}
        >
          {voices.voices.length === 0 ? <option value="">{voices.settled ? "No voice yet" : "Finding a voice..."}</option> : null}
          {orderedVoices(voices.voices).map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
