'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BookOpen, Brain, CalendarDays, ChartNoAxesColumnIncreasing, ChevronDown, ClipboardList, Gamepad2, GraduationCap, Heart, House, List, ListChecks, LogOut, Menu, MessageCircle, NotebookPen, PenLine, Settings, ShieldCheck, TextQuote, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: House, admin: false },
  { href: '/learning', label: 'Learn', icon: Brain, admin: false },
  { href: '/daily', label: 'Daily', icon: CalendarDays, admin: false },
  { href: '/words', label: 'My Words', icon: BookOpen, admin: false },
  { href: '/for-you', label: 'Homework', icon: NotebookPen, admin: false },
  { href: '/sentences', label: 'Sentence', icon: TextQuote, admin: false },
  { href: '/conversations', label: 'Conversation', icon: MessageCircle, admin: false },
  { href: '/scramble', label: 'Sentence Game', icon: Gamepad2, admin: false },
  { href: '/classes', label: 'My Classes', icon: CalendarDays, admin: false },
  { href: '/quizzes', label: 'Quiz', icon: ListChecks, admin: false },
  { href: '/review', label: 'Review', icon: GraduationCap, admin: false },
  { href: '/writing', label: 'Practice Writing', icon: PenLine, admin: false },
  { href: '/favorites', label: 'Favorites', icon: Heart, admin: false },
  { href: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing, admin: false },
  { href: '/admin/users', label: 'User List', icon: Users, admin: true },
  { href: '/settings', label: 'Settings', icon: Settings, admin: false },
];

