'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Heart, Search, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type WordItem = {
  id: string;
  chinese: string;
  pinyin: string;
  khmer: string;
  english: string;
  className: string;
  hsk: string;
  favorite: boolean;
};

type WordRow = {
  id: string;
  chinese: string;
  pinyin: string | null;
  khmer: string | null;
  english: string | null;
  hsk_level: number | null;
  classes?: { name: string | null; date: string | null } | null;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWords = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('words')
        .select('id, chinese, pinyin, khmer, english, hsk_level, classes!words_class_id_fkey (name, date)')
        .order('created_at', { ascending: false });

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
            favorite: false,
          }))
      );
      setLoading(false);
    };

    loadWords();
  }, []);

  const list = useMemo(
    () =>
      words.filter((w) =>
        Object.values(w)
          .join(' ')
          .toLowerCase()
          .includes(q.toLowerCase())
      ),
    [words, q]
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

      <div className="relative">
        <Search className="absolute left-3 top-3 text-slate-400" size={19} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Chinese, Pinyin, Khmer, or English"
          className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-[#b91c1c]"
        />
      </div>

      {loading ? (
        <p className="text-slate-500">Loading words...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((w) => (
            <Link
              href={`/writing?word=${encodeURIComponent(w.id)}`}
              key={w.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex justify-between">
                <div>
                  <h2 className="text-3xl font-semibold">{w.chinese}</h2>
                  <p className="mt-1 text-red-700">{w.pinyin || 'Pinyin not added'}</p>
                </div>
                <button
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  className={w.favorite ? 'text-red-500' : 'text-slate-300'}
                  aria-label="Favorite"
                >
                  <Heart size={20} fill={w.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="mt-5 border-t border-stone-100 pt-4">
                <p className="text-lg">{w.khmer || 'Translation not added'}</p>
                <p className="mt-1 text-sm text-slate-500">{w.english || 'Translation not added'}</p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {w.className}
                  {w.hsk ? ` · ${w.hsk}` : ''}
                </span>
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
    </div>
  );
}