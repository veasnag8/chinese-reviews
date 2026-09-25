'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Volume2, ChevronRight, Check, X, Sparkles, RotateCcw, Mic, MicOff, ArrowLeft } from 'lucide-react';
import HanziWriter from 'hanzi-writer';

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
  const isHoldingRef = useRef(false);
  const audioPlayedRef = useRef(false);

  // Writing practice state
  const writerElementRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [totalStrokes, setTotalStrokes] = useState(0);
  const [strokePaths, setStrokePaths] = useState<string[]>([]);
  const [boardSize, setBoardSize] = useState(0);
  const [showCorrectPopup, setShowCorrectPopup] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [writeComplete, setWriteComplete] = useState(false);
  const [charIndex, setCharIndex] = useState(0);

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
        .order('date', { ascending: false });

      if (!classData || classData.length === 0) {
        setLoading(false);
        return;
      }

      type ClassRow = { id: string; name: string | null; date: string | null };

      const classesWithCounts = await Promise.all(
        (classData as ClassRow[]).map(async (c) => {
          const [wordsRes, sentencesRes] = await Promise.all([
            supabase.from('words').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
            supabase.from('sentences').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
          ]);
          return {
            id: c.id,
            name: c.name || '',
            date: c.date || '',
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
          .order('created_at', { ascending: true }),
        supabase
          .from('sentences')
          .select('id, chinese_sentence, pinyin, khmer_translation, english_translation, class_id')
          .eq('class_id', selectedClass.id)
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
        .filter((s) => s.chinese_sentence || s.chinese)
        .map((s) => ({
          id: s.id,
          chinese: s.chinese_sentence || s.chinese || '',
          pinyin: s.pinyin || '',
          khmer: s.khmer_translation || s.khmer || '',
          english: s.english_translation || s.english || '',
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
    // Reset writing state
    setStrokeCount(0);
    setTotalStrokes(0);
    setStrokePaths([]);
    setBoardSize(0);
    setShowCorrectPopup(false);
    setWriteComplete(false);
    setCharIndex(0);
  };

  const currentWord = words[currentWordIndex];
  const currentSentence = sentences[currentSentenceIndex];
  const isLastWord = currentWordIndex === words.length - 1;
  const isLastSentence = currentSentenceIndex === sentences.length - 1;

  // Writing practice: split word into characters
  const characters = currentWord ? [...currentWord.chinese] : [];
  const character = characters[charIndex] || '';
  const isLastChar = charIndex === characters.length - 1;

  // HanziWriter effect for practice-writing step
  useEffect(() => {
    if (step !== 'practice-writing' || !character) return;
    
    const element = writerElementRef.current;
    if (!element) return;

    element.replaceChildren();
    setStrokeCount(0);
    setTotalStrokes(0);
    setStrokePaths([]);
    setWriteComplete(false);
    setShowCorrectPopup(false);

    let cancelled = false;
    HanziWriter.loadCharacterData(character).then((data) => {
      if (!cancelled && data) {
        setStrokePaths(data.strokes);
        setTotalStrokes(data.strokes.length);
      }
    });

    const writer = HanziWriter.create(element, character, {
      width: '100%' as unknown as number,
      height: '100%' as unknown as number,
      padding: 22,
      showOutline: true,
      showCharacter: true,
      strokeColor: '#ff9bb5',
      outlineColor: '#eaf7ff',
      highlightColor: '#ff6f91',
      drawingColor: '#1a1a2e',
      drawingWidth: 8,
      drawingFadeDuration: 300,
      strokeAnimationSpeed: 1.2,
      delayBetweenStrokes: 300,
      showHintAfterMisses: 1,
      highlightOnComplete: true,
      onCorrectStroke: (strokeData) => {
        setStrokeCount(strokeData.strokeNum + 1);
        setTotalStrokes(strokeData.strokeNum + strokeData.strokesRemaining + 1);
        setShowCorrectPopup(true);
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => setShowCorrectPopup(false), 1000);
      },
      onComplete: () => handleWriteComplete(),
    });

    writerRef.current = writer;
    writer.animateCharacter().then(() => writer.quiz());

    const resizeObserver = new ResizeObserver(() => {
      const size = element.getBoundingClientRect();
      setBoardSize(size.width);
      writer.updateDimensions({ width: size.width, height: size.height });
    });
    const size = element.getBoundingClientRect();
    setBoardSize(size.width);
    resizeObserver.observe(element);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      writer.cancelQuiz();
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
      writerRef.current = null;
    };
  }, [step, character, charIndex]);

  const handleWriteComplete = () => {
    if (isLastChar) {
      setWriteComplete(true);
      setWritingDone(true);
    } else {
      setCharIndex(charIndex + 1);
      setStrokeCount(0);
      setTotalStrokes(0);
      setStrokePaths([]);
      setWriteComplete(false);
      setShowCorrectPopup(false);
    }
  };

  const handleReplayWrite = () => {
    const writer = writerRef.current;
    if (!writer) return;
    writer.cancelQuiz();
    writer.animateCharacter().then(() => writer.quiz());
    setStrokeCount(0);
    setTotalStrokes(0);
    setStrokePaths([]);
    setWriteComplete(false);
    setShowCorrectPopup(false);
    HanziWriter.loadCharacterData(character).then((data) => {
      if (data) {
        setStrokePaths(data.strokes);
        setTotalStrokes(data.strokes.length);
      }
    });
  };

  useEffect(() => {
    if (step === 'teach-words' && currentWord && !wordPlayed && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      speak(currentWord.chinese);
      setWordPlayed(true);
    }
  }, [step, currentWord, wordPlayed]);

  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      isHoldingRef.current = false;
    };
  }, [step, currentWordIndex]);

  const startHoldSpeaking = (e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (typeof window === 'undefined') return;

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // ignore
      }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. You can click skip or continue.');
      return;
    }

    isHoldingRef.current = true;
    setSpeechError('');

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'zh-CN';
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.continuous = true;

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        const transcript = fullTranscript.trim();
        setSpeechResult(transcript);

        const normalize = (s: string) => s.replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
        const target = normalize(currentWord?.chinese || '');
        const spoken = normalize(transcript);

        if (spoken && (spoken.includes(target) || target.includes(spoken))) {
          setSpeechDone(true);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          setSpeechError(`Recognition error: ${event.error}`);
        }
        setSpeechRecognizing(false);
      };

      recognition.onend = () => {
        setSpeechRecognizing(false);
      };

      speechRecognitionRef.current = recognition;
      setSpeechRecognizing(true);
      recognition.start();
    } catch (err: any) {
      console.error('Speech recognition start error:', err);
      setSpeechError('Could not start microphone. Please check browser permissions.');
      setSpeechRecognizing(false);
    }
  };

  const stopHoldSpeaking = (e?: React.SyntheticEvent) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!isHoldingRef.current && !speechRecognizing) return;
    isHoldingRef.current = false;

    setTimeout(() => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setSpeechRecognizing(false);
    }, 250);
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
    const wordChars = [...currentWord.chinese];
    const totalChars = wordChars.length;

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

        {/* Character progress */}
        <div className="mt-4 flex items-center justify-center gap-2">
          {wordChars.map((c, idx) => (
            <span
              key={idx}
              className={`text-3xl font-bold transition-colors ${
                idx < charIndex ? 'text-emerald-600' : idx === charIndex ? 'text-[#b91c1c]' : 'text-stone-300'
              }`}
            >
              {c}
            </span>
          ))}
        </div>

        {/* Writing canvas */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="aspect-square max-w-xs mx-auto rounded-xl border-2 border-sky-100 bg-sky-50 relative overflow-hidden touch-none select-none">
            <div
              ref={writerElementRef}
              className="absolute inset-0 cursor-crosshair touch-none select-none"
              style={{ touchAction: 'none' }}
              aria-label={`Stroke order practice for ${character}`}
            />
            {boardSize > 0 && (
              <svg
                viewBox={`0 0 ${boardSize} ${boardSize}`}
                className="pointer-events-none absolute inset-0 z-10 h-full w-full touch-none select-none"
                style={{ touchAction: 'none' }}
                aria-hidden="true"
              >
                <g
                  transform={`translate(22 ${boardSize - (22 + 124 * ((boardSize - 44) / 1024))}) scale(${(boardSize - 44) / 1024} ${-((boardSize - 44) / 1024)})`}
                >
                  {strokePaths.slice(0, strokeCount).map((path, index) => (
                    <path key={`${index}-${path}`} d={path} fill="#1a1a2e" stroke="#1a1a2e" strokeWidth="2" />
                  ))}
                </g>
              </svg>
            )}

            {showCorrectPopup && (
              <div className="pointer-events-none absolute left-1/2 top-5 z-30 -translate-x-1/2 animate-[correct-pop_1s_ease-out_forwards] rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-600 shadow-lg ring-1 ring-emerald-100">
                <Check size={16} className="mr-1 inline" /> ត្រឹមត្រូវ!
              </div>
            )}
          </div>

          {/* Current character display */}
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-500">Current character:</p>
            <p className="mt-1 text-5xl font-bold text-[#b91c1c] tracking-wide">{character}</p>
            <p className="text-sm text-slate-500">{currentWord.pinyin}</p>
          </div>

          {/* Stroke indicators */}
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {Array.from({ length: totalStrokes || strokePaths.length || 1 }, (_, index) => index + 1).map((step) => {
              const done = step <= strokeCount;
              const active = step === strokeCount + 1 && !writeComplete;
              return (
                <span
                  key={step}
                  className={[
                    'grid size-9 place-items-center rounded-full border text-xs font-bold',
                    done ? 'border-sky-500 bg-sky-500 text-white' : '',
                    active ? 'border-sky-500 bg-sky-50 text-sky-700 ring-4 ring-sky-100' : '',
                    !done && !active ? 'border-sky-100 bg-slate-50 text-slate-300' : '',
                  ].join(' ')}
                >
                  {done ? '✓' : step}
                </span>
              );
            })}
          </div>

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={handleReplayWrite}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
            >
              <RotateCcw size={16} /> Replay
            </button>
            {!writeComplete && (
              <button
                onClick={handleReplayWord}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                <Volume2 size={16} /> Listen Again
              </button>
            )}
            {isLastChar && writeComplete && (
              <button
                onClick={handleWritingComplete}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <Check size={16} /> Continue to Speaking
              </button>
            )}
            {!isLastChar && writeComplete && (
              <button
                onClick={() => setCharIndex(charIndex + 1)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                Next Character <ChevronRight size={16} />
              </button>
            )}
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
          <p className="mt-5 text-6xl font-semibold tracking-wide">{currentWord.chinese}</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-xl font-medium text-slate-600">{currentWord.pinyin}</span>
            <button
              onClick={handleReplayWord}
              className="grid size-10 place-items-center rounded-full border border-stone-200 bg-white text-slate-600 hover:bg-red-50 hover:text-[#b91c1c] hover:border-red-200 transition-colors"
              title="Listen to native pronunciation"
              aria-label="Replay pronunciation"
            >
              <Volume2 size={20} />
            </button>
          </div>
          {currentWord.khmer && (
            <p className="mt-2 text-sm text-slate-500">{currentWord.khmer}</p>
          )}
        </section>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            {speechDone ? (
              <div className="w-full max-w-md space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-2.5 text-emerald-800 font-semibold shadow-sm">
                  <Check size={20} className="stroke-[3]" /> Correct! Well done.
                </div>
                <p className="text-sm text-slate-600">
                  You said: <span className="font-semibold text-emerald-700">{speechResult || currentWord.chinese}</span>
                </p>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onMouseDown={startHoldSpeaking}
                    onMouseUp={stopHoldSpeaking}
                    onMouseLeave={stopHoldSpeaking}
                    onTouchStart={startHoldSpeaking}
                    onTouchEnd={stopHoldSpeaking}
                    onTouchCancel={stopHoldSpeaking}
                    className="select-none touch-none inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 active:scale-95 transition-all"
                  >
                    <Mic size={15} /> Hold to Practice Again
                  </button>
                  <button
                    onClick={handleNextWord}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b91c1c] px-6 py-3 text-sm font-semibold text-white hover:bg-[#991b1b] shadow-md shadow-red-200 active:scale-95 transition-all w-full sm:w-auto"
                  >
                    {isLastWord && sentences.length > 0 ? 'Go to Sentences' : isLastWord ? 'Complete' : 'Next Word'} <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md space-y-5">
                {/* Hold to speak circular button */}
                <div className="relative mx-auto flex flex-col items-center">
                  {speechRecognizing && (
                    <span className="absolute -inset-3 rounded-full bg-red-400/30 animate-ping pointer-events-none" />
                  )}
                  <button
                    onMouseDown={startHoldSpeaking}
                    onMouseUp={stopHoldSpeaking}
                    onMouseLeave={stopHoldSpeaking}
                    onTouchStart={startHoldSpeaking}
                    onTouchEnd={stopHoldSpeaking}
                    onTouchCancel={stopHoldSpeaking}
                    className={`select-none touch-none relative z-10 grid size-24 place-items-center rounded-full shadow-lg transition-all active:scale-90 cursor-pointer ${
                      speechRecognizing
                        ? 'bg-red-600 text-white shadow-red-300 scale-105 ring-4 ring-red-300'
                        : 'bg-[#b91c1c] text-white hover:bg-[#991b1b] shadow-stone-300 hover:scale-105'
                    }`}
                    aria-label="Hold to speak"
                  >
                    <Mic size={40} className={speechRecognizing ? 'animate-pulse' : ''} />
                  </button>
                </div>

                {/* Instructions */}
                <div>
                  <p className="text-base font-bold text-slate-800">
                    {speechRecognizing ? '🔴 Recording... Keep holding & speak!' : 'ចុចសង្កត់ដើម្បីនិយាយ / Hold to Speak'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {speechRecognizing
                      ? `Say: "${currentWord.chinese}" clearly`
                      : 'Hold button with mouse or finger, speak the word, then release'}
                  </p>
                </div>

                {/* Spoken result / feedback */}
                {speechResult && !speechDone && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Heard: <span className="font-semibold">{speechResult}</span> — Try holding and speaking again!
                  </div>
                )}

                {speechError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                    {speechError}
                  </div>
                )}

                {/* Skip option */}
                <div className="pt-2 border-t border-stone-100">
                  <button
                    onClick={() => {
                      setSpeechDone(true);
                      handleNextWord();
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 hover:underline"
                  >
                    Skip pronunciation practice →
                  </button>
                </div>
              </div>
            )}
          </div>
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