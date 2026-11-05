'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { GoogleGenAI } from '@google/genai';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { LiveConnectConfig, Session } from '@google/genai';
import { supabase } from '@/lib/supabase';

const languageOptions = ['Chinese', 'English', 'Khmer', 'Korean', 'French'] as const;
const levelOptions = [
  "I'm new to this language",
  'I know some common words',
  'I can have basic conversations',
  'I can talk about various topics',
  'I can discuss most topics in detail',
] as const;
const reasonOptions = [
  'Support my education',
  'Spend time productively',
  'Connect with people',
  'Prepare for travel',
  'Boost my career',
  'Just for fun',
] as const;
const goalOptions = ['Once a week', '2–3 times a week', '3–5 times a week', 'Every day'] as const;

type LearningProfile = {
  language: (typeof languageOptions)[number];
  level: (typeof levelOptions)[number];
  reason: (typeof reasonOptions)[number];
  goal: (typeof goalOptions)[number];
};
type ChatMessage = { role: 'user' | 'assistant'; text: string };
type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.some((item) => item === value);
}

function isLearningProfile(value: unknown): value is LearningProfile {
  if (!isRecord(value)) return false;
  return isOneOf(value.language, languageOptions) &&
    isOneOf(value.level, levelOptions) &&
    isOneOf(value.reason, reasonOptions) &&
    isOneOf(value.goal, goalOptions);
}

