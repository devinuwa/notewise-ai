import { preferredVoice, getVoiceSnapshot } from "@/lib/listen/voices";

type Handlers = {
  onAmplitude: (level: number) => void;
  onSentence: (text: string) => void;
  onIdle: () => void;
  onError: (message: string) => void;
};

/**
 * Speak sentences one by one. speechSynthesis has no audio stream, so amplitude is a
 * sine/noise signal boosted on each word boundary event.
 */
export class LiveSpeaker {
  private queue: string[] = [];
  private token = 0;
  private timer = 0;
  private raf = 0;
  private speaking = false;
  private boost = 0;
  private phase = 0;
  private handlers: Handlers;
  private rate: number;
  private voiceURI: string;

  constructor(handlers: Handlers, rate = 1, voiceURI = "") {
    this.handlers = handlers;
    this.rate = rate;
    this.voiceURI = voiceURI;
  }

  setVoice(rate: number, voiceURI: string) {
    this.rate = rate;
    this.voiceURI = voiceURI;
  }

  get busy() {
    return this.speaking || this.queue.length > 0;
  }

  enqueue(sentences: string[]) {
    for (const sentence of sentences) {
      const text = sentence.trim();
      if (text) this.queue.push(text);
    }
    if (!this.speaking) this.pump();
  }

  stop() {
    this.token += 1;
    this.queue = [];
    this.speaking = false;
    window.clearTimeout(this.timer);
    window.cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.speechSynthesis?.cancel();
    this.handlers.onAmplitude(0);
  }

  private pump() {
    const synth = window.speechSynthesis;
    if (!synth) {
      this.handlers.onError("This browser cannot speak yet. Try Chrome on this phone.");
      this.queue = [];
      this.speaking = false;
      this.handlers.onIdle();
      return;
    }
    const text = this.queue.shift();
    if (!text) {
      this.speaking = false;
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.handlers.onAmplitude(0);
      this.handlers.onIdle();
      return;
    }

    this.speaking = true;
    this.handlers.onSentence(text);
    const my = ++this.token;
    const run = () => {
      if (this.token !== my) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.rate;
      const voice = preferredVoice(getVoiceSnapshot().voices, this.voiceURI);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = "en-NG";
      }
      utterance.onboundary = () => {
        if (this.token !== my) return;
        this.boost = 1;
      };
      utterance.onend = () => {
        if (this.token !== my) return;
        this.pump();
      };
      utterance.onerror = (event) => {
        if (this.token !== my) return;
        if (event.error === "canceled" || event.error === "interrupted") return;
        this.queue = [];
        this.speaking = false;
        window.cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.handlers.onAmplitude(0);
        this.handlers.onError("This device could not speak that answer. Try another voice in Settings.");
        this.handlers.onIdle();
      };
      this.tickAmp(my);
      synth.speak(utterance);
    };

    if (synth.speaking || synth.pending) {
      synth.cancel();
      this.timer = window.setTimeout(run, 60);
    } else {
      run();
    }
  }

  private tickAmp(my: number) {
    window.cancelAnimationFrame(this.raf);
    const step = () => {
      if (this.token !== my || !this.speaking) {
        this.handlers.onAmplitude(0);
        return;
      }
      this.phase += 0.18;
      this.boost *= 0.86;
      const wave = 0.35 + 0.25 * Math.sin(this.phase) + 0.12 * Math.sin(this.phase * 2.7);
      const noise = (Math.random() - 0.5) * 0.08;
      const level = Math.min(1, Math.max(0, wave + noise + this.boost * 0.55));
      this.handlers.onAmplitude(level);
      this.raf = window.requestAnimationFrame(step);
    };
    this.raf = window.requestAnimationFrame(step);
  }
}
