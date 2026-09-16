'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Heart, Plus, Search, Volume2, X } from 'lucide-react';
import { initialWords, type StudyWord } from '@/lib/demo-data';

const STORAGE_KEY = 'my-words';

const speak = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
};

export default function WordsPage() {
  const [words, setWords] = useState<StudyWord[]>(initialWords);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ chinese: '', pinyin: '', khmer: '', english: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setWords(JSON.parse(saved));
      }
    } catch {
      setWords(initialWords);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    }
  }, [words]);

  const list = useMemo(
    () =>
      words.filter((w) =>
        Object.values(w).join(' ').toLowerCase().includes(q.toLowerCase())
      ),
    [words, q]
  );

  const add = () => {
    if (!form.chinese.trim()) return;

    const nextWord: StudyWord = {
      id: crypto.randomUUID(),
      chinese: form.chinese.trim(),
      pinyin: form.pinyin.trim() || '—',
      khmer: form.khmer.trim() || '—',
      english: form.english.trim() || 'New word',
      className: 'Unsorted',
      hsk: '—',
      due: true,
      favorite: false,
    };

    setWords((prev) => [nextWord, ...prev]);
    setForm({ chinese: '', pinyin: '', khmer: '', english: '' });
    setAdding(false);
  };return <div className="space-y-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-[#b91c1c]">YOUR VOCABULARY</p><h1 className="mt-1 text-3xl font-bold">My words</h1><p className="mt-2 text-slate-500">ចុចលើពាក្យ ដើម្បីចូលទៅហាត់សរសេរអក្សរ។</p></div><button onClick={()=>setAdding(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-4 py-3 text-sm font-semibold text-white"><Plus size={18}/> Add word</button></div><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search Chinese, Pinyin, Khmer, or English" className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-[#b91c1c]"/></div>{adding&&<div className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Add a new word</h2><button onClick={()=>setAdding(false)}><X size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2">{[['chinese','Chinese *'],['pinyin','Pinyin'],['khmer','Khmer'],['english','English']].map(([key,label])=><label key={key} className="text-sm font-medium">{label}<input value={form[key as keyof typeof form]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal outline-none focus:border-[#b91c1c]"/></label>)}</div><div className="mt-4 flex gap-2"><button onClick={add} className="rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white">Save word</button><button onClick={()=>setAdding(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium">Cancel</button></div></div>}<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map(w=><Link href={`/writing?word=${encodeURIComponent(w.id)}`} key={w.id} className="rounded-2xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"><div className="flex justify-between"><div><h2 className="text-3xl font-semibold">{w.chinese}</h2><p className="mt-1 text-red-700">{w.pinyin||'Pinyin not added'}</p></div><button onClick={event=>{event.preventDefault();event.stopPropagation()}} className={w.favorite?'text-red-500':'text-slate-300'} aria-label="Favorite"><Heart size={20} fill={w.favorite?'currentColor':'none'}/></button></div><div className="mt-5 border-t border-stone-100 pt-4"><p className="text-lg">{w.khmer||'Translation not added'}</p><p className="mt-1 text-sm text-slate-500">{w.english||'Translation not added'}</p></div><div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{w.className} · {w.hsk}</span><button onClick={event=>{event.preventDefault();event.stopPropagation();speak(w.chinese)}} aria-label={`Play ${w.chinese} pronunciation`} className="rounded-lg bg-stone-100 p-2 text-slate-600 hover:bg-red-50 hover:text-[#b91c1c]"><Volume2 size={16}/></button></div></Link>)}</div>{list.length===0&&<div className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-slate-500">No words found. Try another search or add a word.</div>}</div>}