function encodeAudioForGemini(samples: Float32Array, sampleRate: number) {
  const ratio = sampleRate / 16_000;
  const outputLength = Math.floor(samples.length / ratio);
  const pcm = new Int16Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const fraction = position - leftIndex;
    const sample = Math.max(-1, Math.min(1, samples[leftIndex] * (1 - fraction) + samples[rightIndex] * fraction));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function decodePcmAudio(data: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Int16Array(bytes.buffer);
}

const khmerLanguage: Record<(typeof languageOptions)[number], string> = {
  Chinese: 'ភាសាចិន',
  English: 'ភាសាអង់គ្លេស',
  Khmer: 'ភាសាខ្មែរ',
  Korean: 'ភាសាកូរ៉េ',
  French: 'ភាសាបារាំង',
};

const questions = [
  { title: 'What would you like to learn?', subtitle: 'តើអ្នកចង់រៀនភាសាអ្វី?' },
  { title: 'How much {language} do you know?', subtitle: 'តើអ្នកចេះភាសានេះកម្រិតណាហើយ?' },
  { title: 'Why are you learning {language}?', subtitle: 'តើអ្នករៀនភាសានេះដើម្បីអ្វី?' },
  { title: 'What is your daily learning goal?', subtitle: 'តើអ្នកចង់ហាត់រៀនញឹកញាប់ប៉ុណ្ណា?' },
];

const optionKhmer: Record<string, string> = {
  "I'm new to this language": 'ខ្ញុំទើបចាប់ផ្ដើមរៀន',
  'I know some common words': 'ខ្ញុំស្គាល់ពាក្យទូទៅខ្លះៗ',
  'I can have basic conversations': 'ខ្ញុំអាចសន្ទនាមូលដ្ឋានបាន',
  'I can talk about various topics': 'ខ្ញុំអាចនិយាយអំពីប្រធានបទផ្សេងៗ',
  'I can discuss most topics in detail': 'ខ្ញុំអាចពិភាក្សាប្រធានបទភាគច្រើនបានលម្អិត',
  'Support my education': 'ជួយដល់ការសិក្សា',
  'Spend time productively': 'ចំណាយពេលវេលាឱ្យមានប្រយោជន៍',
  'Connect with people': 'ទាក់ទង និងសន្ទនាជាមួយអ្នកដទៃ',
  'Prepare for travel': 'ត្រៀមខ្លួនសម្រាប់ការធ្វើដំណើរ',
  'Boost my career': 'បង្កើនឱកាសការងារ',
  'Just for fun': 'រៀនដើម្បីភាពរីករាយ',
  'Once a week': 'មួយដងក្នុងមួយសប្ដាហ៍',
  '2–3 times a week': '២–៣ ដងក្នុងមួយសប្ដាហ៍',
  '3–5 times a week': '៣–៥ ដងក្នុងមួយសប្ដាហ៍',
  'Every day': 'រៀងរាល់ថ្ងៃ',
};

const storagePrefix = 'language-tutor-v1';

export default function AiTutorPage() {
  const [storageKey, setStorageKey] = useState(`${storagePrefix}-guest`);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Partial<LearningProfile>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [microphoneMuted, setMicrophoneMuted] = useState(false);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [interimTranscript, setInterimTranscript] = useState('');
  const sessionRef = useRef<Session | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const microphoneSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const microphoneProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackSourcesRef = useRef(new Set<AudioBufferSourceNode>());
  const nextPlaybackTimeRef = useRef(0);
  const assistantTurnCompleteRef = useRef(false);

  useEffect(() => {
    let active = true;
    const loadSaved = async () => {
      let key = `${storagePrefix}-guest`;
      if (supabase) {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (data.session?.user) key = `${storagePrefix}-${data.session.user.id}`;
      }
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        const savedProfile = isLearningProfile(saved)
          ? saved
          : isRecord(saved) && isLearningProfile(saved.profile)
            ? saved.profile
            : null;
        if (savedProfile && active) {
          setProfile(savedProfile);
        }
      }
      if (active) setStorageKey(key);
    };
    void loadSaved()
      .catch((cause: unknown) => {
        console.error('Could not load saved tutor profile:', cause);
        if (active) setError('រក្សាទុកមិនបានទេ។ សូមផ្ទុកទំព័រឡើងវិញ ឬកំណត់ចំណូលចិត្តម្ដងទៀត។');
      })
      .finally(() => {
        if (active) setLoadingSaved(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!callStartedAt || voiceStatus === 'idle') return;
    const updateDuration = () => setCallDuration(Math.floor((Date.now() - callStartedAt) / 1000));
    updateDuration();
    const timer = window.setInterval(updateDuration, 1000);
    return () => window.clearInterval(timer);
  }, [callStartedAt, voiceStatus]);

  const closeVoiceSession = useCallback((updateUi = true) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    try {
      session?.close();
    } catch (cause) {
      console.error('Could not close Gemini Live session:', cause);
    }
    microphoneProcessorRef.current?.disconnect();
    microphoneProcessorRef.current = null;
    microphoneSourceRef.current?.disconnect();
    microphoneSourceRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    playbackSourcesRef.current.forEach((source) => source.stop());
    playbackSourcesRef.current.clear();
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    outputGainRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch((cause: unknown) => console.error('Could not close voice audio context:', cause));
    }
    nextPlaybackTimeRef.current = 0;
    assistantTurnCompleteRef.current = false;
    if (updateUi) {
      setInterimTranscript('');
      setVoiceStatus('idle');
      setMicrophoneMuted(false);
      setSpeakerEnabled(true);
      setCallStartedAt(null);
      setCallDuration(0);
    }
  }, []);

  useEffect(() => () => closeVoiceSession(false), [closeVoiceSession]);

  const languageName = profile.language ? khmerLanguage[profile.language] : '';
  const question = questions[step].title.replaceAll('{language}', profile.language || 'this language');
  const selected = [profile.language, profile.level, profile.reason, profile.goal][step];
  const options = [languageOptions, levelOptions, reasonOptions, goalOptions][step];
  const canContinue = Boolean(selected);

  const finishSetup = () => {
    if (!isLearningProfile(profile)) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(profile));
      setError('');
      setMessages([]);
    } catch (cause) {
      console.error('Could not save tutor preferences:', cause);
      setError('រក្សាទុកជម្រើសមិនបានទេ។ សូមពិនិត្យទំហំផ្ទុករបស់ browser ហើយសាកល្បងម្ដងទៀត។');
    }
  };

  const choose = (value: string) => {
    if (step === 0) setProfile({ language: value as LearningProfile['language'] });
    if (step === 1) setProfile((current) => ({ ...current, level: value as LearningProfile['level'] }));
    if (step === 2) setProfile((current) => ({ ...current, reason: value as LearningProfile['reason'] }));
    if (step === 3) setProfile((current) => ({ ...current, goal: value as LearningProfile['goal'] }));
  };

  const startVoiceSession = async () => {
    if (!isLearningProfile(profile) || loading || voiceStatus !== 'idle') return;
    const learningProfile = profile;
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
      setError('កម្មវិធីរុករកនេះមិនគាំទ្រមីក្រូហ្វូនទេ។ សូមបើកគេហទំព័រដោយប្រើ Chrome ឬ Safari។');
      return;
    }

    setLoading(true);
    setVoiceStatus('connecting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const outputGain = audioContext.createGain();
      outputGain.gain.value = speakerEnabled ? 1 : 0;
      outputGain.connect(audioContext.destination);
      outputGainRef.current = outputGain;
      await audioContext.resume();

      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'live-token', profile: learningProfile }),
      });
      const result = await response.json() as {
        token?: string;
        model?: string;
        config?: LiveConnectConfig;
        error?: string;
      };
      if (!response.ok || !result.token || !result.model || !result.config) {
        throw new Error(result.error || 'មិនអាចភ្ជាប់ទៅ AI បានទេ។ សូមពិនិត្យការកំណត់ Gemini API ហើយសាកល្បងម្ដងទៀត។');
      }

      const ai = new GoogleGenAI({
        apiKey: result.token,
        httpOptions: { apiVersion: 'v1alpha' },
      });
      const session = await ai.live.connect({
        model: result.model,
        config: result.config,
        callbacks: {
          onmessage: (message) => {
            const content = message.serverContent;
            if (!content) return;

            if (content.interrupted) {
              playbackSourcesRef.current.forEach((source) => source.stop());
              playbackSourcesRef.current.clear();
              nextPlaybackTimeRef.current = 0;
              assistantTurnCompleteRef.current = false;
              setVoiceStatus('listening');
            }

            const inputText = content.inputTranscription?.text?.trim();
            if (inputText) {
              setMessages((current) => [...current, { role: 'user', text: inputText }]);
              setInterimTranscript('');
              setVoiceStatus('thinking');
            } else if (content.interimInputTranscription?.text) {
              setInterimTranscript(content.interimInputTranscription.text);
              setVoiceStatus('listening');
            }

            const outputText = content.outputTranscription?.text?.trim();
            if (outputText) {
              setMessages((current) => [...current, { role: 'assistant', text: outputText }]);
            }

            for (const part of content.modelTurn?.parts || []) {
              const audio = part.inlineData;
              if (!audio?.data || !audio.mimeType?.startsWith('audio/pcm')) continue;
              try {
                const pcm = decodePcmAudio(audio.data);
                const outputContext = audioContextRef.current;
                if (!outputContext || outputContext.state === 'closed') continue;
                const buffer = outputContext.createBuffer(1, pcm.length, 24_000);
                const channel = buffer.getChannelData(0);
                for (let index = 0; index < pcm.length; index += 1) channel[index] = pcm[index] / 32_768;
                const source = outputContext.createBufferSource();
                source.buffer = buffer;
                source.connect(outputGainRef.current || outputContext.destination);
                const startAt = Math.max(outputContext.currentTime + 0.02, nextPlaybackTimeRef.current);
                nextPlaybackTimeRef.current = startAt + buffer.duration;
                playbackSourcesRef.current.add(source);
                assistantTurnCompleteRef.current = false;
                source.onended = () => {
                  playbackSourcesRef.current.delete(source);
                  if (assistantTurnCompleteRef.current && playbackSourcesRef.current.size === 0) setVoiceStatus('listening');
                };
                source.start(startAt);
                setVoiceStatus('speaking');
              } catch (cause) {
                console.error('Could not play Gemini voice audio:', cause);
                setError('មិនអាចចាក់សំឡេង AI បានទេ។ សូមពិនិត្យសំឡេងឧបករណ៍របស់អ្នក។');
              }
            }

            if (content.turnComplete) {
              assistantTurnCompleteRef.current = true;
              if (playbackSourcesRef.current.size === 0) setVoiceStatus('listening');
            }
          },
          onerror: (event) => {
            setError(event.message || 'ការតភ្ជាប់សំឡេងត្រូវបានរំខាន។ សូមចាប់ផ្ដើមម្ដងទៀត។');
            closeVoiceSession();
          },
          onclose: () => {
            if (sessionRef.current) closeVoiceSession();
          },
        },
      });
      sessionRef.current = session;
      setMessages([]);

      const microphoneSource = audioContext.createMediaStreamSource(stream);
      const microphoneProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      microphoneProcessor.onaudioprocess = (event) => {
        event.outputBuffer.getChannelData(0).fill(0);
        if (!sessionRef.current) return;
        const samples = event.inputBuffer.getChannelData(0);
        try {
          sessionRef.current.sendRealtimeInput({
            audio: {
              data: encodeAudioForGemini(samples, audioContext.sampleRate),
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch (cause) {
          console.error('Could not send microphone audio to Gemini:', cause);
          setError('មិនអាចផ្ញើសំឡេងទៅ AI បានទេ។ សូមចាប់ផ្ដើមម្ដងទៀត។');
          closeVoiceSession();
        }
      };
      microphoneSource.connect(microphoneProcessor);
      microphoneProcessor.connect(audioContext.destination);
      microphoneSourceRef.current = microphoneSource;
      microphoneProcessorRef.current = microphoneProcessor;

      setCallStartedAt(Date.now());
      setCallDuration(0);
      setMicrophoneMuted(false);
      setVoiceStatus('listening');
      session.sendClientContent({
        turns: [{
          role: 'user',
          parts: [{ text: 'Start the live speaking practice now. Greet me briefly in Khmer, introduce one useful phrase in the target language, then ask me one simple question in that language and wait for my spoken reply.' }],
        }],
        turnComplete: true,
      });
    } catch (cause) {
      closeVoiceSession();
      const message = typeof DOMException !== 'undefined' && cause instanceof DOMException && cause.name === 'NotAllowedError'
        ? 'សូមអនុញ្ញាតឱ្យប្រើមីក្រូហ្វូន ដើម្បីចាប់ផ្ដើមនិយាយជាមួយ AI។'
        : cause instanceof Error
          ? cause.message
          : 'មិនអាចភ្ជាប់សំឡេងទៅ AI បានទេ។ សូមពិនិត្យសិទ្ធិមីក្រូហ្វូន ហើយសាកល្បងម្ដងទៀត។';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    closeVoiceSession();
    setMessages([]);
    setStep(0);
    setProfile({});
    setError('');
    window.localStorage.removeItem(storageKey);
  };

  const toggleMicrophone = () => {
    const nextMuted = !microphoneMuted;
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMicrophoneMuted(nextMuted);
  };

  const toggleSpeaker = () => {
    const nextEnabled = !speakerEnabled;
    if (outputGainRef.current) outputGainRef.current.gain.value = nextEnabled ? 1 : 0;
    setSpeakerEnabled(nextEnabled);
  };

  const formattedDuration = `${String(Math.floor(callDuration / 60)).padStart(2, '0')}:${String(callDuration % 60).padStart(2, '0')}`;

  if (loadingSaved) {
    return <div className="grid min-h-[50vh] place-items-center text-slate-500"><LoaderCircle className="animate-spin" /> <span className="sr-only">កំពុងផ្ទុក...</span></div>;
  }

  return !isLearningProfile(profile) ? (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#b91c1c]">
        <ArrowLeft size={17} /> ត្រឡប់ទៅទំព័រដើម
      </Link>

        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-[#8f1717] to-[#c2413b] px-6 py-7 text-white sm:px-9 sm:py-9">
            <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-white/15"><Sparkles size={25} /></div>
            <p className="text-sm font-semibold text-white/75">គ្រូ AI ផ្ទាល់ខ្លួនរបស់អ្នក</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">រៀនភាសាតាមរបៀបរបស់អ្នក</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-white/85">ជ្រើសភាសា កម្រិត និងគោលដៅរបស់អ្នក រួចនិយាយផ្ទាល់ជាមួយគ្រូ AI។</p>
          </div>
          <div className="px-5 py-6 sm:px-9 sm:py-8">
            <div className="mb-7 flex items-center gap-2" aria-label={`សំណួរទី ${step + 1} ក្នុង 4`}>
              {questions.map((item, index) => (
                <div key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-[#b91c1c]' : 'bg-stone-100'}`} />
              ))}
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b91c1c]">សំណួរទី {step + 1} ក្នុង 4</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">{question}</h2>
            <p className="mt-1 text-sm text-slate-500">{questions[step].subtitle}</p>
            {step > 0 && <p className="mt-2 text-sm font-medium text-[#b91c1c]">{languageName}</p>}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {options.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => choose(option)}
                  aria-pressed={selected === option}
                  className={`flex min-h-[68px] items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    selected === option
                      ? 'border-[#b91c1c] bg-red-50 text-[#991b1b] ring-1 ring-[#b91c1c]'
                      : 'border-stone-200 bg-white text-slate-800 hover:border-red-200 hover:bg-stone-50'
                  }`}
                >
                  <span>
                    <span className="block font-semibold">{option}</span>
                    {optionKhmer[option] && <span className="mt-1 block text-xs text-slate-500">{optionKhmer[option]}</span>}
                  </span>
                  {selected === option && <Check size={19} className="shrink-0" />}
                </button>
              ))}
            </div>
            {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="mt-8 flex justify-between gap-3">
              {step > 0 ? (
                <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 px-5 font-semibold text-slate-700 hover:bg-stone-50">
                  <ChevronLeft size={18} /> ត្រឡប់ក្រោយ
                </button>
              ) : <span />}
              {step < 3 ? (
                <button type="button" disabled={!canContinue} onClick={() => setStep((current) => current + 1)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#b91c1c] px-6 font-semibold text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-40">
                  Continue <ArrowRight size={18} />
                </button>
              ) : (
                <button type="button" disabled={!canContinue} onClick={finishSetup} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#b91c1c] px-6 font-semibold text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-50">
                  Continue <ArrowRight size={18} />
                </button>
              )}
            </div>
          </div>
        </section>
    </div>
  ) : (
    <section className="fixed inset-0 z-[60] flex min-h-0 flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_50%_39%,#fff_0%,#faf9f7_47%,#f0efed_100%)] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-8">
      <header className="flex w-full items-center justify-between">
        <button type="button" onClick={startOver} aria-label="កែចំណូលចិត្ត" className="grid size-11 place-items-center rounded-full text-slate-500 transition hover:bg-stone-200/70 hover:text-slate-900">
          <ArrowLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-800">AI Language Tutor</p>
          <p className="mt-0.5 text-xs text-slate-500">{languageName} · ពន្យល់ជាភាសាខ្មែរ</p>
        </div>
        <div className="min-w-11 text-right text-xs font-medium tabular-nums text-slate-500" aria-label="រយៈពេលហៅ">
          {voiceStatus === 'idle' ? 'ត្រៀមរួច' : formattedDuration}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center py-8 text-center">
        <div className="mb-2 flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/75 px-3.5 py-2 shadow-sm">
          <span className={`size-2 rounded-full ${voiceStatus === 'idle' ? 'bg-stone-300' : voiceStatus === 'connecting' || voiceStatus === 'thinking' ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'}`} />
          <span className="text-xs font-medium text-slate-600">
            {voiceStatus === 'connecting' || loading ? 'កំពុងភ្ជាប់...' :
              voiceStatus === 'thinking' ? 'AI កំពុងគិត' :
                voiceStatus === 'speaking' ? 'AI កំពុងនិយាយ' :
                  voiceStatus === 'listening' && microphoneMuted ? 'បានបិទមីក្រូហ្វូន' :
                    voiceStatus === 'listening' ? 'AI កំពុងស្ដាប់អ្នក' :
                      'ត្រៀមចាប់ផ្ដើមការហៅ'}
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">គ្រូ AI {languageName}</h1>
        <p className="mt-2 text-sm text-slate-500">{voiceStatus === 'idle' ? 'ហាត់និយាយផ្ទាល់ជាមួយ AI' : 'និយាយបានដោយសេរី · AI នឹងពន្យល់ជាភាសាខ្មែរ'}</p>

        <div
          className={`voice-orb my-12 grid size-40 place-items-center sm:size-48 ${voiceStatus === 'speaking' ? 'scale-105' : ''}`}
          data-active={voiceStatus !== 'idle' && voiceStatus !== 'connecting'}
          data-speaking={voiceStatus === 'speaking'}
          aria-label={voiceStatus === 'speaking' ? 'AI កំពុងនិយាយ' : voiceStatus === 'listening' ? 'AI កំពុងស្ដាប់' : 'រូបតំណាងគ្រូ AI'}
        >
          <div className="grid size-28 place-items-center rounded-full border border-white/45 bg-white/15 shadow-[inset_0_1px_16px_rgba(255,255,255,0.4)] backdrop-blur-[2px] sm:size-32">
            {loading || voiceStatus === 'connecting' ? <LoaderCircle className="animate-spin text-white" size={38} /> :
              voiceStatus === 'listening' && microphoneMuted ? <MicOff className="text-white drop-shadow-sm" size={36} /> :
                voiceStatus === 'listening' ? <Mic className="animate-pulse text-white drop-shadow-sm" size={36} /> :
                  voiceStatus === 'thinking' ? <Sparkles className="animate-pulse text-white drop-shadow-sm" size={38} /> :
                    voiceStatus === 'speaking' ? <Volume2 className="animate-pulse text-white drop-shadow-sm" size={40} /> :
                      <Sparkles className="text-white drop-shadow-sm" size={38} />}
          </div>
        </div>

        <div aria-live="polite" className="min-h-14 max-w-lg px-4">
          {interimTranscript ? (
            <p className="text-sm italic leading-6 text-slate-500">{interimTranscript}</p>
          ) : messages.length > 0 ? (
            <p className="text-sm leading-6 text-slate-600">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{messages[messages.length - 1].role === 'user' ? 'អ្នក' : 'AI Tutor'}</span>
              {messages[messages.length - 1].text}
            </p>
          ) : (
            <p className="text-sm leading-6 text-slate-400">ជ្រើសប៊ូតុងខាងក្រោម រួចចាប់ផ្ដើមនិយាយ</p>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mx-auto mb-4 w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">{error}</p>}

      <footer className="mx-auto w-full max-w-md pb-2">
        <div className="flex items-start justify-center gap-5 sm:gap-8" role="group" aria-label="ប៊ូតុងគ្រប់គ្រងការហៅ">
          <div className="flex w-20 flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => voiceStatus === 'idle' ? void startVoiceSession() : toggleMicrophone()}
              disabled={loading}
              aria-label={voiceStatus === 'idle' ? 'ចាប់ផ្ដើមនិយាយ' : microphoneMuted ? 'បើកមីក្រូហ្វូន' : 'បិទមីក្រូហ្វូន'}
              aria-pressed={voiceStatus !== 'idle' && !microphoneMuted}
              className={`grid size-16 place-items-center rounded-full shadow-sm transition active:scale-95 disabled:cursor-wait disabled:opacity-60 ${voiceStatus !== 'idle' && !microphoneMuted ? 'bg-white text-slate-700 ring-1 ring-stone-200 hover:bg-stone-50' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
            >
              {loading ? <LoaderCircle className="animate-spin" size={23} /> :
                voiceStatus === 'idle' ? <Mic size={23} /> :
                  microphoneMuted ? <MicOff size={23} /> : <Mic size={23} />}
            </button>
            <span className="text-center text-[11px] font-medium text-slate-500">
              {voiceStatus === 'idle' ? 'ចាប់ផ្ដើម' : microphoneMuted ? 'បើកមីក្រូ' : 'បិទមីក្រូ'}
            </span>
          </div>

          <div className="flex w-20 flex-col items-center gap-2">
            <button
              type="button"
              onClick={toggleSpeaker}
              disabled={voiceStatus === 'idle'}
              aria-label={speakerEnabled ? 'បិទសំឡេង AI' : 'បើកសំឡេង AI'}
              aria-pressed={speakerEnabled}
              className={`grid size-16 place-items-center rounded-full shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${speakerEnabled && voiceStatus !== 'idle' ? 'bg-white text-slate-700 ring-1 ring-stone-200 hover:bg-stone-50' : 'bg-slate-900 text-white hover:bg-slate-700'}`}
            >
              {speakerEnabled ? <Volume2 size={23} /> : <VolumeX size={23} />}
            </button>
            <span className="text-center text-[11px] font-medium text-slate-500">{speakerEnabled ? 'សំឡេង' : 'បើកសំឡេង'}</span>
          </div>

          <div className="flex w-20 flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => closeVoiceSession()}
              disabled={voiceStatus === 'idle'}
              aria-label="បញ្ចប់ការហៅ"
              className="grid size-16 place-items-center rounded-full bg-[#e5484d] text-white shadow-md shadow-red-200/70 transition hover:bg-[#d7373d] active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
            >
              <PhoneOff size={23} />
            </button>
            <span className="text-center text-[11px] font-medium text-slate-500">បញ្ចប់ការហៅ</span>
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">សូមអនុញ្ញាតឱ្យ browser ប្រើមីក្រូហ្វូន</p>
      </footer>
    </section>
  );
}
