export type MicMeter = {
  level: () => number;
  stop: () => void;
};

/**
 * Mic volume for the orb. RMS of the time-domain samples follows loudness better than a raw peak.
 * Returns null when permission is denied or getUserMedia is missing.
 */
export async function openMicMeter(): Promise<MicMeter | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
  } catch {
    return null;
  }

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    stream.getTracks().forEach((track) => track.stop());
    return null;
  }

  const context = new AudioCtx();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let last = 0;

  return {
    level() {
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const centered = ((samples[i] ?? 128) - 128) / 128;
        sum += centered * centered;
      }
      const rms = Math.sqrt(sum / samples.length);
      // Soft floor so quiet rooms do not flicker; soft ceiling so shouts do not explode the orb.
      const next = Math.min(1, Math.max(0, (rms - 0.02) / 0.35));
      last = last * 0.65 + next * 0.35;
      return last;
    },
    stop() {
      source.disconnect();
      analyser.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      void context.close().catch(() => undefined);
    },
  };
}
