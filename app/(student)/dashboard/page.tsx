'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Flame, GraduationCap, Repeat2, Trophy } from 'lucide-react';
import { initialClasses, initialSentences, initialWords } from '@/lib/demo-data';
import { supabase } from '@/lib/supabase';

const stat = (label: string, value: string, icon: React.ReactNode, tone: string) => (
  <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
    <div className={`mb-4 grid size-9 place-items-center rounded-xl ${tone}`}>{icon}</div>
    <p className="text-2xl font-bold">{value}</p>
    <p className="mt-1 text-sm text-slate-500">{label}</p>
  </div>
);

function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

function formatHeadlineDate(date: Date) {
  return date
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();
}

function resolveName(
  profileName?: string | null,
  metadata?: Record<string, unknown>,
  email?: string | null
) {
  const metadataName =
    (typeof metadata?.full_name === 'string' && metadata.full_name) ||
    (typeof metadata?.name === 'string' && metadata.name) ||
    '';
  const fromEmail = email?.split('@')[0]?.replace(/[._]/g, ' ') ?? '';
  return (profileName || metadataName || fromEmail || 'there').trim();
}

export default function DashboardPage() {
  const due = initialWords.filter((x) => x.due).length + initialSentences.filter((x) => x.due).length;
  const [fullName, setFullName] = useState('');
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setFullName('');
        return;
      }

      setFullName(resolveName(null, data.user.user_metadata, data.user.email));

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.user.id)
        .maybeSingle();

      setFullName(resolveName((profile as { full_name?: string } | null)?.full_name, data.user.user_metadata, data.user.email));
    };

    loadUser();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-medium text-[#b91c1c]">
            {now ? formatHeadlineDate(now) : '\u00a0'}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {now ? greetingForHour(now.getHours()) : 'Welcome'}
            {fullName ? `, ${fullName}` : ''} 👋
          </h1>
          <p className="mt-2 text-slate-500">A calm review today makes tomorrow easier.</p>
        </div>
        <Link
          href="/words?add=1"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b91c1c] px-4 py-3 text-sm font-semibold text-white"
        >
          Add what you learned <ArrowRight size={17} />
        </Link>
      </section>
      <section className="overflow-hidden rounded-3xl bg-[#8f1717] p-6 text-white sm:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/15">
              <Repeat2 />
            </div>
            <p className="text-sm font-semibold tracking-wide text-red-100">TODAY&apos;S REVIEW</p>
            <h2 className="mt-2 text-3xl font-bold">{due} items ready</h2>
            <p className="mt-2 max-w-md text-red-100">
              Keep the words from your recent classes fresh with a short, focused session.
            </p>
          </div>
          <div className="flex flex-col justify-end gap-4">
            <div className="flex items-center gap-2 text-amber-200">
              <Flame fill="currentColor" /> <span className="font-semibold">7 day streak</span>
            </div>
            <Link
              href="/review"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-[#991b1b]"
            >
              Start review <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('Words learned', String(initialWords.length), <BookOpen size={18} />, 'bg-red-50 text-[#b91c1c]')}
        {stat('Sentences learned', String(initialSentences.length), <GraduationCap size={18} />, 'bg-blue-50 text-blue-700')}
        {stat('Mastered', '3', <Trophy size={18} />, 'bg-amber-50 text-amber-600')}
        {stat('Accuracy', '87%', <CheckCircle2 size={18} />, 'bg-emerald-50 text-emerald-600')}
      </section>
      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Recent classes</h2>
            <Link href="/classes" className="text-sm font-medium text-[#b91c1c]">
              View all
            </Link>
          </div>
          <div className="space-y-1">
            {initialClasses.map((c) => (
              <Link href="/classes" key={c.id} className="flex items-center justify-between rounded-xl p-3 hover:bg-stone-50">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <p className="text-sm text-slate-500">{c.words + c.sentences} items</p>
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-bold">This week</h2>
          <p className="mt-1 text-sm text-slate-500">Your study rhythm is building.</p>
          <div className="mt-8 flex h-28 items-end justify-between gap-2">
            {[40, 68, 45, 78, 56, 92, 64].map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div style={{ height: `${h}%` }} className={`w-full rounded-t-md ${i === 5 ? 'bg-[#b91c1c]' : 'bg-red-100'}`} />
                <span className="text-[10px] text-slate-400">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
