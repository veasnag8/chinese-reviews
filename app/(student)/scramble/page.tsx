'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gamepad2,
  HelpCircle,
  Lightbulb,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

type GameSentence = {
  id: string;
  chinese_sentence: string;
  pinyin: string | null;
  khmer_translation: string | null;
  english_translation: string | null;
  class_id: string | null;
  class_name: string | null;
  audio_url: string | null;
};

type ClassOption = {
  id: string;
  name: string;
  date: string;
};

type TokenItem = {
  id: string;
  text: string;
};

type DifficultyMode = 'easy' | 'medium' | 'hard';

function tokenizeChinese(sentence: string): string[] {
  const clean = sentence.trim().replace(/[。！？!?.,;:；：、]$/, '');
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    try {
      const segmenter = new (Intl as any).Segmenter('zh-CN', { granularity: 'word' });
      const segments = Array.from(segmenter.segment(clean))
        .map((s: any) => s.segment.trim())
        .filter((s: string) => s.length > 0 && !/^[，,、；;：:。！？!?]$/.test(s));
      if (segments.length >= 2) return segments;
    } catch {
      // ignore
    }
  }

  if (clean.includes(' ')) {
    return clean.split(/\s+/).filter(Boolean);
  }

  // Fallback: chunk into 2-character pieces if long, or single chars
  if (clean.length > 4) {
    const chunks: string[] = [];
    let i = 0;
    while (i < clean.length) {
      const take = i + 2 <= clean.length ? 2 : 1;
      chunks.push(clean.slice(i, i + take));
      i += take;
    }
    return chunks;
  }

  return Array.from(clean);
}

function shuffleArray<T>(array: T[]): T[] {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const speakSentence = (text: string, audioUrl?: string | null) => {
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => speakSynthesis(text));
      return;
    } catch {
      // fallback
    }
  }
  speakSynthesis(text);
};

const speakSynthesis = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
};

