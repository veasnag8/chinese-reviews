'use client';

import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import HanziWriter from 'hanzi-writer';
import { Check, ChevronRight, ChevronDown, Eye, EyeOff, RotateCcw, Search, Volume2, X, ArrowLeft } from 'lucide-react';
import { initialWords, type StudyWord } from '@/lib/demo-data';
import { supabase } from '@/lib/supabase';

const speak = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.75;
  window.speechSynthesis.speak(utterance);
};

function WritingPage() {
  const searchParams = useSearchParams();
  const wordParam = searchParams.get('word');
  const singleMode = searchParams.get('single') === '1';
  const writerElementRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [words, setWords] = useState<StudyWord[]>(initialWords);
  const [wordIndex, setWordIndex] = useState(() =>
    Math.max(0, initialWords.findIndex((word) => word.id === searchParams.get('word')))
  );
  const [showGuide, setShowGuide] = useState(true);
  const [strokeCount, setStrokeCount] = useState(0);
  const [totalStrokes, setTotalStrokes] = useState(0);
  const [strokePaths, setStrokePaths] = useState<string[]>([]);
  const [boardSize, setBoardSize] = useState(0);
  const [showCorrectPopup, setShowCorrectPopup] = useState(false);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [complete, setComplete] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<StudyWord[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [charIndex, setCharIndex] = useState(0);

  const word = words[wordIndex] ?? words[0] ?? initialWords[0];
  const characters = [...word.chinese];
  const character = characters[charIndex];
  const isSingleMode = singleMode && wordParam;
  const isLastChar = charIndex === characters.length - 1;

  useEffect(() => {
    const loadWords = async () => {
      if (!supabase) return;

      const { data } = await supabase
        .from('words')
        .select('id, chinese, pinyin, khmer, english, hsk_level, classes!words_class_id_fkey (name, date)')
        .order('created_at', { ascending: false });

      const mapped = ((data || []) as any[])
        .filter((item) => item.chinese)
        .map((item) => ({
          id: item.id,
          chinese: item.chinese,
          pinyin: item.pinyin || '—',
          khmer: item.khmer || '—',
          english: item.english || '—',
          className: item.classes?.name || item.classes?.date || '',
          hsk:
            item.hsk_level === 0
              ? 'Foundation'
              : item.hsk_level
                ? `HSK ${item.hsk_level}`
                : '',
        }));

      if (mapped.length === 0) return;

      setWords(mapped);
      const requested = wordParam;
      const index = requested ? mapped.findIndex((item) => item.id === requested) : 0;
      setWordIndex(index >= 0 ? index : 0);
      setCharIndex(0);
    };

    loadWords();
  }, [wordParam]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    if (!supabase) return;
    setSearching(true);

    try {
      const { data } = await supabase
        .from('words')
        .select('id, chinese, pinyin, khmer, english, hsk_level, classes!words_class_id_fkey (name, date)')
        .or(`chinese.ilike.%${query}%,pinyin.ilike.%${query}%,khmer.ilike.%${query}%,english.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      const mapped = ((data || []) as any[])
        .filter((item) => item.chinese)
        .map((item) => ({
          id: item.id,
          chinese: item.chinese,
          pinyin: item.pinyin || '—',
          khmer: item.khmer || '—',
          english: item.english || '—',
          className: item.classes?.name || item.classes?.date || '',
          hsk:
            item.hsk_level === 0
              ? 'Foundation'
              : item.hsk_level
                ? `HSK ${item.hsk_level}`
                : '',
        }));

      setSearchResults(mapped);
      setShowSearchResults(mapped.length > 0);
    } catch {
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearching(false);
    }
  };

  const selectWord = (selectedWord: StudyWord) => {
    if (isSingleMode) return;
    const index = words.findIndex((w) => w.id === selectedWord.id);
    if (index >= 0) {
      setWordIndex(index);
    } else {
      setWords((current) => [selectedWord, ...current]);
      setWordIndex(0);
    }
    setCharIndex(0);
    setSearchQuery('');
    setShowSearchResults(false);
    searchInputRef.current?.blur();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const element = writerElementRef.current;
    if (!element) return;

    element.replaceChildren();
    setStrokeCount(0);
    setTotalStrokes(0);
    setStrokePaths([]);
    setComplete(false);
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
      onComplete: () => nextChar(),
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
  }, [character, charIndex]);

  useEffect(() => {
    const writer = writerRef.current;
    if (!writer) return;

    if (showGuide) {
      writer.showCharacter({ duration: 180 });
      writer.showOutline({ duration: 180 });
    } else {
      writer.hideCharacter({ duration: 180 });
      writer.hideOutline({ duration: 180 });
    }
  }, [showGuide]);

  const replay = () => {
    const writer = writerRef.current;
    if (!writer) return;
    writer.cancelQuiz();
    writer.animateCharacter().then(() => writer.quiz());
    setStrokeCount(0);
    setTotalStrokes(0);
    setStrokePaths([]);
    setComplete(false);
    setShowCorrectPopup(false);
    HanziWriter.loadCharacterData(character).then((data) => {
      if (data) {
        setStrokePaths(data.strokes);
        setTotalStrokes(data.strokes.length);
      }
    });
  };

  const nextChar = () => {
    if (isLastChar) {
      setComplete(true);
    } else {
      setCharIndex(charIndex + 1);
      setStrokeCount(0);
      setTotalStrokes(0);
      setStrokePaths([]);
      setComplete(false);
      setShowCorrectPopup(false);
    }
  };

  const next = () => setWordIndex((index) => (index + 1) % words.length);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600">Stroke order practice</p>
          <h1 className="mt-2 text-[2.1rem] font-black tracking-[-0.04em] text-slate-900">Trace & Practice</h1>
          {isSingleMode && (
            <p className="mt-1 text-sm text-sky-600 flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">Single Word Mode</span>
              <span>Practicing only this word from My Words</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => speak(word.chinese)}
          className="grid size-10 place-items-center rounded-full border border-sky-200 bg-white text-sky-700 shadow-sm"
          aria-label="Listen to pronunciation"
        >
          <Volume2 size={18} />
        </button>
      </div>

      {/* Search bar - hidden in single mode */}
      {!isSingleMode && (
        <div className="mt-4 relative" ref={searchInputRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              onFocus={() => setShowSearchResults(searchResults.length > 0)}
              placeholder="Search word by Chinese, Pinyin, Khmer, or English..."
              className="w-full rounded-xl border border-sky-200 bg-white py-3 pl-10 pr-10 outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                aria-label="Clear search"
              >
                <X size={17} />
              </button>
            )}
          </div>
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-sky-200 bg-white shadow-lg z-20 max-h-60 overflow-y-auto">
              {searching && (
                <div className="p-3 text-center text-sky-600">Searching...</div>
              )}
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => selectWord(result)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-sky-50 transition"
                >
                  <span className="text-2xl font-bold">{result.chinese}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{result.pinyin}</p>
                    <p className="text-xs text-slate-500 truncate">{result.khmer} · {result.english}</p>
                  </div>
                  {result.hsk && <span className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-700">{result.hsk}</span>}
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              ))}
              {searchResults.length === 0 && !searching && (
                <div className="p-3 text-center text-slate-500">No words found</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">
          Character {charIndex + 1} of {characters.length} &nbsp;|&nbsp;
          Stroke {complete ? totalStrokes : Math.min(strokeCount + 1, totalStrokes || 1)} / {totalStrokes || '...'}
        </span>
        <span className="text-slate-500">{complete ? 'Character complete' : 'Trace the highlighted stroke'}</span>
      </div>

      {/* Character progress indicators */}
      <div className="mt-3 flex items-center justify-center gap-2">
        {characters.map((c, idx) => (
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

      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {Array.from({ length: totalStrokes || strokePaths.length || 1 }, (_, index) => index + 1).map((step) => {
          const done = step <= strokeCount;
          const active = step === strokeCount + 1 && !complete;
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

      {/* Current character display */}
      <div className="mt-4 text-center">
        <p className="text-sm text-slate-500">Current character:</p>
        <p className="mt-1 text-5xl font-bold text-[#b91c1c] tracking-wide">{character}</p>
        <p className="text-sm text-slate-500">{word.pinyin}</p>
      </div>

      <div className="mt-6 rounded-[20px] border border-sky-200 bg-[#f5f9fc] p-3 shadow-[0_12px_32px_rgba(75,132,171,0.08)]">
        <div className="relative mx-auto aspect-square w-full max-w-[760px] overflow-hidden rounded-[14px] border-2 border-sky-100 bg-[#61b4e7] shadow-inner touch-none select-none">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_49.8%,rgba(225,246,255,0.48)_50%,transparent_50.2%),linear-gradient(0deg,transparent_49.8%,rgba(225,246,255,0.48)_50%,transparent_50.2%),linear-gradient(45deg,transparent_49.8%,rgba(225,246,255,0.3)_50%,transparent_50.2%),linear-gradient(-45deg,transparent_49.8%,rgba(225,246,255,0.3)_50%,transparent_50.2%)]" />
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
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={replay}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          <RotateCcw size={16} /> Replay
        </button>
        <button
          type="button"
          onClick={() => setShowGuide((visible) => !visible)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          {showGuide ? <EyeOff size={16} /> : <Eye size={16} />}
          {showGuide ? 'Hide guide' : 'Show guide'}
        </button>
        {isSingleMode && (
          <a
            href="/words"
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-stone-50"
          >
            <ArrowLeft size={16} /> Back to My Words
          </a>
        )}
        {!isSingleMode && (
          <>
            {!isLastChar && complete && (
              <button
                type="button"
                onClick={nextChar}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                Next Character <ChevronRight size={16} />
              </button>
            )}
            {isLastChar && complete && (
              <button
                type="button"
                onClick={next}
                className="ml-auto inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
              >
                Next Word <ChevronRight size={16} />
              </button>
            )}
          </>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">{word.chinese}</p>
          <p className="mt-1 text-sm text-slate-600">{word.pinyin} · {word.khmer} · {word.english}</p>
          {characters.length > 1 && (
            <p className="mt-1 text-xs text-sky-600">Practicing: <span className="font-bold text-[#b91c1c]">{character}</span> (character {charIndex + 1} of {characters.length})</p>
          )}
        </div>
        <span className="text-sm font-semibold text-sky-700">{complete ? 'Great work!' : 'Keep tracing'}</span>
      </div>
    </div>
  );
}

export default function WritingPageWrapper() {
  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Loading practice board...</p>}>
      <WritingPage />
    </Suspense>
  );
}