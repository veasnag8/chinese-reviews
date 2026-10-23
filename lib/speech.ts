'use client';

let activeAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

const findChineseVoice = (voices: SpeechSynthesisVoice[]) => {
  const exact = voices.find((voice) => voice.lang.toLowerCase() === 'zh-cn');
  if (exact) return exact;

  const mandarin = voices.find((voice) =>
    /^zh(?:-|_)/i.test(voice.lang) && /mandarin|普通话|普通話|中文|chinese/i.test(voice.name)
  );
  if (mandarin) return mandarin;

  return voices.find((voice) => /^zh(?:-|_)/i.test(voice.lang));
};

const speakWithDeviceVoice = (text: string, rate: number) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;

  const synthesis = window.speechSynthesis;
  if (synthesis.speaking || synthesis.pending) synthesis.cancel();
  if (synthesis.paused) synthesis.resume();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = rate;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voice = findChineseVoice(synthesis.getVoices());
  if (voice) utterance.voice = voice;

  activeUtterance = utterance;
  utterance.onend = () => {
    if (activeUtterance === utterance) activeUtterance = null;
  };
  utterance.onerror = () => {
    if (activeUtterance === utterance) activeUtterance = null;
  };

  // Calling resume immediately before speak fixes Android devices that leave
  // the synthesis engine paused after the browser returns from the background.
  synthesis.resume();
  synthesis.speak(utterance);
};

export const speakChinese = (text: string, audioUrl?: string | null, rate = 0.8) => {
  if (typeof window === 'undefined' || !text.trim()) return;

  activeAudio?.pause();
  activeAudio = null;

  if (!audioUrl) {
    speakWithDeviceVoice(text, rate);
    return;
  }

  try {
    const audio = new Audio();
    let usedFallback = false;
    const fallback = () => {
      if (usedFallback) return;
      usedFallback = true;
      if (activeAudio === audio) activeAudio = null;
      speakWithDeviceVoice(text, rate);
    };
    activeAudio = audio;
    audio.preload = 'auto';
    audio.setAttribute('playsinline', '');
    audio.src = audioUrl;
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
    };
    audio.onerror = fallback;
    void audio.play().catch(fallback);
  } catch {
    speakWithDeviceVoice(text, rate);
  }
};
