type Handlers = {
  onDone: () => void;
  onError: (message: string) => void;
};

let token = 0;
let timer = 0;

export function stopSpeaking() {
  token += 1;
  window.clearTimeout(timer);
  window.speechSynthesis?.cancel();
}

/**
 * Android Chrome cuts off one long utterance, and pause() often never resumes.
 * Each sentence is spoken on its own. Pausing cancels speech and keeps the index.
 * cancel() can also swallow the next speak(), so a follow-up sentence waits a moment.
 */
export function speakSentence(text: string, rate: number, voiceURI: string, handlers: Handlers) {
  const synth = window.speechSynthesis;
  if (!synth) {
    handlers.onError("This browser cannot speak notes yet. Try Chrome on this phone.");
    return;
  }
  const my = ++token;
  const run = () => {
    if (token !== my) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    const voice = synth.getVoices().find((item) => item.voiceURI === voiceURI);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }
    utterance.onend = () => {
      if (token !== my) return;
      handlers.onDone();
    };
    utterance.onerror = (event) => {
      if (token !== my) return;
      if (event.error === "canceled" || event.error === "interrupted") return;
      token += 1;
      handlers.onError("This device could not read that sentence. Try another voice.");
    };
    synth.speak(utterance);
  };
  if (synth.speaking || synth.pending) {
    synth.cancel();
    timer = window.setTimeout(run, 60);
  } else {
    run();
  }
}
