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
  const [interimTranscript, setInterimTranscript] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, interimTranscript]);

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
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch((cause: unknown) => console.error('Could not close voice audio context:', cause));
    }
    nextPlaybackTimeRef.current = 0;
    assistantTurnCompleteRef.current = false;
    if (updateUi) {
      setInterimTranscript('');
      setVoiceStatus('idle');
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
                source.connect(outputContext.destination);
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

  if (loadingSaved) {
    return <div className="grid min-h-[50vh] place-items-center text-slate-500"><LoaderCircle className="animate-spin" /> <span className="sr-only">កំពុងផ្ទុក...</span></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#b91c1c]">
        <ArrowLeft size={17} /> ត្រឡប់ទៅទំព័រដើម
      </Link>

      {!isLearningProfile(profile) ? (
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
      ) : (
        <>
          <section className="rounded-3xl bg-gradient-to-br from-[#8f1717] to-[#c2413b] p-6 text-white shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Sparkles size={14} /> គ្រូ AI · {languageName}</span>
                <h1 className="mt-4 text-2xl font-bold sm:text-3xl">ត្រៀមនិយាយភាសា{languageName}ហើយឬនៅ?</h1>
                <p className="mt-2 max-w-2xl leading-7 text-white/90">ចុចប៊ូតុងមីក្រូហ្វូន ដើម្បីចាប់ផ្ដើមសន្ទនាផ្ទាល់។ AI នឹងស្ដាប់ការនិយាយរបស់អ្នក ហើយឆ្លើយតបជាសំឡេង ដោយពន្យល់ជាភាសាខ្មែរ។</p>
              </div>
              <button type="button" onClick={startOver} className="rounded-xl border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10">កែចំណូលចិត្ត</button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/85">
              <span className="rounded-full bg-black/15 px-3 py-1.5">{profile.level}</span>
              <span className="rounded-full bg-black/15 px-3 py-1.5">{profile.goal}</span>
              <span className="rounded-full bg-black/15 px-3 py-1.5">{profile.reason}</span>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-stone-900 to-stone-800 px-5 py-7 text-white sm:px-8 sm:py-9">
              <div className="mx-auto max-w-xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85">
                  <Sparkles size={14} /> AI LIVE SPEAKING · {languageName}
                </span>
                <h2 className="mt-4 text-xl font-bold sm:text-2xl">និយាយផ្ទាល់ជាមួយគ្រូ AI</h2>
                <p className="mt-2 text-sm leading-6 text-white/70">និយាយជាភាសា{languageName}។ AI នឹងស្ដាប់ ឆ្លើយតបជាសំឡេង និងពន្យល់ជាភាសាខ្មែរ។</p>
                <div className="my-7 flex justify-center">
                  <div className={`grid size-28 place-items-center rounded-full border border-white/15 bg-white/10 transition-all ${voiceStatus === 'speaking' ? 'scale-110 shadow-[0_0_50px_rgba(248,113,113,0.5)]' : voiceStatus === 'listening' ? 'shadow-[0_0_35px_rgba(134,239,172,0.25)]' : ''}`}>
                    {loading || voiceStatus === 'connecting' ? (
                      <LoaderCircle size={38} className="animate-spin text-white" />
                    ) : voiceStatus === 'listening' ? (
                      <Mic size={38} className="animate-pulse text-emerald-300" />
                    ) : voiceStatus === 'thinking' ? (
                      <Sparkles size={38} className="animate-pulse text-amber-200" />
                    ) : voiceStatus === 'speaking' ? (
                      <Volume2 size={40} className="animate-pulse text-red-200" />
                    ) : (
                      <Mic size={38} className="text-white/80" />
                    )}
                  </div>
                </div>
                <p aria-live="polite" className="min-h-6 text-sm font-medium text-white/85">
                  {loading || voiceStatus === 'connecting' ? 'កំពុងភ្ជាប់ទៅ AI...' :
                    voiceStatus === 'listening' ? 'AI កំពុងស្ដាប់អ្នក... និយាយបានភ្លាមៗ' :
                      voiceStatus === 'thinking' ? 'AI កំពុងយល់ចម្លើយរបស់អ្នក...' :
                        voiceStatus === 'speaking' ? 'AI កំពុងនិយាយ...' :
                          'ចុចប៊ូតុង រួចចាប់ផ្ដើមនិយាយ'}
                </p>
                <button
                  type="button"
                  onClick={() => voiceStatus === 'idle' ? void startVoiceSession() : closeVoiceSession()}
                  disabled={loading && voiceStatus !== 'connecting'}
                  aria-pressed={voiceStatus !== 'idle'}
                  className={`mt-5 inline-flex min-h-14 items-center justify-center gap-3 rounded-full px-7 text-base font-bold shadow-lg transition active:scale-95 disabled:cursor-wait disabled:opacity-70 ${voiceStatus === 'idle' ? 'bg-[#c42b2b] text-white hover:bg-[#a91d1d]' : 'bg-white text-[#991b1b] hover:bg-red-50'}`}
                >
                  {loading || voiceStatus === 'connecting' ? <LoaderCircle size={20} className="animate-spin" /> :
                    voiceStatus === 'idle' ? <Mic size={21} /> : <PhoneOff size={20} />}
                  {loading || voiceStatus === 'connecting' ? 'កំពុងភ្ជាប់...' :
                    voiceStatus === 'idle' ? 'ចាប់ផ្ដើមនិយាយ' : 'បញ្ចប់ការសន្ទនា'}
                </button>
                <p className="mt-4 text-xs text-white/50"><MicOff size={13} className="mr-1 inline" /> សំឡេងមីក្រូហ្វូនប្រើសម្រាប់សន្ទនានេះតែប៉ុណ្ណោះ។ AI អាចត្រូវការពេលខ្លីដើម្បីឆ្លើយតប។</p>
              </div>
            </div>
            <div className="max-h-80 space-y-3 overflow-y-auto p-5 sm:p-7">
              {messages.length === 0 && !interimTranscript && (
                <p className="text-center text-sm text-slate-400">ការសន្ទនាជាសំឡេងនឹងបង្ហាញនៅទីនេះ។</p>
              )}
              {messages.map((message, index) => (
                <div key={`${index}-${message.role}`} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl p-4 text-sm leading-6 ${message.role === 'user' ? 'ml-auto rounded-tr-sm bg-red-50 text-slate-800' : 'rounded-tl-sm bg-stone-100 text-slate-700'}`}>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{message.role === 'user' ? 'អ្នក' : 'AI Tutor'}</p>
                  {message.text}
                </div>
              ))}
              {interimTranscript && (
                <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-red-50 p-4 text-sm italic leading-6 text-slate-500">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide">អ្នកកំពុងនិយាយ</p>{interimTranscript}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            {error && <p role="alert" className="mx-5 mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-7">{error}</p>}
          </section>

          <p className="text-center text-xs text-slate-400">សូមអនុញ្ញាតឱ្យ browser ប្រើមីក្រូហ្វូន និងបើកសំឡេងនៅលើឧបករណ៍របស់អ្នក។</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#b91c1c]"><ArrowLeft size={16} /> ត្រឡប់ទៅទំព័រដើម</Link>
        </>
      )}
    </div>
  );
}
