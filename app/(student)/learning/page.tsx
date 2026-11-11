'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Volume2, ChevronRight, ChevronDown, Check, X, Sparkles, RotateCcw, Mic, MicOff, ArrowLeft, BookOpen, Calendar, Eye, Play, GraduationCap, Layers } from 'lucide-react';
import HanziWriter from 'hanzi-writer';
import { speakChinese as speak } from '@/lib/speech';
import { useLanguage } from '@/lib/i18n';
import {
  classifySentenceLesson,
  classifyWordLesson,
  CORE_LESSONS,
  sortLessonKeys,
  type LessonKey,
} from '@/lib/lessons';

type LearningWord = {
  id: string;
  chinese: string;
  pinyin: string;
  khmer: string;
  english: string;
  className: string;
  classId: string;
  classDate: string;
  lessonKey: LessonKey;
};

type LearningSentence = {
  id: string;
  chinese: string;
  pinyin: string;
  khmer: string;
  english: string;
  className: string;
  classId: string;
  classDate: string;
  lessonKey: LessonKey;
};

type ClassRow = {
  id: string;
  name: string | null;
  date: string | null;
  lesson_number?: number | null;
  description?: string | null;
};

type LessonDateSubtask = {
  classId: string;
  date: string;
  lessonNumber: number | null;
  description: string | null;
  words: LearningWord[];
  sentences: LearningSentence[];
};

type LessonTaskGroup = {
  lessonKey: LessonKey;
  words: LearningWord[];
  sentences: LearningSentence[];
  dates: LessonDateSubtask[];
};

type ClassTaskGroup = {
  className: string;
  lessons: LessonTaskGroup[];
  totalWords: number;
  totalSentences: number;
  totalDates: number;
};

type ActiveSession = {
  title: string;
  subtitle: string;
};

type LearningStep = 'select-date' | 'preview' | 'teach-words' | 'practice-writing' | 'speak-word' | 'show-sentences' | 'complete';

