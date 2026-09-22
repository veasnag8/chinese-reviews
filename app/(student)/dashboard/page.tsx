'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Flame, Gamepad2, GraduationCap, Repeat2, Trophy } from 'lucide-react';
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

interface DashboardStats {
  wordsCount: number;
  sentencesCount: number;
  masteredCount: number;
  accuracy: number;
  dueCount: number;
  recentClasses: Array<{
    id: string;
    name: string;
    date: string;
    teacher: string | null;
    words: number;
    sentences: number;
  }>;
}

export default function DashboardPage() {
  const [fullName, setFullName] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const [reviewCompletedToday, setReviewCompletedToday] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    wordsCount: 0,
    sentencesCount: 0,
    masteredCount: 0,
    accuracy: 0,
    dueCount: 0,
    recentClasses: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setFullName('');
        setLoading(false);
        return;
      }

      setFullName(resolveName(null, data.user.user_metadata, data.user.email));

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.user.id)
        .maybeSingle();

      setFullName(resolveName((profile as { full_name?: string } | null)?.full_name, data.user.user_metadata, data.user.email));
      await loadStats(data.user.id);
    };

    const loadStats = async (userId: string) => {
      try {
        const today = new Date();
        const localDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const utcDateStr = today.toISOString().split('T')[0];
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        let isCompleted = false;
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem(`daily_review_completed_${userId}`) || localStorage.getItem('daily_review_completed_date');
          if (stored === localDateStr || stored === utcDateStr) {
            isCompleted = true;
          }
        }

        const [wordsRes, sentencesRes, reviewItemsRes, reviewHistoryRes, classesRes, { data: hasCompletedRpc }, { data: completionData }, { data: sessionData }] = await Promise.all([
          supabase.from('words').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('sentences').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('review_items').select('id, correct_count, review_count, difficulty').eq('user_id', userId),
          supabase.from('review_history').select('correct').eq('user_id', userId),
          supabase
            .from('classes')
            .select('id, name, date, teacher, lesson_number')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(5),
          Promise.resolve(supabase.rpc('has_completed_daily_review')).catch(() => ({ data: false, error: null })),
          Promise.resolve(
            supabase
              .from('daily_review_completions')
              .select('id')
              .eq('user_id', userId)
              .in('review_date', [localDateStr, utcDateStr])
              .maybeSingle()
          ).catch(() => ({ data: null, error: null })),
          Promise.resolve(
            supabase
              .from('study_sessions')
              .select('id')
              .eq('user_id', userId)
              .gte('completed_at', startOfDay.toISOString())
              .limit(1)
              .maybeSingle()
          ).catch(() => ({ data: null, error: null })),
        ]);

        if (!isCompleted) {
          isCompleted = hasCompletedRpc === true || Boolean(completionData) || Boolean(sessionData);
          if (isCompleted && typeof window !== 'undefined') {
            localStorage.setItem(`daily_review_completed_${userId}`, localDateStr);
          }
        }
        setReviewCompletedToday(isCompleted);

        const wordsCount = wordsRes.count || 0;
        const sentencesCount = sentencesRes.count || 0;

        const reviewItems = reviewItemsRes.data || [];
        const masteredCount = reviewItems.filter((item) => item.difficulty === 'easy' && item.review_count >= 3).length;

        const reviewHistory = reviewHistoryRes.data || [];
        const totalReviews = reviewHistory.length;
        const correctReviews = reviewHistory.filter((h) => h.correct).length;
        const accuracy = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0;

        const dueCount = reviewItems.filter((item) => new Date(item.due_date) <= new Date()).length;

        const classes = classesRes.data || [];
        const classesWithCounts = await Promise.all(
          classes.map(async (c) => {
            const [wordsCnt, sentencesCnt] = await Promise.all([
              supabase.from('words').select('id', { count: 'exact', head: true }).eq('class_id', c.id).eq('user_id', userId),
              supabase.from('sentences').select('id', { count: 'exact', head: true }).eq('class_id', c.id).eq('user_id', userId),
            ]);
            return {
              id: c.id,
              name: c.name,
              date: c.date,
              teacher: c.teacher,
              words: wordsCnt.count || 0,
              sentences: sentencesCnt.count || 0,
            };
          })
        );

        setStats({
          wordsCount,
          sentencesCount,
          masteredCount,
          accuracy,
          dueCount,
          recentClasses: classesWithCounts,
        });
      } catch {
        // Silently handle errors, keep defaults
      } finally {
        setLoading(false);
      }
    };

    loadUser();
    const handleReviewCompleted = () => {
      void loadUser();
    };
    window.addEventListener('review-completed', handleReviewCompleted);

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      window.removeEventListener('review-completed', handleReviewCompleted);
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="space-y-7">Loading...</div>;
  }

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
      <section className={`overflow-hidden rounded-3xl p-6 text-white sm:p-8 ${reviewCompletedToday ? 'bg-gradient-to-br from-emerald-800 to-teal-900' : 'bg-[#8f1717]'}`}>
        <div className="grid gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-white/15">
              {reviewCompletedToday ? <CheckCircle2 /> : <Repeat2 />}
            </div>
            <p className="text-sm font-semibold tracking-wide text-white/80">
              {reviewCompletedToday ? 'TODAY ALREADY REVIEWED' : "TODAY'S REVIEW"}
            </p>
            <h2 className="mt-2 text-3xl font-bold">
              {reviewCompletedToday ? 'Review Completed Today' : `${stats.dueCount} items ready`}
            </h2>
            <p className="mt-2 max-w-md text-white/80">
              {reviewCompletedToday
                ? "You've already completed your daily review session for today. Great job keeping your streak alive! Can review tomorrow."
                : 'Keep the words from your recent classes fresh with a short, focused session.'}
            </p>
          </div>
          <div className="flex flex-col justify-end gap-4">
            <div className="flex items-center gap-2 text-amber-200">
              <Flame fill="currentColor" /> <span className="font-semibold">7 day streak</span>
            </div>
            <Link
              href="/review"
              className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold ${reviewCompletedToday ? 'text-emerald-800' : 'text-[#991b1b]'}`}
            >
              {reviewCompletedToday ? 'View Review Words' : 'Start review'} <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat('Words learned', String(stats.wordsCount), <BookOpen size={18} />, 'bg-red-50 text-[#b91c1c]')}
        {stat('Sentences learned', String(stats.sentencesCount), <GraduationCap size={18} />, 'bg-blue-50 text-blue-700')}
        {stat('Mastered', String(stats.masteredCount), <Trophy size={18} />, 'bg-amber-50 text-amber-600')}
        {stat('Accuracy', `${stats.accuracy}%`, <CheckCircle2 size={18} />, 'bg-emerald-50 text-emerald-600')}
      </section>

      {/* Sentence Scramble Game Banner */}
      <section className="rounded-3xl border border-stone-200 bg-gradient-to-r from-stone-900 via-stone-800 to-red-950 p-6 sm:p-7 text-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-white/10 text-amber-400 shrink-0">
            <Gamepad2 size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Sentence Scramble Game</h2>
              <span className="rounded-full bg-red-500/30 text-red-300 border border-red-400/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Grammar Practice
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-300 max-w-md">
              Master Chinese word order (S-T-P-V-O) and grammar through interactive drag-and-drop sentence building.
            </p>
          </div>
        </div>
        <Link
          href="/scramble"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-xs font-bold text-stone-950 hover:bg-stone-100 shadow-md transition-all active:scale-95 shrink-0 w-full sm:w-auto"
        >
          Play Game <ArrowRight size={15} />
        </Link>
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
            {stats.recentClasses.length > 0 ? (
              stats.recentClasses.map((c) => (
                <Link href="/classes" key={c.id} className="flex items-center justify-between rounded-xl p-3 hover:bg-stone-50">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">{c.words + c.sentences} items</p>
                </Link>
              ))
            ) : (
              <p className="p-4 text-center text-slate-500">No classes yet. Add words to create your first class.</p>
            )}
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