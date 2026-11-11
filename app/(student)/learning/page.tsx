'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Volume2, ChevronRight, ChevronDown, Check, X, Sparkles, RotateCcw, Mic, MicOff, ArrowLeft, BookOpen, Calendar, Eye, Play } from 'lucide-react';
import HanziWriter from 'hanzi-writer';
import { speakChinese as speak } from '@/lib/speech';

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
  lessonNumber: number | null;
  description: string | null;
  wordCount: number;
  sentenceCount: number;
};

type LessonGroup = {
  name: string;
  dates: ClassOption[];
  totalWords: number;
  totalSentences: number;
};

type LearningStep = 'select-date' | 'preview' | 'teach-words' | 'practice-writing' | 'speak-word' | 'show-sentences' | 'complete';

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
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
  const [contentLoading, setContentLoading] = useState(false);
  const pendingStepRef = useRef<'preview' | 'learn'>('learn');
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
  const sentencePlayedRef = useRef(false);

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
        .select('id, name, date, lesson_number, description')
        .order('date', { ascending: false });

      if (!classData || classData.length === 0) {
        setLoading(false);
        return;
      }

      type ClassRow = {
        id: string;
        name: string | null;
        date: string | null;
        lesson_number?: number | null;
        description?: string | null;
      };

      const classesWithCounts = await Promise.all(
        (classData as ClassRow[]).map(async (c) => {
          const [wordsRes, sentencesRes] = await Promise.all([
            supabase.from('words').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
            supabase.from('sentences').select('id', { count: 'exact', head: true }).eq('class_id', c.id),
          ]);
          return {
            id: c.id,
            name: c.name || 'Unnamed Lesson',
            date: c.date || '',
            lessonNumber: c.lesson_number ?? null,
            description: c.description ?? null,
            wordCount: wordsRes.count || 0,
            sentenceCount: sentencesRes.count || 0,
          };
        })
      );

      const activeClasses = classesWithCounts.filter(c => c.wordCount > 0 || c.sentenceCount > 0);
      setClasses(activeClasses);

      const initialExpanded: Record<string, boolean> = {};
      activeClasses.forEach((c) => {
        const key = c.name || 'Unnamed Lesson';
        initialExpanded[key] = true;
      });
      setExpandedLessons(initialExpanded);
      setLoading(false);
    };

    loadClasses();
  }, []);

  const groupedLessons = useMemo<LessonGroup[]>(() => {
    const map = new Map<string, ClassOption[]>();
    classes.forEach((cls) => {
      const key = cls.name || 'Unnamed Lesson';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cls);
    });

    return Array.from(map.entries()).map(([name, dates]) => {
      const sortedDates = [...dates].sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });
      return {
        name,
        dates: sortedDates,
        totalWords: sortedDates.reduce((sum, d) => sum + d.wordCount, 0),
        totalSentences: sortedDates.reduce((sum, d) => sum + d.sentenceCount, 0),
      };
    });
  }, [classes]);

  useEffect(() => {
    if (!selectedClass || !supabase) return;

    const loadContent = async () => {
      setContentLoading(true);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setContentLoading(false);
        return;
      }

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
      sentencePlayedRef.current = false;
      resetWordState();

      if (pendingStepRef.current === 'preview') {
        setStep('preview');
      } else if (mappedWords.length > 0) {
        setStep('teach-words');
      } else if (mappedSentences.length > 0) {
        setStep('show-sentences');
      } else {
        setStep('preview');
      }
      setContentLoading(false);
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
    if (step === 'show-sentences' && currentSentence && !sentencePlayedRef.current) {
      sentencePlayedRef.current = true;
      speak(currentSentence.chinese);
    }
  }, [step, currentSentence]);

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

  const replaySentence = () => {
    if (currentSentence) {
      speak(currentSentence.chinese);
    }
  };

  const toggleLesson = (lessonName: string) => {
    setExpandedLessons((prev) => ({
      ...prev,
      [lessonName]: !(prev[lessonName] ?? true),
    }));
  };

  const openClassDate = (cls: ClassOption, mode: 'preview' | 'learn') => {
    pendingStepRef.current = mode;
    setSelectedClass(cls);
  };

  const formatDateLabel = (dateStr?: string | null) => {
    if (!dateStr) return 'No date';
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading || contentLoading) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm text-slate-500">
          <svg className="animate-spin h-5 w-5 text-[#b91c1c]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>
          {contentLoading ? 'Loading words & sentences...' : 'Loading lessons...'}
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
          <h1 className="mt-1 text-3xl font-bold">Choose a lesson & date to start learning</h1>
          <p className="mt-1 text-sm text-slate-500">Select a date under a lesson to preview words &amp; sentences or start practicing.</p>
        </div>

        <div className="space-y-4">
          {groupedLessons.map((lesson) => {
            const isExpanded = expandedLessons[lesson.name] ?? true;
            return (
              <section
                key={lesson.name}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
              >
                {/* Parent Task: Lesson */}
                <button
                  type="button"
                  onClick={() => toggleLesson(lesson.name)}
                  className="flex w-full items-center justify-between gap-4 bg-stone-50/80 px-5 py-4 text-left transition hover:bg-stone-100/80"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#b91c1c] text-white shadow-sm">
                      <BookOpen size={19} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#b91c1c]">
                          Lesson
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {lesson.dates.length} date{lesson.dates.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900 truncate">
                        {lesson.name}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <span className="grid size-4 place-items-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">词</span>
                          {lesson.totalWords} word{lesson.totalWords !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="grid size-4 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">句</span>
                          {lesson.totalSentences} sentence{lesson.totalSentences !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Subtasks: Dates under Lesson */}
                {isExpanded && (
                  <div className="border-t border-stone-200 bg-white px-4 py-3 sm:px-5">
                    <div className="relative space-y-2.5 border-l-2 border-stone-200 pl-4 sm:pl-5">
                      {lesson.dates.map((dateItem) => (
                        <div
                          key={dateItem.id}
                          className="relative flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50/50 p-3.5 transition hover:border-red-200 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
                        >
                          {/* Connector dot to Lesson parent */}
                          <span
                            aria-hidden="true"
                            className="absolute -left-[22px] sm:-left-[26px] top-6 h-0.5 w-3.5 sm:w-4 bg-stone-200"
                          />
                          <div
                            onClick={() => openClassDate(dateItem, 'learn')}
                            className="flex flex-1 cursor-pointer items-start gap-3 min-w-0"
                          >
                            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white border border-stone-200 text-[#b91c1c] shadow-xs">
                              <Calendar size={17} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm sm:text-base font-bold text-slate-900">
                                  {formatDateLabel(dateItem.date)}
                                </p>
                                {dateItem.lessonNumber !== null && (
                                  <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                    Lesson #{dateItem.lessonNumber}
                                  </span>
                                )}
                              </div>
                              {dateItem.description && (
                                <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                                  {dateItem.description}
                                </p>
                              )}
                              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                <span className="inline-flex items-center gap-1">
                                  <span className="grid size-4 place-items-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">词</span>
                                  {dateItem.wordCount} word{dateItem.wordCount !== 1 ? 's' : ''}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <span className="grid size-4 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">句</span>
                                  {dateItem.sentenceCount} sentence{dateItem.sentenceCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => openClassDate(dateItem, 'preview')}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-stone-300 hover:bg-stone-50"
                            >
                              <Eye size={14} /> Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => openClassDate(dateItem, 'learn')}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#b91c1c] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#991b1b]"
                            >
                              <Play size={13} className="fill-current" /> Learn
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 'preview' && selectedClass) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => {
                setStep('select-date');
                setSelectedClass(null);
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#b91c1c]"
            >
              <ArrowLeft size={16} /> Back to Lessons
            </button>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">
              {selectedClass.name} · {formatDateLabel(selectedClass.date)}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold">Preview Words &amp; Sentences</h1>
          </div>
          {(words.length > 0 || sentences.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setCurrentWordIndex(0);
                setCurrentSentenceIndex(0);
                sentencePlayedRef.current = false;
                resetWordState();
                setStep(words.length > 0 ? 'teach-words' : 'show-sentences');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#991b1b]"
            >
              <Play size={15} className="fill-current" /> Start Practice
            </button>
          )}
        </div>

        {/* Words Preview */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <span className="grid size-6 place-items-center rounded-full bg-red-100 text-xs font-bold text-red-600">词</span>
              Words ({words.length})
            </h2>
          </div>
          {words.length === 0 ? (
            <p className="text-sm text-slate-500">No words for this date yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {words.map((w, idx) => (
                <div
                  key={w.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/70 p-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-slate-400">{idx + 1}.</span>
                      <span className="text-2xl font-bold text-slate-900">{w.chinese}</span>
                      {w.pinyin && <span className="text-sm font-medium text-[#b91c1c]">{w.pinyin}</span>}
                    </div>
                    {w.khmer && <p className="mt-1 text-sm text-slate-700">{w.khmer}</p>}
                    {w.english && <p className="text-xs text-slate-500">{w.english}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(w.chinese)}
                    className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-[#b91c1c]"
                    aria-label={`Listen to ${w.chinese}`}
                  >
                    <Volume2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sentences Preview */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <span className="grid size-6 place-items-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">句</span>
              Sentences ({sentences.length})
            </h2>
          </div>
          {sentences.length === 0 ? (
            <p className="text-sm text-slate-500">No sentences for this date yet.</p>
          ) : (
            <div className="space-y-3">
              {sentences.map((s, idx) => (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/70 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-slate-400">{idx + 1}.</span>
                      <p className="text-lg font-bold text-slate-900">{s.chinese}</p>
                    </div>
                    {s.pinyin && <p className="mt-1 text-sm font-medium text-blue-700">{s.pinyin}</p>}
                    {s.khmer && <p className="mt-1 text-sm text-slate-700">{s.khmer}</p>}
                    {s.english && <p className="text-xs text-slate-500">{s.english}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => speak(s.chinese)}
                    className="grid size-9 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                    aria-label={`Listen to sentence ${idx + 1}`}
                  >
                    <Volume2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (step === 'teach-words' && currentWord) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => {
                  setStep('select-date');
                  setSelectedClass(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]"
              >
                <ArrowLeft size={14} /> Lessons
              </button>
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]"
              >
                <Eye size={14} /> Preview All
              </button>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">
              {selectedClass?.name} {selectedClass?.date ? `· ${formatDateLabel(selectedClass.date)}` : ''}
            </p>
            <h1 className="mt-1 text-2xl font-bold">Learn Words</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold shrink-0">
            {currentWordIndex + 1} / {words.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-[#b91c1c]" style={{ width: `${((currentWordIndex) / words.length) * 100}%` }} />
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm text-slate-500">Listen to the word</p>
          <p className="mt-5 text-4xl font-semibold sm:text-6xl">{currentWord.chinese}</p>
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

        <section className="rounded-3xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm text-slate-500">Write the character</p>
          <p className="mt-5 text-4xl font-semibold sm:text-6xl">{currentWord.chinese}</p>
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
            <p className="mt-1 text-4xl font-bold tracking-wide text-[#b91c1c] sm:text-5xl">{character}</p>
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

        <section className="rounded-3xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm text-slate-500">Say the word aloud</p>
          <p className="mt-5 text-4xl font-semibold tracking-wide sm:text-6xl">{currentWord.chinese}</p>
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
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => {
                  setStep('select-date');
                  setSelectedClass(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]"
              >
                <ArrowLeft size={14} /> Lessons
              </button>
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]"
              >
                <Eye size={14} /> Preview All
              </button>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">
              {selectedClass?.name} {selectedClass?.date ? `· ${formatDateLabel(selectedClass.date)}` : ''}
            </p>
            <h1 className="mt-1 text-2xl font-bold">Sentences</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold shrink-0">
            {currentSentenceIndex + 1} / {sentences.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-blue-600" style={{ width: `${((currentSentenceIndex) / sentences.length) * 100}%` }} />
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
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
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setStep('select-date');
              setSelectedClass(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            <ArrowLeft size={17} /> Choose Another Lesson
          </button>
          <button
            onClick={() => setStep('preview')}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            <Eye size={17} /> Preview Words &amp; Sentences
          </button>
          <button
            onClick={() => {
              setCurrentWordIndex(0);
              setCurrentSentenceIndex(0);
              sentencePlayedRef.current = false;
              resetWordState();
              audioPlayedRef.current = false;
              setStep(words.length > 0 ? 'teach-words' : 'show-sentences');
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white"
          >
            <RotateCcw size={17} /> Repeat This Date
          </button>
        </div>
      </div>
    );
  }

  return null;
}
