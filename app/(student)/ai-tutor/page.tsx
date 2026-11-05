'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  Target,
} from 'lucide-react';
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
type Lesson = {
  title: string;
  explanation: string;
  vocabulary: Array<{ target: string; pronunciation: string; khmerMeaning: string }>;
  exampleTarget: string;
  examplePronunciation: string;
  exampleKhmer: string;
  challenge: string;
  goalTip: string;
};
type ChatMessage = { role: 'user' | 'assistant'; text: string };
type SavedTutor = { profile: LearningProfile; lesson: Lesson };

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
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        const saved = JSON.parse(raw) as SavedTutor;
        if (saved.profile && saved.lesson && active) {
          setProfile(saved.profile);
          setLesson(saved.lesson);
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
  }, [messages, loading]);

  const languageName = profile.language ? khmerLanguage[profile.language] : '';
  const question = questions[step].title.replaceAll('{language}', profile.language || 'this language');
  const selected = [profile.language, profile.level, profile.reason, profile.goal][step];
  const options = [languageOptions, levelOptions, reasonOptions, goalOptions][step];
  const canContinue = Boolean(selected);

  const choose = (value: string) => {
    if (step === 0) setProfile((current) => ({ ...current, language: value as LearningProfile['language'] }));
    if (step === 1) setProfile((current) => ({ ...current, level: value as LearningProfile['level'] }));
    if (step === 2) setProfile((current) => ({ ...current, reason: value as LearningProfile['reason'] }));
    if (step === 3) setProfile((current) => ({ ...current, goal: value as LearningProfile['goal'] }));
  };

  const createLesson = async () => {
    if (!profile.language || !profile.level || !profile.reason || !profile.goal) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lesson', profile }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'មិនអាចបង្កើតមេរៀនបានទេ។ សូមសាកល្បងម្ដងទៀត។');
      const saved: SavedTutor = { profile: profile as LearningProfile, lesson: result.lesson as Lesson };
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
      setLesson(saved.lesson);
      setMessages([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'មានបញ្ហាក្នុងការភ្ជាប់ទៅ AI។ សូមសាកល្បងម្ដងទៀត។');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!lesson || !text || loading) return;
    const nextMessages = [...messages, { role: 'user' as const, text }];
    setMessages(nextMessages);
    setDraft('');
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          profile,
          lesson,
          messages: nextMessages.slice(-10),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI មិនអាចឆ្លើយតបបានទេ។ សូមសាកល្បងម្ដងទៀត។');
      setMessages((current) => [...current, { role: 'assistant', text: result.reply }]);
    } catch (cause) {
      setMessages((current) => current.filter((message, index) => !(message.role === 'user' && index === current.length - 1)));
      setDraft(text);
      setError(cause instanceof Error ? cause.message : 'មានបញ្ហាក្នុងការភ្ជាប់ទៅ AI។ សូមសាកល្បងម្ដងទៀត។');
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setLesson(null);
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

      {!lesson ? (
        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-[#8f1717] to-[#c2413b] px-6 py-7 text-white sm:px-9 sm:py-9">
            <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-white/15"><Sparkles size={25} /></div>
            <p className="text-sm font-semibold text-white/75">គ្រូ AI ផ្ទាល់ខ្លួនរបស់អ្នក</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">រៀនភាសាតាមរបៀបរបស់អ្នក</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-white/85">ឆ្លើយសំណួរខ្លីៗ ដើម្បីឱ្យ AI រៀបចំមេរៀនសមស្របនឹងគោលដៅ និងកម្រិតរបស់អ្នក។</p>
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
                <button type="button" disabled={!canContinue || loading} onClick={() => void createLesson()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#b91c1c] px-6 font-semibold text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-50">
                  {loading ? <><LoaderCircle size={18} className="animate-spin" /> AI កំពុងរៀបចំមេរៀន...</> : <>Continue <Sparkles size={17} /></>}
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
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Sparkles size={14} /> មេរៀនរៀបចំដោយ AI · {languageName}</span>
                <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{lesson.title}</h1>
                <p className="mt-2 max-w-2xl leading-7 text-white/90">{lesson.explanation}</p>
              </div>
              <button type="button" onClick={startOver} className="rounded-xl border border-white/30 px-3 py-2 text-sm font-medium text-white hover:bg-white/10">កែចំណូលចិត្ត</button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/85">
              <span className="rounded-full bg-black/15 px-3 py-1.5">{profile.level}</span>
              <span className="rounded-full bg-black/15 px-3 py-1.5">{profile.goal}</span>
              <span className="rounded-full bg-black/15 px-3 py-1.5">{profile.reason}</span>
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-red-50 text-[#b91c1c]"><BookOpen size={20} /></div>
              <div><h2 className="font-bold">ពាក្យសំខាន់ៗ</h2><p className="text-xs text-slate-500">សូមអាន និងចងចាំពាក្យទាំងនេះ</p></div>
            </div>
            <div className="divide-y divide-stone-100">
              {lesson.vocabulary.map((word, index) => (
                <div key={`${word.target}-${index}`} className="grid gap-1 py-4 sm:grid-cols-[1fr_1fr_1.2fr] sm:items-center sm:gap-4">
                  <p className="font-semibold text-slate-900">{word.target}</p>
                  <p className="text-sm text-slate-500">{word.pronunciation}</p>
                  <p className="text-sm text-slate-700">{word.khmerMeaning}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Target size={20} /></div><h2 className="font-bold">ឧទាហរណ៍ និងលំហាត់</h2></div>
            <p className="text-lg font-bold text-slate-900">{lesson.exampleTarget}</p>
            <p className="mt-1 text-sm text-slate-500">{lesson.examplePronunciation}</p>
            <p className="mt-2 text-sm text-slate-700">{lesson.exampleKhmer}</p>
            <div className="mt-5 rounded-2xl bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-800">សាកល្បងឆ្លើយជាភាសា {languageName}</p>
              <p className="mt-1 font-semibold text-amber-950">{lesson.challenge}</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-800">គន្លឹះ៖</span> {lesson.goalTip}</p>
          </section>

          <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4 sm:px-7">
              <div className="grid size-10 place-items-center rounded-xl bg-red-50 text-[#b91c1c]"><MessageCircle size={20} /></div>
              <div><h2 className="font-bold">ហាត់ជាមួយគ្រូ AI</h2><p className="text-xs text-slate-500">ឆ្លើយជាភាសាដែលអ្នកកំពុងរៀន · គ្រូនឹងពន្យល់ជាភាសាខ្មែរ</p></div>
            </div>
            <div className="max-h-96 space-y-3 overflow-y-auto p-5 sm:p-7">
              {messages.length === 0 && <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-stone-100 p-4 text-sm leading-6 text-slate-700">{lesson.challenge}</div>}
              {messages.map((message, index) => (
                <div key={`${index}-${message.role}`} className={`max-w-[88%] whitespace-pre-wrap rounded-2xl p-4 text-sm leading-6 ${message.role === 'user' ? 'ml-auto rounded-tr-sm bg-[#b91c1c] text-white' : 'rounded-tl-sm bg-stone-100 text-slate-700'}`}>{message.text}</div>
              ))}
              {loading && lesson && <div className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" /> AI កំពុងគិត...</div>}
              <div ref={messagesEndRef} />
            </div>
            {error && <p role="alert" className="mx-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-7">{error}</p>}
            <form onSubmit={(event) => void submitAnswer(event)} className="flex gap-2 border-t border-stone-100 p-4 sm:p-5">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} placeholder={`សរសេរចម្លើយជាភាសា ${languageName}...`} aria-label="សរសេរចម្លើយរបស់អ្នក" className="min-h-12 min-w-0 flex-1 rounded-xl border border-stone-200 px-4 text-sm outline-none focus:border-[#b91c1c] focus:ring-2 focus:ring-red-100" />
              <button type="submit" disabled={!draft.trim() || loading} aria-label="ផ្ញើចម្លើយ" className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#b91c1c] text-white hover:bg-[#991b1b] disabled:cursor-not-allowed disabled:opacity-40"><Send size={18} /></button>
            </form>
          </section>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#b91c1c]"><ArrowLeft size={16} /> ត្រឡប់ទៅទំព័រដើម</Link>
        </>
      )}
    </div>
  );
}