const managementItems = [
  { href: '/admin/for-you', label: 'Create Homework', icon: NotebookPen },
  { href: '/admin/words', label: 'Word List', icon: List },
  { href: '/sentences', label: 'Add Sentence', icon: TextQuote },
  { href: '/admin/quizzes', label: 'Quiz Management', icon: ClipboardList },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isStaff, setIsStaff] = useState(false);
  const [isStaffLoaded, setIsStaffLoaded] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [quizCount, setQuizCount] = useState(0);
  const [dailyReviewCount, setDailyReviewCount] = useState(0);
  const [homeworkCount, setHomeworkCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [sentenceCount, setSentenceCount] = useState(0);
  const [conversationCount, setConversationCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(pathname.startsWith('/admin'));

  const mobileNavItems = [
    { href: '/dashboard', label: 'Dashboard', icon: House },
    { href: '/learning', label: 'Learn', icon: Brain },
    { href: '/daily', label: 'Daily', icon: CalendarDays },
    { href: '/words', label: 'My Words', icon: BookOpen },
    { href: '/sentences', label: 'Sentence', icon: TextQuote },
  ];

  const overflowItems = [
    { href: '/quizzes', label: 'Quiz', icon: ListChecks, admin: false },
    { href: '/for-you', label: 'Homework', icon: NotebookPen, admin: false },
    { href: '/conversations', label: 'Conversation', icon: MessageCircle, admin: false },
    { href: '/scramble', label: 'Sentence Game', icon: Gamepad2, admin: false },
    { href: '/review', label: 'Review', icon: GraduationCap, admin: false },
    { href: '/writing', label: 'Practice Writing', icon: PenLine, admin: false },
    { href: '/favorites', label: 'Favorites', icon: Heart, admin: false },
    { href: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing, admin: false },
    { href: '/classes', label: 'My Classes', icon: CalendarDays, admin: false },
    { href: '/settings', label: 'Settings', icon: Settings, admin: false },
    { href: '/admin/users', label: 'User List', icon: Users, admin: true },
  ];

  const notificationCount = (href: string) => {
    if (href === '/quizzes') return quizCount;
    if (href === '/review') return dailyReviewCount;
    if (href === '/for-you') return homeworkCount;
    if (href === '/words') return wordCount;
    if (href === '/sentences') return sentenceCount;
    if (href === '/conversations') return conversationCount;
    return 0;
  };

  const overflowNotificationCount = overflowItems.reduce((total, item) => total + notificationCount(item.href), 0);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    let request = 0;

    const refresh = async () => {
      const version = ++request;
      try {
        const { data: auth } = await client.auth.getUser();
        if (!active || version !== request) return;
        if (!auth.user) {
          setQuizCount(0);
          setDailyReviewCount(0);
          setHomeworkCount(0);
          setWordCount(0);
          setSentenceCount(0);
          setConversationCount(0);
          setCurrentUserId('');
          return;
        }
        setCurrentUserId(auth.user.id);
        const nowIso = new Date().toISOString();
        const wordsSeenKey = `words_seen_at_${auth.user.id}`;
        const sentencesSeenKey = `sentences_seen_at_${auth.user.id}`;
        const conversationsSeenKey = `conversations_seen_at_${auth.user.id}`;
        const wordsSeenAt = window.localStorage.getItem(wordsSeenKey) || nowIso;
        const sentencesSeenAt = window.localStorage.getItem(sentencesSeenKey) || nowIso;
        const conversationsSeenAt = window.localStorage.getItem(conversationsSeenKey) || nowIso;
        if (!window.localStorage.getItem(wordsSeenKey)) window.localStorage.setItem(wordsSeenKey, nowIso);
        if (!window.localStorage.getItem(sentencesSeenKey)) window.localStorage.setItem(sentencesSeenKey, nowIso);
        if (!window.localStorage.getItem(conversationsSeenKey)) window.localStorage.setItem(conversationsSeenKey, nowIso);
        const [quizzes, submissions, homework, homeworkSubmissions, newWords, newSentences, newConversations] = await Promise.all([
          client.from('quizzes').select('id, start_at, deadline').eq('status', 'active'),
          client.from('quiz_submissions').select('quiz_id').eq('user_id', auth.user.id).eq('status', 'submitted'),
          client.from('for_you_assignments').select('id').lte('starts_at', nowIso).gt('expires_at', nowIso),
          client.from('homework_submissions').select('assignment_id, status').eq('user_id', auth.user.id),
          client.from('words').select('id', { count: 'exact', head: true }).gt('created_at', wordsSeenAt),
          client.from('sentences').select('id', { count: 'exact', head: true }).eq('sentence_type', 'single').gt('created_at', sentencesSeenAt),
          client.from('sentences').select('id', { count: 'exact', head: true }).eq('sentence_type', 'conversation').gt('created_at', conversationsSeenAt),
        ]);
        if (!active || version !== request) return;
        if (!newWords.error) setWordCount(newWords.count || 0);
        if (!newSentences.error) setSentenceCount(newSentences.count || 0);
        if (!newConversations.error) setConversationCount(newConversations.count || 0);
        if (!homework.error && !homeworkSubmissions.error) {
          const completedHomework = new Set((homeworkSubmissions.data || []).filter((row: { status: string }) => row.status !== 'needs_revision').map((row: { assignment_id: string }) => row.assignment_id));
          setHomeworkCount((homework.data || []).filter((item: { id: string }) => !completedHomework.has(item.id)).length);
        }
        if (quizzes.error || submissions.error) return;
        const submitted = new Set((submissions.data || []).map((row: { quiz_id: string }) => row.quiz_id));
        const now = Date.now();
        setQuizCount((quizzes.data || []).filter((quiz: { id: string; start_at: string | null; deadline: string | null }) =>
          !submitted.has(quiz.id) &&
          (!quiz.start_at || new Date(quiz.start_at).getTime() <= now) &&
          (!quiz.deadline || new Date(quiz.deadline).getTime() >= now)
        ).length);

        // Check daily review completion (Monday-Friday only)
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        const isReviewDay = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday-Friday
        
        if (isReviewDay) {
          const localDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          const utcDateStr = today.toISOString().split('T')[0];
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);

          let isCompleted = false;
          if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(`daily_review_completed_${auth.user.id}`) || localStorage.getItem('daily_review_completed_date');
            if (stored === localDateStr || stored === utcDateStr) {
              isCompleted = true;
            }
          }

          if (!isCompleted) {
            try {
              const [{ data: hasCompletedRpc }, { data: reviewCompletion }, { data: sessionData }] = await Promise.all([
                Promise.resolve(client.rpc('has_completed_daily_review')).catch(() => ({ data: false, error: null })),
                Promise.resolve(
                  client
                    .from('daily_review_completions')
                    .select('id')
                    .eq('user_id', auth.user.id)
                    .in('review_date', [localDateStr, utcDateStr])
                    .maybeSingle()
                ).catch(() => ({ data: null, error: null })),
                Promise.resolve(
                  client
                    .from('study_sessions')
                    .select('id')
                    .eq('user_id', auth.user.id)
                    .gte('completed_at', startOfDay.toISOString())
                    .limit(1)
                    .maybeSingle()
                ).catch(() => ({ data: null, error: null })),
              ]);

              isCompleted = hasCompletedRpc === true || Boolean(reviewCompletion) || Boolean(sessionData);
              if (isCompleted && typeof window !== 'undefined') {
                localStorage.setItem(`daily_review_completed_${auth.user.id}`, localDateStr);
              }
            } catch {
              // Keep isCompleted
            }
          }

          setDailyReviewCount(isCompleted ? 0 : 1);
        } else {
          setDailyReviewCount(0);
        }
      } catch {
        return;
      }
    };

    void refresh();
    const quizChannel = client.channel('available-quiz-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_notifications' }, refresh)
      .subscribe();
    const reviewChannel = client.channel('daily-review-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_review_completions' }, refresh)
      .subscribe();
    const learningChannel = client.channel('learning-menu-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'words' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sentences' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'for_you_assignments' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework_submissions' }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('quizzes-changed', refresh);
    window.addEventListener('review-completed', refresh);
    const { data: listener } = client.auth.onAuthStateChange(() => {
      ++request;
      setQuizCount(0);
      setDailyReviewCount(0);
      setHomeworkCount(0);
      setWordCount(0);
      setSentenceCount(0);
      setConversationCount(0);
      window.setTimeout(() => { if (active) void refresh(); }, 0);
    });
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('quizzes-changed', refresh);
      window.removeEventListener('review-completed', refresh);
      listener.subscription.unsubscribe();
      void client.removeChannel(quizChannel);
      void client.removeChannel(reviewChannel);
      void client.removeChannel(learningChannel);
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const now = new Date().toISOString();
    if (pathname === '/words') {
      window.localStorage.setItem(`words_seen_at_${currentUserId}`, now);
      setWordCount(0);
    }
    if (pathname === '/sentences') {
      window.localStorage.setItem(`sentences_seen_at_${currentUserId}`, now);
      setSentenceCount(0);
    }
    if (pathname === '/conversations') {
      window.localStorage.setItem(`conversations_seen_at_${currentUserId}`, now);
      setConversationCount(0);
    }
  }, [currentUserId, pathname]);

  const logout = async () => {
    await supabase?.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    const resolveName = (
      profileName?: string | null,
      metadata?: Record<string, unknown>,
      email?: string | null
    ) => {
      const metadataName =
        (typeof metadata?.full_name === 'string' && metadata.full_name) ||
        (typeof metadata?.name === 'string' && metadata.name) ||
        '';
      const fromEmail = email?.split('@')[0]?.replace(/[._]/g, ' ') ?? '';
      return (profileName || metadataName || fromEmail || 'User').trim();
    };

    const loadUser = async () => {
      if (!supabase) return;

      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      setDisplayName(resolveName(null, data.user.user_metadata, data.user.email));

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', data.user.id)
        .maybeSingle();

      const profileRow = profile as { full_name?: string; role?: string } | null;
      setDisplayName(resolveName(profileRow?.full_name, data.user.user_metadata, data.user.email));
      setIsStaff(profileRow?.role === 'admin' || profileRow?.role === 'teacher');
      setIsStaffLoaded(true);
    };

    loadUser();
  }, []);

  return <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
    <aside className="fixed inset-y-0 hidden w-64 border-r border-stone-200 bg-white px-4 py-6 md:flex md:flex-col">
      <Link href="/dashboard" className="mb-9 flex shrink-0 items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#b91c1c] text-lg text-white">汉</span><span className="font-semibold tracking-wide">CHINESE REVIEW</span></Link>
      <nav className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-scroll overscroll-contain pr-2 [scrollbar-gutter:stable]">
        {navigation.map(({ href, label, icon: Icon, admin }) => { const count = notificationCount(href); return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === href || pathname.startsWith(`${href}/`) ? 'bg-red-50 text-[#b91c1c]' : 'text-slate-600 hover:bg-stone-100'} ${admin && isStaffLoaded && !isStaff ? 'hidden' : ''}`}><Icon size={18}/>{label}{count > 0 && <span className="ml-auto inline-flex min-w-5 justify-center rounded-full bg-[#b91c1c] px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-white">{count}</span>}</Link>; })}
        {isStaffLoaded && isStaff && <div className="pt-1">
          <button type="button" onClick={() => setAdminMenuOpen((open) => !open)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${managementItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ? 'bg-amber-50 text-amber-800' : 'text-slate-700 hover:bg-stone-100'}`}><ShieldCheck size={18} />Management Admin<ChevronDown size={16} className={`ml-auto transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} /></button>
          {adminMenuOpen && <div className="ml-4 mt-1 space-y-1 border-l-2 border-amber-200 pl-2">{managementItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${pathname === href || pathname.startsWith(`${href}/`) ? 'bg-amber-100 font-semibold text-amber-900' : 'text-slate-600 hover:bg-stone-100'}`}><Icon size={16} />{label}</Link>)}</div>}
        </div>}
      </nav>
    </aside>
    <main className="pb-24 md:ml-64 md:pb-8"><header className="hidden h-16 items-center justify-end border-b border-stone-200 bg-white px-5 md:flex md:px-8"><div className="flex items-center gap-3"><span className="text-sm font-medium text-slate-700">{displayName}</span><button type="button" onClick={logout} aria-label="Log out" className="rounded-lg p-2 text-slate-500 transition hover:bg-stone-100 hover:text-[#b91c1c]"><LogOut size={18}/></button></div></header><div className="mx-auto max-w-7xl p-4 sm:p-6 md:p-8">{children}</div></main>
    
    {/* Mobile bottom nav - 5 main items + menu */}
    <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between border-t border-stone-200 bg-white px-2 py-2 md:hidden">
      {mobileNavItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileMenuOpen(false)}
          className={`flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${pathname === href ? 'text-[#b91c1c]' : 'text-slate-500'}`}
        >
          <Icon size={19} />
          <span>
            {label}
            {notificationCount(href) > 0 && <span className="ml-1 rounded-full bg-[#b91c1c] px-1.5 py-0.5 text-white">{notificationCount(href)}</span>}
          </span>
        </Link>
      ))}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-500 relative"
        aria-label="More options"
      >
        <Menu size={19} />
        <span>More</span>
        {overflowNotificationCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex min-w-5 justify-center rounded-full bg-[#b91c1c] px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-white">
            {overflowNotificationCount}
          </span>
        )}
      </button>
    </nav>

    {/* Overflow menu dialog */}
    {mobileMenuOpen && (
      <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl p-4 animate-slide-up max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">More</h3>
            <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-stone-100"><X size={20} /></button>
          </div>
          <nav className="space-y-2">
            {overflowItems.map(({ href, label, icon: Icon, admin }) => (
              !admin || (isStaffLoaded && isStaff) ? (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium ${pathname === href ? 'bg-red-50 text-[#b91c1c]' : 'text-slate-700 hover:bg-stone-100'}`}
                >
                  <Icon size={20} />
                  {label}
                  {notificationCount(href) > 0 && <span className="ml-auto inline-flex min-w-5 justify-center rounded-full bg-[#b91c1c] px-2 py-1 text-xs font-semibold text-white">{notificationCount(href)}</span>}
                </Link>
              ) : null
            ))}
            {isStaffLoaded && isStaff && <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-2">
              <button type="button" onClick={() => setAdminMenuOpen((open) => !open)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold text-amber-900"><ShieldCheck size={20} />Management Admin<ChevronDown size={17} className={`ml-auto transition-transform ${adminMenuOpen ? 'rotate-180' : ''}`} /></button>
              {adminMenuOpen && <div className="space-y-1">{managementItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${pathname === href || pathname.startsWith(`${href}/`) ? 'bg-amber-200 text-amber-950' : 'text-slate-700 hover:bg-white'}`}><Icon size={18} />{label}</Link>)}</div>}
            </div>}
            <hr className="my-2 border-stone-200" />
            <button onClick={logout} className="flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-red-600 hover:bg-red-50 w-full">
              <LogOut size={20} />
              Sign out
            </button>
          </nav>
        </div>
      </div>
    )}
  </div>
}
