"use client";

import { useEffect, useRef } from "react";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { PixelLoader } from "@/components/ui/PixelLoader";
import { useListen } from "@/components/listen/ListenProvider";
import { NO_SPEECH_MESSAGE, NO_VOICE_MESSAGE } from "@/lib/listen/copy";
import { rateLabel, SPEECH_RATES } from "@/lib/listen/rates";
import { orderedVoices, preferredVoice, useVoices } from "@/lib/listen/voices";

export function MiniPlayer() {
  const listen = useListen();
  const voices = useVoices();
  const bar = useRef<HTMLElement>(null);
  const cue = listen.cues[listen.index];
  const open = listen.cues.length > 0;

  useEffect(() => {
    const node = bar.current;
    if (!node) return;
    const apply = () => {
      document.documentElement.style.setProperty("--listen-h", `${node.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--listen-h");
    };
  }, [open]);

  if (!open || !cue) return null;

  const waiting = listen.status === "playing" && !voices.settled && voices.voices.length === 0;
  const noVoices = voices.settled && voices.voices.length === 0;
  const selected = preferredVoice(voices.voices, listen.voiceURI)?.voiceURI ?? "";
  const playing = listen.status === "playing";

  return (
    <section ref={bar} className="listen-player" aria-label="Listen">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <p className="nw-mono text-[12px] text-muted">{cue.label}</p>
          <button type="button" className="nw-mono text-[12px] text-ink underline" onClick={listen.close}>
            <X aria-hidden size={16} strokeWidth={2.4} className="mr-1 inline" />
            Close
          </button>
        </div>
        <p className="line-clamp-2 text-base text-ink">{cue.text}</p>
        {voices.supported ? null : (
          <p className="border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
            {NO_SPEECH_MESSAGE}
          </p>
        )}
        {noVoices ? (
          <p className="border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="status">
            {NO_VOICE_MESSAGE}
          </p>
        ) : null}
        {waiting ? <PixelLoader caption="Finding a voice..." tone="on-paper" /> : null}
        {listen.error ? (
          <p className="border-2 border-ink bg-yellow px-3 py-2 text-sm text-ink" role="alert">
            {listen.error}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <button type="button" className="listen-icon" aria-label="Previous sentence" onClick={listen.previous}>
            <SkipBack aria-hidden size={18} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className="listen-icon is-play"
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
            disabled={!voices.supported || noVoices}
            onClick={listen.toggle}
          >
            {playing ? <Pause aria-hidden size={18} strokeWidth={2.4} /> : <Play aria-hidden size={18} strokeWidth={2.4} />}
          </button>
          <button type="button" className="listen-icon" aria-label="Next sentence" onClick={listen.next}>
            <SkipForward aria-hidden size={18} strokeWidth={2.4} />
          </button>
          <p className="nw-mono ml-auto text-[12px] text-ink">
            {listen.index + 1} of {listen.cues.length}
          </p>
        </div>
        <div role="radiogroup" aria-label="Speed" className="grid grid-cols-4 gap-2">
          {SPEECH_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              role="radio"
              aria-checked={listen.rate === rate}
              className={listen.rate === rate ? "listen-speed is-on" : "listen-speed"}
              onClick={() => listen.chooseRate(rate)}
            >
              {rateLabel(rate)}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="nw-mono text-[12px] text-muted">Voice</span>
          <select
            className="nw-input mt-1"
            value={selected}
            disabled={voices.voices.length === 0}
            onChange={(event) => listen.chooseVoice(event.target.value)}
          >
            {voices.voices.length === 0 ? <option value="">No voice yet</option> : null}
            {orderedVoices(voices.voices).map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="nw-mono text-[12px] text-muted">Sentence progress</span>
          <input
            className="listen-range mt-1"
            type="range"
            min={0}
            max={Math.max(0, listen.cues.length - 1)}
            step={1}
            value={listen.index}
            aria-valuetext={`Sentence ${listen.index + 1} of ${listen.cues.length}`}
            onChange={(event) => listen.seek(Number(event.target.value))}
          />
        </label>
      </div>
    </section>
  );
}