export default function SentenceScramblePage() {
  const [allSentences, setAllSentences] = useState<GameSentence[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<DifficultyMode>('easy');
  const [loading, setLoading] = useState(true);

  // Game Play State
  const [gameSentences, setGameSentences] = useState<GameSentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetTokens, setTargetTokens] = useState<string[]>([]);
  const [availableTokens, setAvailableTokens] = useState<TokenItem[]>([]);
  const [placedTokens, setPlacedTokens] = useState<TokenItem[]>([]);
  const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');
  const [hintUsed, setHintUsed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Load Sentences & Classes
  useEffect(() => {
    const loadData = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const [sentencesRes, classesRes] = await Promise.all([
        supabase
          .from('sentences')
          .select('id, chinese_sentence, pinyin, khmer_translation, english_translation, class_id, audio_url, classes!sentences_class_id_fkey(name)')
          .order('created_at', { ascending: false }),
        supabase.from('classes').select('id, name, date').order('date', { ascending: false }),
      ]);

      let sentenceList: GameSentence[] = [];
      if (!sentencesRes.error && sentencesRes.data) {
        const rows = sentencesRes.data as any[];
        sentenceList = rows.map((r) => ({
          id: r.id,
          chinese_sentence: r.chinese_sentence,
          pinyin: r.pinyin,
          khmer_translation: r.khmer_translation,
          english_translation: r.english_translation,
          class_id: r.class_id,
          class_name: r.classes?.name ?? null,
          audio_url: r.audio_url ?? null,
        }));
      } else {
        // Fallback query if foreign key alias differs
        const fallback = await supabase
          .from('sentences')
          .select('id, chinese_sentence, pinyin, khmer_translation, english_translation, class_id, audio_url, classes(name)')
          .order('created_at', { ascending: false });
        if (!fallback.error && fallback.data) {
          sentenceList = (fallback.data as any[]).map((r) => ({
            id: r.id,
            chinese_sentence: r.chinese_sentence,
            pinyin: r.pinyin,
            khmer_translation: r.khmer_translation,
            english_translation: r.english_translation,
            class_id: r.class_id,
            class_name: r.classes?.name ?? null,
            audio_url: r.audio_url ?? null,
          }));
        }
      }

      setAllSentences(sentenceList);
      if (!classesRes.error && classesRes.data) {
        setClasses(classesRes.data as ClassOption[]);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  // Initialize Game Round
  const startNewGame = (classFilter = selectedClassId) => {
    let pool = allSentences;
    if (classFilter !== 'all') {
      pool = allSentences.filter((s) => s.class_id === classFilter);
    }
    // Filter sentences with at least 2 tokens
    const valid = pool.filter((s) => tokenizeChinese(s.chinese_sentence).length >= 2);
    const shuffled = shuffleArray(valid).slice(0, 10);

    setGameSentences(shuffled);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setIsCompleted(false);

    if (shuffled.length > 0) {
      setupQuestion(shuffled[0]);
    }
  };

  const setupQuestion = (sentence: GameSentence) => {
    const tokens = tokenizeChinese(sentence.chinese_sentence);
    setTargetTokens(tokens);

    const tokenItems: TokenItem[] = tokens.map((t, index) => ({
      id: `tok-${index}-${t}-${Math.random()}`,
      text: t,
    }));

    setAvailableTokens(shuffleArray(tokenItems));
    setPlacedTokens([]);
    setStatus('playing');
    setHintUsed(false);
  };

  useEffect(() => {
    if (allSentences.length > 0) {
      startNewGame(selectedClassId);
    }
  }, [allSentences, selectedClassId]);

  const currentSentence = gameSentences[currentIndex];

  // Auto-validate when all tokens are placed
  const checkAnswer = (placed: TokenItem[]) => {
    if (!currentSentence) return;
    const targetString = targetTokens.join('');
    const placedString = placed.map((p) => p.text).join('');

    if (placedString === targetString) {
      setStatus('correct');
      const points = hintUsed ? 5 : 10;
      setScore((s) => s + points);
      setStreak((st) => {
        const next = st + 1;
        if (next > maxStreak) setMaxStreak(next);
        return next;
      });
      setCorrectCount((c) => c + 1);
      speakSentence(currentSentence.chinese_sentence, currentSentence.audio_url);
    } else {
      setStatus('wrong');
      setStreak(0);
    }
  };

  const handlePlaceToken = (token: TokenItem) => {
    if (status === 'correct') return;
    const nextPlaced = [...placedTokens, token];
    const nextAvailable = availableTokens.filter((t) => t.id !== token.id);

    setPlacedTokens(nextPlaced);
    setAvailableTokens(nextAvailable);
    setStatus('playing');

    if (nextAvailable.length === 0) {
      checkAnswer(nextPlaced);
    }
  };

  const handleRemoveToken = (token: TokenItem) => {
    if (status === 'correct') return;
    const nextPlaced = placedTokens.filter((t) => t.id !== token.id);
    const nextAvailable = [...availableTokens, token];

    setPlacedTokens(nextPlaced);
    setAvailableTokens(nextAvailable);
    setStatus('playing');
  };

  const handleReset = () => {
    if (!currentSentence || status === 'correct') return;
    const tokens = targetTokens.map((t, index) => ({
      id: `tok-${index}-${t}-${Math.random()}`,
      text: t,
    }));
    setAvailableTokens(shuffleArray(tokens));
    setPlacedTokens([]);
    setStatus('playing');
  };

  const handleHint = () => {
    if (!currentSentence || status === 'correct' || availableTokens.length === 0) return;
    setHintUsed(true);

    // Find the next expected token index in placedTokens
    const expectedIndex = placedTokens.length;
    if (expectedIndex >= targetTokens.length) return;

    const expectedText = targetTokens[expectedIndex];
    // Find matching item in availableTokens
    const matchingItem = availableTokens.find((t) => t.text === expectedText);

    if (matchingItem) {
      handlePlaceToken(matchingItem);
    } else {
      // If student placed a wrong token before, reset and place correct prefix
      const correctPrefix = targetTokens.slice(0, expectedIndex + 1);
      const remaining = [...availableTokens, ...placedTokens];
      const newPlaced: TokenItem[] = [];

      correctPrefix.forEach((txt, idx) => {
        const foundIndex = remaining.findIndex((r) => r.text === txt);
        if (foundIndex !== -1) {
          newPlaced.push(remaining[foundIndex]);
          remaining.splice(foundIndex, 1);
        }
      });

      setPlacedTokens(newPlaced);
      setAvailableTokens(remaining);
      setStatus('playing');
      if (remaining.length === 0) {
        checkAnswer(newPlaced);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex + 1 < gameSentences.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setupQuestion(gameSentences[nextIdx]);
    } else {
      setIsCompleted(true);
    }
  };

  const handlePlayVoice = () => {
    if (!currentSentence) return;
    setIsPlayingAudio(true);
    speakSentence(currentSentence.chinese_sentence, currentSentence.audio_url);
    setTimeout(() => setIsPlayingAudio(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-[#b91c1c]" />
        <p className="text-sm font-medium text-slate-500">Loading Sentence Game...</p>
      </div>
    );
  }

  if (allSentences.length === 0) {
    return (
      <div className="mx-auto max-w-xl text-center py-16 space-y-4">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-red-100 text-[#b91c1c]">
          <Gamepad2 size={32} />
        </div>
        <h1 className="text-2xl font-bold">No Sentences Available</h1>
        <p className="text-sm text-slate-500">
          Please add sentences in the Sentence page first to play the Sentence Scramble Game.
        </p>
        <div className="pt-2">
          <Link href="/sentences">
            <Button className="bg-[#b91c1c] text-white hover:bg-[#991b1b]">Go to Sentences</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Completed Game Modal
  if (isCompleted) {
    const accuracy = gameSentences.length > 0 ? Math.round((correctCount / gameSentences.length) * 100) : 100;
    return (
      <div className="mx-auto max-w-lg py-12 space-y-6 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm space-y-6">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-amber-100 text-amber-600 shadow-inner">
            <Trophy size={44} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">Great Job! / អស្ចារ្យណាស់!</h1>
            <p className="mt-1 text-sm text-slate-500">You completed the Sentence Scramble challenge</p>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-2xl bg-stone-50 p-4 border border-stone-100">
            <div>
              <p className="text-2xl font-bold text-slate-900">+{score}</p>
              <p className="text-xs font-semibold text-slate-500">XP EARNED</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{accuracy}%</p>
              <p className="text-xs font-semibold text-slate-500">ACCURACY</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600 flex items-center justify-center gap-1">
                <Flame size={20} className="fill-amber-500 text-amber-500" /> {maxStreak}
              </p>
              <p className="text-xs font-semibold text-slate-500">MAX STREAK</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => startNewGame(selectedClassId)}
              className="bg-[#b91c1c] text-white hover:bg-[#991b1b] rounded-xl"
            >
              <RotateCcw size={16} /> Play Again
            </Button>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full sm:w-auto rounded-xl">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-[#b91c1c] transition-colors"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2 text-slate-900">
            <Gamepad2 className="text-[#b91c1c]" size={26} /> Sentence Scramble
          </h1>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
          >
            <option value="all">All Classes ({allSentences.length})</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-0.5 text-xs font-semibold">
            {(['easy', 'medium', 'hard'] as DifficultyMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDifficulty(mode)}
                className={`rounded-lg px-2.5 py-1 capitalize transition-all ${
                  difficulty === mode
                    ? 'bg-white text-[#b91c1c] shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress & Stats Bar */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1.5">
            <span>
              Question {currentIndex + 1} of {gameSentences.length}
            </span>
            <span>{Math.round(((currentIndex + 1) / gameSentences.length) * 100)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full bg-[#b91c1c] transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / gameSentences.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 border-l border-stone-100 pl-4">
          <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm">
            <Flame size={18} className="fill-amber-500 text-amber-500 animate-pulse" />
            <span>{streak}</span>
          </div>
          <div className="text-sm font-bold text-[#b91c1c] flex items-center gap-1">
            <Sparkles size={16} />
            <span>{score} XP</span>
          </div>
        </div>
      </div>

      {/* Sentence Target Box */}
      {currentSentence && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 sm:p-8 text-center shadow-sm space-y-6">
          {/* Audio Button */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handlePlayVoice}
              disabled={isPlayingAudio}
              className="grid size-12 place-items-center rounded-full border border-stone-200 bg-white text-slate-700 hover:bg-red-50 hover:text-[#b91c1c] hover:border-red-200 shadow-sm transition-all active:scale-95"
              title="Listen to native pronunciation"
              aria-label="Play audio"
            >
              <Volume2 size={22} className={isPlayingAudio ? 'animate-pulse text-[#b91c1c]' : ''} />
            </button>
            {currentSentence.class_name && (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {currentSentence.class_name}
              </span>
            )}
          </div>

          {/* Clues based on difficulty */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {difficulty === 'hard' ? 'Listen and Build the Sentence' : 'Translate to Chinese'}
            </p>
            {difficulty !== 'hard' && currentSentence.khmer_translation && (
              <p className="text-xl sm:text-2xl font-bold text-slate-800">
                {currentSentence.khmer_translation}
              </p>
            )}
            {difficulty !== 'hard' && !currentSentence.khmer_translation && currentSentence.english_translation && (
              <p className="text-xl font-bold text-slate-800">{currentSentence.english_translation}</p>
            )}
            {difficulty === 'easy' && currentSentence.pinyin && (
              <p className="text-sm font-medium text-slate-500 pt-1">({currentSentence.pinyin})</p>
            )}
            {difficulty === 'hard' && (
              <p className="text-sm text-slate-500 italic">Click audio above to hear the sentence</p>
            )}
          </div>

          {/* Drop Zone / Placed Words Box */}
          <div
            className={`min-h-[88px] rounded-2xl border-2 p-4 flex flex-wrap items-center justify-center gap-2.5 transition-all ${
              status === 'correct'
                ? 'border-emerald-500 bg-emerald-50/50 shadow-emerald-100'
                : status === 'wrong'
                ? 'border-red-400 bg-red-50/50'
                : 'border-dashed border-stone-300 bg-stone-50/60'
            }`}
          >
            {placedTokens.length === 0 ? (
              <p className="text-sm text-slate-400 italic select-none">
                Tap words below in the correct grammar order...
              </p>
            ) : (
              placedTokens.map((token) => (
                <button
                  key={token.id}
                  onClick={() => handleRemoveToken(token)}
                  disabled={status === 'correct'}
                  className={`px-4 py-2.5 rounded-xl font-bold text-base shadow-sm border transition-all active:scale-90 ${
                    status === 'correct'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-200'
                      : 'bg-white text-slate-900 border-stone-200 hover:bg-stone-100 hover:border-red-200 hover:text-[#b91c1c]'
                  }`}
                >
                  {token.text}
                </button>
              ))
            )}
          </div>

          {/* Feedback & Actions */}
          {status === 'correct' && (
            <div className="rounded-2xl bg-emerald-100 border border-emerald-200 p-4 text-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                <div className="text-left">
                  <p className="font-bold text-sm">Correct! / ត្រឹមត្រូវ!</p>
                  <p className="text-xs text-emerald-700">
                    {currentSentence.chinese_sentence}{' '}
                    {currentSentence.pinyin ? `(${currentSentence.pinyin})` : ''}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleNext}
                className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl px-5 py-2 shrink-0 shadow-md shadow-emerald-200 font-semibold text-sm"
              >
                {currentIndex + 1 === gameSentences.length ? 'Finish Game' : 'Next Sentence'}{' '}
                <ChevronRight size={16} />
              </Button>
            </div>
          )}

          {status === 'wrong' && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-3.5 text-red-700 flex items-center justify-between gap-2 text-xs font-semibold animate-in fade-in">
              <div className="flex items-center gap-2">
                <XCircle size={18} className="text-red-500 shrink-0" />
                <span>Not quite right. Try re-arranging the word order!</span>
              </div>
              <button
                onClick={handleReset}
                className="underline hover:text-red-900 text-xs font-bold shrink-0"
              >
                Reset
              </button>
            </div>
          )}

          {/* Word Bank Pool */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <p className="text-xs font-semibold text-slate-400">AVAILABLE WORDS</p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 min-h-[52px]">
              {availableTokens.map((token) => (
                <button
                  key={token.id}
                  onClick={() => handlePlaceToken(token)}
                  disabled={status === 'correct'}
                  className="px-4 py-2.5 rounded-xl font-bold text-base bg-stone-100 text-slate-800 border border-stone-200 hover:bg-[#b91c1c] hover:text-white hover:border-[#b91c1c] shadow-sm transition-all active:scale-90"
                >
                  {token.text}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Toolbar: Reset & Hint */}
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={placedTokens.length === 0 || status === 'correct'}
              className="rounded-xl text-xs"
            >
              <RotateCcw size={14} /> Clear / Reset
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleHint}
              disabled={status === 'correct' || availableTokens.length === 0}
              className="rounded-xl text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            >
              <Lightbulb size={14} /> Hint
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
