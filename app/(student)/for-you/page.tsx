'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Clock3, Gift, PenLine, RefreshCw, TextQuote, Volume2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Assignment = {
  id: string;
  content_type: 'word' | 'sentence';
  chinese: string;
  pinyin: string | null;
  khmer: string | null;
  english: string | null;
  expires_at: string;
};

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.75;
  window.speechSynthesis.speak(utterance);
};

export default function ForYouPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError('Please sign in again.');
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await (supabase
      .from('for_you_assignments') as any)
      .select('id, content_type, chinese, pinyin, khmer, english, expires_at')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });
    if (queryError) setError(queryError.message);
    else setItems((data || []) as Assignment[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Chosen for you</p><h1 className="mt-1 text-3xl font-bold">For You</h1><p className="mt-2 text-slate-500">Words and sentences assigned by your admin appear here for every user.</p></div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><RefreshCw size={17} /> Refresh</button>
      </div>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p className="text-slate-500">Loading your practice...</p> : items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => (
          <article key={item.id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold capitalize text-[#b91c1c]">{item.content_type === 'word' ? <BookOpen size={13} /> : <TextQuote size={13} />}{item.content_type}</span><button type="button" onClick={() => speak(item.chinese)} aria-label="Listen" className="rounded-full border border-stone-200 p-2 text-slate-600 hover:bg-stone-50"><Volume2 size={16} /></button></div>
            <h2 className={`mt-4 font-semibold text-slate-900 ${item.content_type === 'word' ? 'text-3xl' : 'text-2xl leading-relaxed'}`}>{item.chinese}</h2>
            <p className="mt-2 text-red-700">{item.pinyin || 'Pinyin not added'}</p>
            <div className="mt-4 border-t border-stone-100 pt-4"><p className="text-base">{item.khmer || 'Khmer translation not added'}</p><p className="mt-1 text-sm text-slate-500">{item.english || 'English translation not added'}</p></div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={14} /> Available until {new Date(item.expires_at).toLocaleString()}</p>
            <Link href={`/writing?assignment=${encodeURIComponent(item.id)}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white"><PenLine size={16} /> Practice writing</Link>
          </article>
        ))}</div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-12 text-center"><Gift className="mx-auto text-stone-300" size={40} /><h2 className="mt-3 text-lg font-bold">Nothing assigned right now</h2><p className="mt-1 text-sm text-slate-500">New practice from your admin will appear here.</p></div>
      )}
    </div>
  );
}
