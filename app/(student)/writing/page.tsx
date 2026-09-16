'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import HanziWriter from 'hanzi-writer';
import { Check, ChevronRight, Eye, EyeOff, Play, RotateCcw, Volume2 } from 'lucide-react';
import { initialWords } from '@/lib/demo-data';

const speak = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.75;
  window.speechSynthesis.speak(utterance);
};

export default function WritingPage() {
  const searchParams = useSearchParams();
  const writerElementRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<HanziWriter | null>(null);
  const [wordIndex, setWordIndex] = useState(() =>
    Math.max(0, initialWords.findIndex((word) => word.id === searchParams.get('word')))
  );
  const [showGuide, setShowGuide] = useState(true);
  const [strokeCount, setStrokeCount] = useState(0);
  const [totalStrokes, setTotalStrokes] = useState(0);
  const [strokePaths, setStrokePaths] = useState<string[]>([]);
  const [boardSize, setBoardSize] = useState(0);
  const [showCorrectPopup, setShowCorrectPopup] = useState(false);
  const [playingOrder, setPlayingOrder] = useState(false);
  const [playingStroke, setPlayingStroke] = useState(0);
  const popupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [complete, setComplete] = useState(false);

  const word = initialWords[wordIndex];
  const character = [...word.chinese][0];

  useEffect(() => {
    const element = writerElementRef.current;
    if (!element) return;

    element.replaceChildren();
    setStrokeCount(0);
    setTotalStrokes(0);
    setStrokePaths([]);
    setComplete(false);
    setShowCorrectPopup(false);
    setPlayingOrder(false);
    setPlayingStroke(0);

    let cancelled = false;
    HanziWriter.loadCharacterData(character).then((data) => {
      if (!cancelled && data) {
        setStrokePaths(data.strokes);
        setTotalStrokes(data.strokes.length);
      }
    });

    const writer = HanziWriter.create(element, character, {
      width: '100%',
      height: '100%',
      padding: 22,
      showOutline: true,
      showCharacter: true,
      strokeColor: '#ff9bb5',
      outlineColor: '#eaf7ff',
      highlightColor: '#ff6f91',
      drawingColor: 'rgba(0,0,0,0)',
      drawingWidth: 6,
      drawingFadeDuration: 0,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 220,
      showHintAfterMisses: 2,
      highlightOnComplete: false,
      onCorrectStroke: (strokeData) => {
        setStrokeCount(strokeData.strokeNum + 1);
        setTotalStrokes(strokeData.strokeNum + strokeData.strokesRemaining + 1);
        setShowCorrectPopup(true);
        if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
        popupTimerRef.current = setTimeout(() => setShowCorrectPopup(false), 1000);
      },
      onComplete: () => setComplete(true),
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
  }, [character]);

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
    setComplete(false);
    setShowCorrectPopup(false);
    setPlayingOrder(false);
    setPlayingStroke(0);
  };

  const playOrder = async () => {
    const writer = writerRef.current;
    if (!writer || strokePaths.length === 0 || playingOrder) return;

    setPlayingOrder(true);
    setComplete(false);
    setStrokeCount(0);
    writer.cancelQuiz();

    for (let index = 0; index < strokePaths.length; index += 1) {
      setPlayingStroke(index + 1);
      await writer.animateStroke(index);
    }

    setPlayingStroke(0);
    setPlayingOrder(false);
    writer.quiz();
  };

  const next = () => setWordIndex((index) => (index + 1) % initialWords.length);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-600">Stroke order practice</p>
          <h1 className="mt-2 text-[2.1rem] font-black tracking-[-0.04em] text-slate-900">Trace &amp; Practice</h1>
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

      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">
          Stroke {complete ? totalStrokes : Math.min(strokeCount + 1, totalStrokes || 1)} / {totalStrokes || '...'}
        </span>
        <span className="text-slate-500">{complete ? 'Character complete' : 'Trace the highlighted stroke'}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: totalStrokes || strokePaths.length || 1 }, (_, index) => index + 1).map((step) => {
          const done = step <= strokeCount;
          const active = playingOrder ? step === playingStroke : step === strokeCount + 1 && !complete;
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

      <div className="mt-6 rounded-[20px] border border-sky-200 bg-[#f5f9fc] p-3 shadow-[0_12px_32px_rgba(75,132,171,0.08)]">
        <div className="relative mx-auto aspect-square w-full max-w-[760px] overflow-hidden rounded-[14px] border-2 border-sky-100 bg-[#61b4e7] shadow-inner">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_49.8%,rgba(225,246,255,0.48)_50%,transparent_50.2%),linear-gradient(0deg,transparent_49.8%,rgba(225,246,255,0.48)_50%,transparent_50.2%),linear-gradient(45deg,transparent_49.8%,rgba(225,246,255,0.3)_50%,transparent_50.2%),linear-gradient(-45deg,transparent_49.8%,rgba(225,246,255,0.3)_50%,transparent_50.2%)]" />
          <div
            ref={writerElementRef}
            className="absolute inset-0 cursor-crosshair"
            aria-label={`Stroke order practice for ${character}`}
          />
          {boardSize > 0 && (
            <svg
              viewBox={`0 0 ${boardSize} ${boardSize}`}
              className="pointer-events-none absolute inset-0 z-10 h-full w-full"
              aria-hidden="true"
            >
              <g
                transform={`translate(22 ${boardSize - (22 + 124 * ((boardSize - 44) / 1024))}) scale(${(boardSize - 44) / 1024} ${-((boardSize - 44) / 1024)})`}
              >
                {strokePaths.slice(0, strokeCount).map((path, index) => (
                  <path key={`${index}-${path}`} d={path} fill="#000000" />
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
          onClick={playOrder}
          disabled={playingOrder || strokePaths.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-sky-700 bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-[0_4px_12px_rgba(2,132,199,0.3)] transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
        >
          <Play size={16} /> {playingOrder ? `Stroke ${playingStroke}` : 'Play order'}
        </button>
        <button
          type="button"
          onClick={() => setShowGuide((visible) => !visible)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
        >
          {showGuide ? <EyeOff size={16} /> : <Eye size={16} />}
          {showGuide ? 'Hide guide' : 'Show guide'}
        </button>
        {complete && (
          <button
            type="button"
            onClick={next}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">{word.chinese}</p>
          <p className="mt-1 text-sm text-slate-600">{word.pinyin} · {word.khmer} · {word.english}</p>
        </div>
        <span className="text-sm font-semibold text-sky-700">{complete ? 'Great work!' : 'Keep tracing'}</span>
      </div>
    </div>
  );
}
