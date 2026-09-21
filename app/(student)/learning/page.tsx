'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Volume2, ChevronRight, Check, X, Sparkles, RotateCcw, Mic, MicOff } from 'lucide-react';

type LearningWord = {
  id: string;
  chinese: string;
  pinyin: string;
  khmer: string;
  english: string;
  className: string;
  classId: string;
  classDate: string;
};

type LearningSentence = {
  id: string;
  chinese: string;
  pinyin: string;
  khmer: string;
  english: string;
  classId: string;
};

type ClassOption = {
  id: string;
  name: string;
  date: string;
  wordCount: number;
  sentenceCount: number;
};

type LearningStep = 'select-date' | 'teach-words' | 'practice-writing' | 'speak-word' | 'show-sentences' | 'complete';

const speak = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
};

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

export default function LearningPage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [words, setWords] = useState<LearningWord[]>([]);
  const [sentences, setSentences] = useState<LearningSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<LearningStep>('select-date');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [wordPlayed, setWordPlayed] = useState(false);
  const [writingDone, setWritingDone] = useState(false);
  const [speechDone, setSpeechDone] = useState(false);
  const [speechRecognizing, setSpeechRecognizing] = useState(false);
  const [speechResult, setSpeechResult] = useState('');
  const [speechError, setSpeechError] = useState('');
  const speechRecognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioPlayedRef = useRef(false);

  useEffect(() => {
    const loadClasses = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      const { data: classData } = await supabase
        .from('classes')
        .select('id, name, date')
        .eq('user_id', auth.user.id)
        .order('date', { ascending: false });

      if (!classData || classData.length === 0) {
        setLoading(false);
        return;
      }

      type ClassRow = { id: string; name: string | null; date: string | null };

      const classesWithCounts = await Promise.all(
        (classData as ClassRow[]).map(async (c) => {
          const [wordsRes, sentencesRes] = await Promise.all([
            supabase.from('words').select('id', { count: 'exact', head: true }).eq('class_id', c.id).eq('user_id', auth.user.id),
            supabase.from('sentences').select('id', { count: 'exact', head: true }).eq('class_id', c.id).eq('user_id', auth.user.id),
          ]);
          return {
            id: c.id,
            name: c.name,
            date: c.date,
            wordCount: wordsRes.count || 0,
            sentenceCount: sentencesRes.count || 0,
          };
        })
      );

      setClasses(classesWithCounts.filter(c => c.wordCount > 0));
      setLoading(false);
    };

    loadClasses();
  }, []);

  useEffect(() => {
    if (!selectedClass || !supabase) return;

    const loadContent = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const [wordsRes, sentencesRes] = await Promise.all([
        supabase
          .from('words')
          .select('id, chinese, pinyin, khmer, english, class_id, classes!words_class_id_fkey (name, date)')
          .eq('class_id', selectedClass.id)
          .eq('user_id', auth.user.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('sentences')
          .select('id, chinese, pinyin, khmer, english, class_id')
          .eq('class_id', selectedClass.id)
          .eq('user_id', auth.user.id)
          .order('created_at', { ascending: true }),
      ]);

      const mappedWords: LearningWord[] = ((wordsRes.data || []) as any[])
        .filter((w) => w.chinese)
        .map((w) => ({
          id: w.id,
          chinese: w.chinese,
          pinyin: w.pinyin || '',
          khmer: w.khmer || '',
          english: w.english || '',
          className: w.classes?.name || w.classes?.date || '',
          classId: w.class_id,
          classDate: w.classes?.date || '',
        }));

      const mappedSentences: LearningSentence[] = ((sentencesRes.data || []) as any[])
        .filter((s) => s.chinese)
        .map((s) => ({
          id: s.id,
          chinese: s.chinese,
          pinyin: s.pinyin || '',
          khmer: s.khmer || '',
          english: s.english || '',
          classId: s.class_id,
        }));

      setWords(mappedWords);
      setSentences(mappedSentences);
      setCurrentWordIndex(0);
      setCurrentSentenceIndex(0);
      setStep('teach-words');
      resetWordState();
    };

    loadContent();
  }, [selectedClass]);

  const resetWordState = () => {
    setWordPlayed(false);
    setWritingDone(false);
    setSpeechDone(false);
    setSpeechResult('');
    setSpeechError('');
    audioPlayedRef.current = false;
  };

  const currentWord = words[currentWordIndex];
  const currentSentence = sentences[currentSentenceIndex];
  const isLastWord = currentWordIndex === words.length - 1;
  const isLastSentence = currentSentenceIndex === sentences.length - 1;

  useEffect(() => {
    if (step === 'teach-words' && currentWord && !wordPlayed && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      speak(currentWord.chinese);
      setWordPlayed(true);
    }
  }, [step, currentWord, wordPlayed]);

  useEffect(() => {
    if (step === 'speak-word' && currentWord && !speechRecognizing) {
      startSpeechRecognition();
    }
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    };
  }, [step, currentWord]);

  const startSpeechRecognition = () => {
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      setSpeechResult(transcript);
      if (transcript === currentWord?.chinese) {
        setSpeechDone(true);
      }
    };

    recognition.onerror = (event: any) => {
      setSpeechError(`Recognition error: ${event.error}`);
      setSpeechRecognizing(false);
    };

    recognition.onend = () => {
      setSpeechRecognizing(false);
    };

    speechRecognitionRef.current = recognition;
    setSpeechRecognizing(true);
    recognition.start();
  };

  const handleWritingComplete = () => {
    setWritingDone(true);
    setStep('speak-word');
  };

  const handleNextWord = () => {
    if (isLastWord) {
      if (sentences.length > 0) {
        setStep('show-sentences');
        setCurrentSentenceIndex(0);
      } else {
        setStep('complete');
      }
    } else {
      setCurrentWordIndex(currentWordIndex + 1);
      setStep('teach-words');
      resetWordState();
      audioPlayedRef.current = false;
    }
  };

  const handleNextSentence = () => {
    if (isLastSentence) {
      setStep('complete');
    } else {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
    }
  };

  const handleReplayWord = () => {
    if (currentWord) {
      speak(currentWord.chinese);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm text-slate-500">
          <svg className="animate-spin h-5 w-5 text-[#b91c1c]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>
          Loading classes...
        </div>
      </div>
    );
  }

  if (classes.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-stone-300 p-10 text-center text-slate-500">
        <Sparkles className="mx-auto text-slate-300" size={48} />
        <p className="mt-4 text-lg font-medium">No classes with words yet</p>
        <p className="mt-2">Add words to a class first, then come here to learn.</p>
      </div>
    );
  }

  if (step === 'select-date') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Learn</p>
          <h1 className="mt-1 text-3xl font-bold">Choose a class to start learning</h1>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClass(c)}
              className="relative rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-red-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{c.date ? new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}</p>
                  <h3 className="mt-1 text-xl font-bold">{c.name}</h3>
                </div>
                <ChevronRight className="text-slate-400" size={24} />
              </div>
              <div className="mt-4 flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1"><span className="grid size-5 place-items-center rounded-full bg-red-100 text-red-600">词</span>{c.wordCount} words</span>
                <span className="flex items-center gap-1"><span className="grid size-5 place-items-center rounded-full bg-blue-100 text-blue-600">句</span>{c.sentenceCount} sentences</span>
              </div>
              <div className="absolute inset-0 rounded-2xl ring-2 ring-transparent transition hover:ring-[#b91c1c]/20" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'teach-words' && currentWord) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">{selectedClass?.name}</p>
            <h1 className="mt-1 text-2xl font-bold">Learn Words</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold">
            {currentWordIndex + 1} / {words.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-[#b91c1c]" style={{ width: `${((currentWordIndex) / words.length) * 100}%` }} />
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">Listen to the word</p>
          <p className="mt-5 text-6xl font-semibold">{currentWord.chinese}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-xl text-slate-500">{currentWord.pinyin}</span>
            <button
              onClick={handleReplayWord}
              className="grid size-10 place-items-center rounded-full border border-stone-200 bg-white text-slate-600 hover:bg-red-50 hover:text-[#b91c1c] hover:border-red-200"
              aria-label="Replay pronunciation"
            >
              <Volume2 size={20} />
            </button>
          </div>
          <div className="mt-6 grid gap-2 text-base">
            <p className="text-lg font-medium text-slate-700">{currentWord.khmer}</p>
            <p className="text-slate-500">{currentWord.english}</p>
          </div>

          {wordPlayed && (
            <div className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <Check size={16} className="mr-1" /> Pronunciation played. Ready for practice!
            </div>
          )}
        </section>

        <div className="flex justify-center">
          <button
            disabled={!wordPlayed}
            onClick={() => setStep('practice-writing')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Start Practice Writing <ChevronRight size={17} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'practice-writing' && currentWord) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">{selectedClass?.name}</p>
            <h1 className="mt-1 text-2xl font-bold">Practice Writing</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold">
            {currentWordIndex + 1} / {words.length}
          </span>
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">Write the character</p>
          <p className="mt-5 text-6xl font-semibold">{currentWord.chinese}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-xl text-slate-500">{currentWord.pinyin}</span>
            <button
              onClick={handleReplayWord}
              className="grid size-10 place-items-center rounded-full border border-stone-200 bg-white text-slate-600 hover:bg-red-50 hover:text-[#b91c1c] hover:border-red-200"
              aria-label="Replay pronunciation"
            >
              <Volume2 size={20} />
            </button>
          </div>
        </section>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="aspect-square max-w-xs mx-auto rounded-xl border-2 border-stone-200 bg-stone-50 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-stone-200">{currentWord.chinese}</div>
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
              <div className="text-center p-4">
                <p className="text-sm text-slate-500">Trace the character above</p>
                <p className="mt-1 text-xs text-slate-400">Use your finger or mouse</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleReplayWord}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <Volume2 size={16} /> Listen Again
            </button>
            <button
              onClick={handleWritingComplete}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              <Check size={16} /> Done Writing
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'speak-word' && currentWord) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">{selectedClass?.name}</p>
            <h1 className="mt-1 text-2xl font-bold">Speak the Word</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold">
            {currentWordIndex + 1} / {words.length}
          </span>
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">Say the word aloud</p>
          <p className="mt-5 text-6xl font-semibold">{currentWord.chinese}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-xl text-slate-500">{currentWord.pinyin}</span>
            <button
              onClick={handleReplayWord}
              className="grid size-10 place-items-center rounded-full border border-stone-200 bg-white text-slate-600 hover:bg-red-50 hover:text-[#b91c1c] hover:border-red-200"
              aria-label="Replay pronunciation"
            >
              <Volume2 size={20} />
            </button>
          </div>
        </section>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            {speechRecognizing ? (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-red-700 font-medium">
                  <Mic className="animate-pulse" size={18} fill="currentColor" /> Listening...
                </div>
                <p className="text-sm text-slate-500">Say: <span className="font-semibold text-[#b91c1c]">{currentWord.chinese}</span></p>
              </div>
            ) : speechDone ? (
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-emerald-700 font-medium">
                  <Check size={18} /> Correct! Well done.
                </div>
                <p className="text-sm text-slate-500">You said: <span className="font-semibold">{speechResult || currentWord.chinese}</span></p>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={startSpeechRecognition}
                  disabled={speechRecognizing}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-6 py-3 text-sm font-semibold text-white"
                >
                  <Mic size={18} /> Start Speaking
                </button>
                <p className="text-sm text-slate-500">Click the button and say: <span className="font-semibold text-[#b91c1c]">{currentWord.chinese}</span></p>
                {speechError && <p className="text-sm text-red-600">{speechError}</p>}
              </div>
            )}
            {speechResult && !speechDone && !speechRecognizing && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                Heard: <span className="font-semibold">{speechResult}</span> - Try again!
              </div>
            )}
          </div>
          {speechDone && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleNextWord}
                className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-6 py-3 text-sm font-semibold text-white"
              >
                {isLastWord && sentences.length > 0 ? 'Go to Sentences' : isLastWord ? 'Complete' : 'Next Word'} <ChevronRight size={17} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === 'show-sentences' && currentSentence) {
    const sentencePlayedRef = useRef(false);
    
    useEffect(() => {
      if (!sentencePlayedRef.current && currentSentence) {
        sentencePlayedRef.current = true;
        speak(currentSentence.chinese);
      }
    }, [currentSentence]);

    const replaySentence = () => {
      if (currentSentence) {
        speak(currentSentence.chinese);
      }
    };

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">{selectedClass?.name}</p>
            <h1 className="mt-1 text-2xl font-bold">Sentences</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold">
            {currentSentenceIndex + 1} / {sentences.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-blue-600" style={{ width: `${((currentSentenceIndex) / sentences.length) * 100}%` }} />
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">Listen to the sentence</p>
          <p className="mt-5 text-3xl font-semibold leading-relaxed">{currentSentence.chinese}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-base text-slate-500">{currentSentence.pinyin}</span>
            <button
              onClick={replaySentence}
              className="grid size-10 place-items-center rounded-full border border-stone-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
              aria-label="Replay sentence"
            >
              <Volume2 size={20} />
            </button>
          </div>
          <div className="mt-6 grid gap-2 text-base">
            <p className="text-lg font-medium text-slate-700">{currentSentence.khmer}</p>
            <p className="text-slate-500">{currentSentence.english}</p>
          </div>
        </section>

        <div className="flex justify-center gap-3">
          {currentSentenceIndex > 0 && (
            <button
              onClick={() => {
                sentencePlayedRef.current = false;
                setCurrentSentenceIndex(currentSentenceIndex - 1);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <ChevronRight className="-rotate-180" size={17} /> Previous
            </button>
          )}
          <button
            onClick={() => {
              sentencePlayedRef.current = false;
              handleNextSentence();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white"
          >
            {isLastSentence ? 'Complete Learning' : 'Next Sentence'} <ChevronRight size={17} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="mx-auto max-w-xl space-y-6 text-center">
        <div className="rounded-3xl border border-stone-200 bg-white p-10 shadow-sm">
          <Sparkles className="mx-auto text-amber-500" size={48} />
          <p className="mt-4 text-sm font-semibold tracking-wider text-[#b91c1c]">LEARNING COMPLETE</p>
          <h1 className="mt-2 text-3xl font-bold">Great job! You finished {selectedClass?.name}</h1>
          <p className="mt-4 text-slate-600">
            You learned {words.length} word{words.length !== 1 ? 's' : ''} and {sentences.length} sentence{sentences.length !== 1 ? 's' : ''}.
          </p>
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => {
              setStep('select-date');
              setSelectedClass(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            <RotateCcw size={17} /> Choose Another Class
          </button>
          <button
            onClick={() => {
              setCurrentWordIndex(0);
              setCurrentSentenceIndex(0);
              setStep('teach-words');
              resetWordState();
              audioPlayedRef.current = false;
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white"
          >
            <RotateCcw size={17} /> Repeat This Class
          </button>
        </div>
      </div>
    );
  }

  return null;
}