const UNIFIED_LESSON_THEME = {
  card: 'border-sky-300/80 bg-sky-100',
  header: 'bg-sky-100',
  icon: 'border-sky-300 bg-white text-sky-700',
  badge: 'bg-sky-200/80 text-sky-900',
  subtaskContainer: 'border-t border-sky-200 bg-slate-100 px-4 py-3',
  connector: 'border-slate-300',
  subtaskCard: 'border-slate-300/80 bg-slate-200/70 hover:border-slate-400/70 hover:bg-slate-200',
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
  const { lang, t } = useLanguage();
  const [classRows, setClassRows] = useState<ClassRow[]>([]);
  const [allWords, setAllWords] = useState<LearningWord[]>([]);
  const [allSentences, setAllSentences] = useState<LearningSentence[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
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
    const loadLearningData = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }

      const [classesRes, wordsRes, sentencesRes] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name, date, lesson_number, description')
          .order('date', { ascending: false }),
        supabase
          .from('words')
          .select('id, chinese, pinyin, khmer, english, class_id, created_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('sentences')
          .select('id, chinese_sentence, pinyin, khmer_translation, english_translation, class_id, created_at')
          .order('created_at', { ascending: true }),
      ]);

      const fetchedClasses = (classesRes.data || []) as ClassRow[];
      const classById = new Map<string, ClassRow>();
      fetchedClasses.forEach((c) => classById.set(c.id, c));

      const mappedWords: LearningWord[] = ((wordsRes.data || []) as any[])
        .filter((w) => w.chinese)
        .map((w) => {
          const cls = w.class_id ? classById.get(w.class_id) : undefined;
          return {
            id: w.id,
            chinese: w.chinese,
            pinyin: w.pinyin || '',
            khmer: w.khmer || '',
            english: w.english || '',
            className: cls?.name || 'Outside Words',
            classId: w.class_id || 'unassigned',
            classDate: cls?.date || '',
            lessonKey: classifyWordLesson(w.chinese, cls?.lesson_number ?? null),
          };
        });

      const mappedSentences: LearningSentence[] = ((sentencesRes.data || []) as any[])
        .filter((s) => s.chinese_sentence || s.chinese)
        .map((s) => {
          const cls = s.class_id ? classById.get(s.class_id) : undefined;
          const text = s.chinese_sentence || s.chinese || '';
          return {
            id: s.id,
            chinese: text,
            pinyin: s.pinyin || '',
            khmer: s.khmer_translation || s.khmer || '',
            english: s.english_translation || s.english || '',
            className: cls?.name || 'Outside Words',
            classId: s.class_id || 'unassigned',
            classDate: cls?.date || '',
            lessonKey: classifySentenceLesson(text, cls?.lesson_number ?? null),
          };
        });

      setClassRows(fetchedClasses);
      setAllWords(mappedWords);
      setAllSentences(mappedSentences);

      const initClasses: Record<string, boolean> = {};
      const initLessons: Record<string, boolean> = {};
      fetchedClasses.forEach((c) => {
        const name = c.name || 'Unnamed Class';
        initClasses[name] = true;
      });
      if (mappedWords.some((w) => w.classId === 'unassigned') || mappedSentences.some((s) => s.classId === 'unassigned')) {
        initClasses['Outside Words'] = true;
      }
      Object.keys(initClasses).forEach((clsName) => {
        [...CORE_LESSONS, 'Outside Words' as LessonKey].forEach((lessonKey) => {
          initLessons[`${clsName}::${lessonKey}`] = true;
        });
      });
      mappedWords.forEach((w) => {
        initLessons[`${w.className}::${w.lessonKey}`] = true;
      });
      mappedSentences.forEach((s) => {
        initLessons[`${s.className}::${s.lessonKey}`] = true;
      });

      setExpandedClasses(initClasses);
      setExpandedLessons(initLessons);
      setLoading(false);
    };

    loadLearningData();
  }, []);

  const groupedClasses = useMemo<ClassTaskGroup[]>(() => {
    const classInfoById = new Map<string, ClassRow>();
    classRows.forEach((c) => classInfoById.set(c.id, c));

    const classNamesSet = new Set<string>();
    classRows.forEach((c) => classNamesSet.add(c.name || 'Unnamed Class'));
    allWords.forEach((w) => classNamesSet.add(w.className));
    allSentences.forEach((s) => classNamesSet.add(s.className));

    const groups: ClassTaskGroup[] = [];

    classNamesSet.forEach((className) => {
      const classWords = allWords.filter((w) => w.className === className);
      const classSentences = allSentences.filter((s) => s.className === className);
      if (classWords.length === 0 && classSentences.length === 0) return;

      const dateIds = new Set<string>();
      classWords.forEach((w) => dateIds.add(w.classId));
      classSentences.forEach((s) => dateIds.add(s.classId));

      const lessonKeys = sortLessonKeys([
        ...CORE_LESSONS,
        ...classWords.map((w) => w.lessonKey),
        ...classSentences.map((s) => s.lessonKey),
      ]);
      const lessons: LessonTaskGroup[] = lessonKeys.map((lessonKey) => {
        const lessonWords = classWords.filter((w) => w.lessonKey === lessonKey);
        const lessonSentences = classSentences.filter((s) => s.lessonKey === lessonKey);

        const lessonDateMap = new Map<string, LessonDateSubtask>();
        lessonWords.forEach((w) => {
          if (!lessonDateMap.has(w.classId)) {
            const cls = classInfoById.get(w.classId);
            lessonDateMap.set(w.classId, {
              classId: w.classId,
              date: cls?.date || w.classDate || '',
              lessonNumber: cls?.lesson_number ?? null,
              description: cls?.description ?? null,
              words: [],
              sentences: [],
            });
          }
          lessonDateMap.get(w.classId)!.words.push(w);
        });

        lessonSentences.forEach((s) => {
          if (!lessonDateMap.has(s.classId)) {
            const cls = classInfoById.get(s.classId);
            lessonDateMap.set(s.classId, {
              classId: s.classId,
              date: cls?.date || s.classDate || '',
              lessonNumber: cls?.lesson_number ?? null,
              description: cls?.description ?? null,
              words: [],
              sentences: [],
            });
          }
          lessonDateMap.get(s.classId)!.sentences.push(s);
        });

        const sortedDates = Array.from(lessonDateMap.values()).sort((a, b) => {
          const timeA = a.date ? new Date(a.date).getTime() : 0;
          const timeB = b.date ? new Date(b.date).getTime() : 0;
          return timeB - timeA;
        });

        return {
          lessonKey,
          words: lessonWords,
          sentences: lessonSentences,
          dates: sortedDates,
        };
      }).filter((lesson) => {
        if (lesson.lessonKey === 'Outside Words') {
          return lesson.words.length > 0 || lesson.sentences.length > 0;
        }
        return true;
      });

      groups.push({
        className,
        lessons,
        totalWords: classWords.length,
        totalSentences: classSentences.length,
        totalDates: dateIds.size,
      });
    });

    return groups;
  }, [classRows, allWords, allSentences]);

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

  const toggleClassGroup = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !(prev[className] ?? true),
    }));
  };

  const toggleLesson = (className: string, lessonKey: string) => {
    const key = `${className}::${lessonKey}`;
    setExpandedLessons((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }));
  };

  const openSession = (
    title: string,
    subtitle: string,
    sessionWords: LearningWord[],
    sessionSentences: LearningSentence[],
    mode: 'preview' | 'learn'
  ) => {
    if (sessionWords.length === 0 && sessionSentences.length === 0) return;
    setActiveSession({ title, subtitle });
    setWords(sessionWords);
    setSentences(sessionSentences);
    setCurrentWordIndex(0);
    setCurrentSentenceIndex(0);
    sentencePlayedRef.current = false;
    resetWordState();

    if (mode === 'preview') {
      setStep('preview');
    } else if (sessionWords.length > 0) {
      setStep('teach-words');
    } else {
      setStep('show-sentences');
    }
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

  const lessonDisplayName = (key: LessonKey) => {
    if (key === 'Outside Words') return t.learning.outsideWords;
    if (key === 'Lesson 1') return t.learning.lesson1;
    if (key === 'Lesson 2') return t.learning.lesson2;
    if (key === 'Lesson 3') return t.learning.lesson3;
    const match = key.match(/^Lesson (\d+)$/);
    if (match && lang === 'kh') {
      return `មេរៀនទី ${match[1]} (${key})`;
    }
    return key;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-2 text-sm text-slate-500">
          <svg className="animate-spin h-5 w-5 text-[#b91c1c]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round"/></svg>
          {t.learning.loadingLessons}
        </div>
      </div>
    );
  }

  if (groupedClasses.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-stone-300 p-10 text-center text-slate-500">
        <Sparkles className="mx-auto text-slate-300" size={48} />
        <p className="mt-4 text-lg font-medium">{t.learning.emptyTitle}</p>
        <p className="mt-2">{t.learning.emptySubtitle}</p>
      </div>
    );
  }

  if (step === 'select-date') {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">{t.learning.eyebrow}</p>
          <h1 className="mt-1 text-3xl font-bold">{t.learning.chooseTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t.learning.chooseSubtitle}
          </p>
        </div>

        <div className="space-y-5">
          {groupedClasses.map((classGroup) => {
            const isClassExpanded = expandedClasses[classGroup.className] ?? true;
            return (
              <section
                key={classGroup.className}
                className="overflow-hidden rounded-2xl border border-red-200/70 bg-white shadow-sm"
              >
                {/* Level 1: Parent Class */}
                <button
                  type="button"
                  onClick={() => toggleClassGroup(classGroup.className)}
                  className="flex w-full items-center justify-between gap-4 bg-gradient-to-r from-red-50/80 via-rose-50/50 to-amber-50/40 px-5 py-4 text-left transition hover:from-red-50 hover:to-amber-50/60"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-[#b91c1c] text-white shadow-sm">
                      <GraduationCap size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#b91c1c]">
                          {t.learning.classBadge}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {classGroup.lessons.length} {lang === 'en' && classGroup.lessons.length === 1 ? t.learning.lessonUnit : t.learning.lessonsUnit} · {classGroup.totalDates} {lang === 'en' && classGroup.totalDates === 1 ? t.learning.dateUnit : t.learning.datesUnit}
                        </span>
                      </div>
                      <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900 truncate">
                        {classGroup.className}
                      </h2>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <span className="grid size-4 place-items-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">词</span>
                          {classGroup.totalWords} {lang === 'en' && classGroup.totalWords === 1 ? t.learning.wordUnit : t.learning.wordsUnit}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="grid size-4 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">句</span>
                          {classGroup.totalSentences} {lang === 'en' && classGroup.totalSentences === 1 ? t.learning.sentenceUnit : t.learning.sentencesUnit}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${
                      isClassExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Level 2: Lessons under Class */}
                {isClassExpanded && (
                  <div className="border-t border-red-100/80 bg-stone-50/50 px-4 py-4 sm:px-5 space-y-3.5">
                    {classGroup.lessons.map((lesson) => {
                      const lessonExpandKey = `${classGroup.className}::${lesson.lessonKey}`;
                      const isLessonExpanded = expandedLessons[lessonExpandKey] ?? true;
                      const isOutside = lesson.lessonKey === 'Outside Words';
                      const hasItems = lesson.words.length > 0 || lesson.sentences.length > 0;
                      const theme = UNIFIED_LESSON_THEME;
                      const lessonLabel = lessonDisplayName(lesson.lessonKey);

                      return (
                        <div
                          key={lesson.lessonKey}
                          className={`overflow-hidden rounded-xl border shadow-xs ${theme.card}`}
                        >
                          <div className={`flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between ${theme.header}`}>
                            <button
                              type="button"
                              onClick={() => toggleLesson(classGroup.className, lesson.lessonKey)}
                              className="flex flex-1 items-start gap-3 text-left min-w-0"
                            >
                              <span
                                className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border shadow-xs ${theme.icon}`}
                              >
                                {isOutside ? <Layers size={17} /> : <BookOpen size={17} />}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-base font-bold text-slate-900">
                                    {lessonLabel}
                                  </h3>
                                  {isOutside && (
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}>
                                      {t.learning.extraVocab}
                                    </span>
                                  )}
                                  {lesson.dates.length > 0 && (
                                    <span className="text-xs text-slate-500">
                                      · {lesson.dates.length} {lang === 'en' && lesson.dates.length === 1 ? t.learning.dateUnit : t.learning.datesUnit}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                  <span className="inline-flex items-center gap-1">
                                    <span className="grid size-4 place-items-center rounded-full bg-red-100 text-[10px] font-bold text-red-600">词</span>
                                    {lesson.words.length} {lang === 'en' && lesson.words.length === 1 ? t.learning.wordUnit : t.learning.wordsUnit}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <span className="grid size-4 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">句</span>
                                    {lesson.sentences.length} {lang === 'en' && lesson.sentences.length === 1 ? t.learning.sentenceUnit : t.learning.sentencesUnit}
                                  </span>
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {hasItems ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openSession(
                                        `${classGroup.className} · ${lessonLabel}`,
                                        t.learning.allDatesInLesson,
                                        lesson.words,
                                        lesson.sentences,
                                        'preview'
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-stone-300 hover:bg-stone-50"
                                  >
                                    <Eye size={14} /> {t.learning.preview}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openSession(
                                        `${classGroup.className} · ${lessonLabel}`,
                                        t.learning.allDatesInLesson,
                                        lesson.words,
                                        lesson.sentences,
                                        'learn'
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#b91c1c] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#991b1b]"
                                  >
                                    <Play size={13} className="fill-current" /> {t.learning.learnBtn}
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs italic text-slate-400">{t.learning.noWordsYet}</span>
                              )}
                              {lesson.dates.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleLesson(classGroup.className, lesson.lessonKey)}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-white/70 hover:text-slate-700"
                                  aria-label={`Toggle ${lesson.lessonKey} dates`}
                                >
                                  <ChevronDown
                                    size={17}
                                    className={`transition-transform duration-200 ${
                                      isLessonExpanded ? 'rotate-180' : ''
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Level 3: Date Subtasks under Lesson */}
                          {isLessonExpanded && lesson.dates.length > 0 && (
                            <div className={theme.subtaskContainer}>
                              <div className={`relative space-y-2 border-l-2 pl-4 ${theme.connector}`}>
                                {lesson.dates.map((dateItem) => (
                                  <div
                                    key={`${lesson.lessonKey}-${dateItem.classId}`}
                                    className={`relative flex flex-col gap-2.5 rounded-xl border p-3 shadow-2xs transition sm:flex-row sm:items-center sm:justify-between ${theme.subtaskCard}`}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={`absolute -left-[18px] top-5 h-0.5 w-3.5 border-t-2 ${theme.connector}`}
                                    />
                                    <div
                                      onClick={() =>
                                        openSession(
                                          `${classGroup.className} · ${lessonLabel}`,
                                          formatDateLabel(dateItem.date),
                                          dateItem.words,
                                          dateItem.sentences,
                                          'learn'
                                        )
                                      }
                                      className="flex flex-1 cursor-pointer items-center gap-3 min-w-0"
                                    >
                                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white border border-stone-200 text-[#b91c1c]">
                                        <Calendar size={15} />
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900">
                                          {formatDateLabel(dateItem.date)}
                                        </p>
                                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                          <span>{dateItem.words.length} {lang === 'en' && dateItem.words.length === 1 ? t.learning.wordUnit : t.learning.wordsUnit}</span>
                                          <span>·</span>
                                          <span>{dateItem.sentences.length} {lang === 'en' && dateItem.sentences.length === 1 ? t.learning.sentenceUnit : t.learning.sentencesUnit}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openSession(
                                            `${classGroup.className} · ${lessonLabel}`,
                                            formatDateLabel(dateItem.date),
                                            dateItem.words,
                                            dateItem.sentences,
                                            'preview'
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                                      >
                                        <Eye size={13} /> {t.learning.preview}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openSession(
                                            `${classGroup.className} · ${lessonLabel}`,
                                            formatDateLabel(dateItem.date),
                                            dateItem.words,
                                            dateItem.sentences,
                                            'learn'
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg bg-[#b91c1c] px-3 py-1 text-xs font-semibold text-white hover:bg-[#991b1b]"
                                      >
                                        <Play size={12} className="fill-current" /> {t.learning.learnBtn}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 'preview' && activeSession) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={() => {
                setStep('select-date');
                setActiveSession(null);
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#b91c1c]"
            >
              <ArrowLeft size={16} /> {t.learning.backToLessons}
            </button>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">
              {activeSession.title} · {activeSession.subtitle}
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold">{t.learning.previewTitle}</h1>
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
              <Play size={15} className="fill-current" /> {t.learning.startPractice}
            </button>
          )}
        </div>

        {/* Words Preview */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <span className="grid size-6 place-items-center rounded-full bg-red-100 text-xs font-bold text-red-600">词</span>
              {t.learning.wordsHeading} ({words.length})
            </h2>
          </div>
          {words.length === 0 ? (
            <p className="text-sm text-slate-500">{t.learning.noWordsSelection}</p>
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
              {t.learning.sentencesHeading} ({sentences.length})
            </h2>
          </div>
          {sentences.length === 0 ? (
            <p className="text-sm text-slate-500">{t.learning.noSentencesSelection}</p>
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
                  setActiveSession(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]"
              >
                <ArrowLeft size={14} /> {t.learning.lessonsBtn}
              </button>
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]"
              >
                <Eye size={14} /> {t.learning.previewAll}
              </button>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">
              {activeSession?.title} {activeSession?.subtitle ? `· ${activeSession.subtitle}` : ''}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{t.learning.learnWordsTitle}</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold shrink-0">
            {currentWordIndex + 1} / {words.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-[#b91c1c]" style={{ width: `${((currentWordIndex) / words.length) * 100}%` }} />
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm text-slate-500">{t.learning.listenWord}</p>
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
              <Check size={16} className="mr-1" /> {t.learning.pronunciationPlayed}
            </div>
          )}
        </section>

        <div className="flex justify-center">
          <button
            disabled={!wordPlayed}
            onClick={() => setStep('practice-writing')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-6 py-3 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.learning.startPracticeWriting} <ChevronRight size={17} />
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">{activeSession?.title}</p>
            <h1 className="mt-1 text-2xl font-bold">{t.learning.practiceWritingTitle}</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold">
            {currentWordIndex + 1} / {words.length}
          </span>
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm text-slate-500">{t.learning.writeCharacter}</p>
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
            <p className="text-sm text-slate-500">{t.learning.currentCharacter}</p>
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
              <RotateCcw size={16} /> {t.learning.replay}
            </button>
            {!writeComplete && (
              <button
                onClick={handleReplayWord}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
              >
                <Volume2 size={16} /> {t.learning.listenAgain}
              </button>
            )}
            {isLastChar && writeComplete && (
              <button
                onClick={handleWritingComplete}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <Check size={16} /> {t.learning.continueToSpeaking}
              </button>
            )}
            {!isLastChar && writeComplete && (
              <button
                onClick={() => setCharIndex(charIndex + 1)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                {t.learning.nextCharacter} <ChevronRight size={16} />
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">{activeSession?.title}</p>
            <h1 className="mt-1 text-2xl font-bold">{t.learning.speakWordTitle}</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold">
            {currentWordIndex + 1} / {words.length}
          </span>
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm text-slate-500">{t.learning.sayWordAloud}</p>
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
                  <Check size={20} className="stroke-[3]" /> {t.learning.correctWellDone}
                </div>
                <p className="text-sm text-slate-600">
                  {t.learning.youSaid} <span className="font-semibold text-emerald-700">{speechResult || currentWord.chinese}</span>
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
                    <Mic size={15} /> {t.learning.holdPracticeAgain}
                  </button>
                  <button
                    onClick={handleNextWord}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b91c1c] px-6 py-3 text-sm font-semibold text-white hover:bg-[#991b1b] shadow-md shadow-red-200 active:scale-95 transition-all w-full sm:w-auto"
                  >
                    {isLastWord && sentences.length > 0 ? t.learning.goToSentences : isLastWord ? t.learning.completeBtn : t.learning.nextWord} <ChevronRight size={18} />
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
                    aria-label={t.learning.holdToSpeak}
                  >
                    <Mic size={40} className={speechRecognizing ? 'animate-pulse' : ''} />
                  </button>
                </div>

                {/* Instructions */}
                <div>
                  <p className="text-base font-bold text-slate-800">
                    {speechRecognizing ? t.learning.recordingHold : t.learning.holdToSpeak}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {speechRecognizing
                      ? `${t.learning.sayClearly} "${currentWord.chinese}"`
                      : t.learning.holdInstruction}
                  </p>
                </div>

                {/* Spoken result / feedback */}
                {speechResult && !speechDone && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {t.learning.youSaid} <span className="font-semibold">{speechResult}</span>
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
                    {t.learning.skipPronunciation}
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
                  setActiveSession(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]"
              >
                <ArrowLeft size={14} /> {t.learning.lessonsBtn}
              </button>
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#b91c1c]"
              >
                <Eye size={14} /> {t.learning.previewAll}
              </button>
            </div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">
              {activeSession?.title} {activeSession?.subtitle ? `· ${activeSession.subtitle}` : ''}
            </p>
            <h1 className="mt-1 text-2xl font-bold">{t.learning.sentencesHeading}</h1>
          </div>
          <span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold shrink-0">
            {currentSentenceIndex + 1} / {sentences.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-blue-600" style={{ width: `${((currentSentenceIndex) / sentences.length) * 100}%` }} />
        </div>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="text-sm text-slate-500">{t.learning.listenSentence}</p>
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
              <ChevronRight className="-rotate-180" size={17} /> {t.learning.previous}
            </button>
          )}
          <button
            onClick={() => {
              sentencePlayedRef.current = false;
              handleNextSentence();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white"
          >
            {isLastSentence ? t.learning.completeLearning : t.learning.nextSentence} <ChevronRight size={17} />
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
          <p className="mt-4 text-sm font-semibold tracking-wider text-[#b91c1c]">{t.learning.learningComplete}</p>
          <h1 className="mt-2 text-3xl font-bold">{t.learning.greatJobFinished} {activeSession?.title}</h1>
          <p className="mt-4 text-slate-600">
            {t.learning.youLearned} {words.length} {lang === 'en' && words.length === 1 ? t.learning.wordUnit : t.learning.wordsUnit} {t.learning.andWord} {sentences.length} {lang === 'en' && sentences.length === 1 ? t.learning.sentenceUnit : t.learning.sentencesUnit}.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              setStep('select-date');
              setActiveSession(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            <ArrowLeft size={17} /> {t.learning.chooseAnotherLesson}
          </button>
          <button
            onClick={() => setStep('preview')}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          >
            <Eye size={17} /> {t.learning.previewWordsSentences}
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
            <RotateCcw size={17} /> {t.learning.repeatThisDate}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
