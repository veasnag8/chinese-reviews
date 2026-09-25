'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Search, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchFavoriteIds, toggleFavorite } from '@/lib/favorites';

type WordItem = {
  id: string;
  chinese: string;
  pinyin: string;
  khmer: string;
  english: string;
  className: string;
  hsk: string;
  favorite: boolean;
  isNew: boolean;
};

type WordRow = {
  id: string;
  chinese: string;
  pinyin: string | null;
  khmer: string | null;
  english: string | null;
  hsk_level: number | null;
  created_at?: string | null;
  classes?: { name: string | null; date: string | null } | null;
};

const isWithinLast24Hours = (createdAt?: string | null) => {
  if (!createdAt) return false;
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return false;
  const now = Date.now();
  return now - time <= 24 * 60 * 60 * 1000 && now - time >= 0;
};

const speak = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
};

export default function WordsPage() {
  const [words, setWords] = useState<WordItem[]>([]);
  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState('');
  const [pendingFavorites, setPendingFavorites] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pendingFavoriteIds = useRef(new Set<string>());
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
    const loadWords = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setFavoriteError('Please sign in to save favorites.');
        setLoading(false);
        return;
      }
      const favoriteIds = await fetchFavoriteIds(auth.user.id);
      if (favoriteIds.error) setFavoriteError(favoriteIds.error);
      else setUserId(auth.user.id);

      const { data, error } = await supabase
        .from('words')
        .select('id, chinese, pinyin, khmer, english, hsk_level, created_at, classes!words_class_id_fkey (name, date)')
        .order('created_at', { ascending: false });

      if (error) setFavoriteError(error.message);
      setWords(
        ((data || []) as unknown as WordRow[])
          .filter((word) => word.chinese)
          .map((word) => ({
            id: word.id,
            chinese: word.chinese,
            pinyin: word.pinyin || '',
            khmer: word.khmer || '',
            english: word.english || '',
            className: word.classes?.name || word.classes?.date || 'Unsorted',
            hsk:
              word.hsk_level === 0
                ? 'Foundation'
                : word.hsk_level
                  ? `HSK ${word.hsk_level}`
                  : '',
            favorite: favoriteIds.words.has(word.id),
            isNew: isWithinLast24Hours(word.created_at),
          }))
      );
      setLoading(false);
    };

    loadWords();
  }, []);

  const toggleWordFavorite = async (word: WordItem) => {
    if (!userId || pendingFavoriteIds.current.has(word.id)) return;
    pendingFavoriteIds.current.add(word.id);
    setPendingFavorites(new Set(pendingFavoriteIds.current));
    setFavoriteError('');
    try {
      const result = await toggleFavorite(userId, 'word', word.id, word.favorite);
      if (result.error) setFavoriteError(result.error);
      else setWords((current) => current.map((item) => item.id === word.id ? { ...item, favorite: !word.favorite } : item));
    } catch {
      setFavoriteError('Unable to update favorites. Please try again.');
    } finally {
      pendingFavoriteIds.current.delete(word.id);
      setPendingFavorites(new Set(pendingFavoriteIds.current));
    }
  };

  const classesList = useMemo(
    () =>
      Array.from(
        new Set(words.map((w) => w.className).filter(Boolean))
      ).sort(),
    [words]
  );

  const filteredWords = useMemo(
    () =>
      words
        .filter((w) => {
          const matchesSearch = Object.values(w)
            .join(' ')
            .toLowerCase()
            .includes(q.toLowerCase());
          const matchesClass =
            classFilter === 'all' || w.className === classFilter;
          return matchesSearch && matchesClass;
        })
        .sort((a, b) => a.className.localeCompare(b.className)),
    [words, q, classFilter]
  );

  const totalPages = Math.ceil(filteredWords.length / ITEMS_PER_PAGE);
  const list = useMemo(
    () => filteredWords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredWords, currentPage]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#b91c1c]">YOUR VOCABULARY</p>
          <h1 className="mt-1 text-3xl font-bold">My words</h1>
          <p className="mt-2 text-slate-500">ចុចលើពាក្យ ដើម្បីចូលទៅហាត់សរសេរអក្សរ។</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={19} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Chinese, Pinyin, Khmer, or English"
            className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-[#b91c1c]"
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-3 pr-10 outline-none focus:ring-2 focus:ring-[#b91c1c] appearance-none"
          >
            <option value="all">All Classes</option>
            {classesList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {favoriteError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{favoriteError}</p>}

      {loading ? (
        <p className="text-slate-500">Loading words...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((w) => (
<Link
                href={`/writing?word=${encodeURIComponent(w.id)}&single=1`}
                key={w.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
              >
              <div className="flex justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-3xl font-semibold">{w.chinese}</h2>
                    {w.isNew && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#b91c1c] border border-red-200 animate-pulse">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-red-700">{w.pinyin || 'Pinyin not added'}</p>
                </div>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void toggleWordFavorite(w);
                  }}
                  type="button"
                  disabled={!userId || pendingFavorites.has(w.id)}
                  className={`${w.favorite ? 'text-red-500' : 'text-slate-400'} disabled:opacity-50`}
                  aria-pressed={w.favorite}
                  aria-label={`${w.favorite ? 'Remove' : 'Save'} ${w.chinese} ${w.favorite ? 'from' : 'to'} favorites`}
                >
                  <Heart size={20} fill={w.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-lg">{w.khmer || 'Translation not added'}</p>
                <p className="mt-1 text-sm text-slate-500">{w.english || 'Translation not added'}</p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{w.className}</span>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    speak(w.chinese);
                  }}
                  aria-label={`Play ${w.chinese} pronunciation`}
                  className="rounded-lg bg-stone-100 p-2 text-slate-600 hover:bg-red-50 hover:text-[#b91c1c]"
                >
                  <Volume2 size={16} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-slate-500">
          No words found. Try another search.
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-50"
          >
            Previous
          </button>
          <span className="text-sm font-medium text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}