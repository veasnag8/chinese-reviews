'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ChartNoAxesColumnIncreasing, CircleUserRound, ClipboardList, GraduationCap, Heart, House, List, ListChecks, LogOut, PenLine, Settings, Sparkles, TextQuote } from 'lucide-react';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: House }, { href: '/words', label: 'My Words', icon: BookOpen },
  { href: '/admin/words', label: 'Words List', icon: List }, { href: '/admin/quizzes', label: 'Quiz Management', icon: ClipboardList }, { href: '/admin/users', label: 'Users List', icon: CircleUserRound },
  { href: '/sentences', label: 'Sentences', icon: TextQuote }, { href: '/daily', label: 'Daily', icon: CalendarDays }, { href: '/classes', label: 'My Classes', icon: CalendarDays },
  { href: '/quizzes', label: 'Quiz', icon: ListChecks }, { href: '/quiz', label: 'Quiz Practice', icon: GraduationCap }, { href: '/writing', label: 'Practice Writing', icon: PenLine }, { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing }, { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isStaff, setIsStaff] = useState(false);
  const [displayName, setDisplayName] = useState('User');
  const [quizCount, setQuizCount] = useState(0);

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
          return;
        }
        const [quizzes, submissions] = await Promise.all([
          client.from('quizzes').select('id, start_at, deadline').eq('status', 'active'),
          client.from('quiz_submissions').select('quiz_id').eq('user_id', auth.user.id).eq('status', 'submitted'),
        ]);
        if (!active || version !== request || quizzes.error || submissions.error) return;
        const submitted = new Set((submissions.data || []).map((row: { quiz_id: string }) => row.quiz_id));
        const now = Date.now();
        setQuizCount((quizzes.data || []).filter((quiz: { id: string; start_at: string | null; deadline: string | null }) =>
          !submitted.has(quiz.id) &&
          (!quiz.start_at || new Date(quiz.start_at).getTime() <= now) &&
          (!quiz.deadline || new Date(quiz.deadline).getTime() >= now)
        ).length);
      } catch {
        return;
      }
    };

    void refresh();
    const channel = client.channel('available-quiz-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quiz_notifications' }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('quizzes-changed', refresh);
    const { data: listener } = client.auth.onAuthStateChange(() => {
      ++request;
      setQuizCount(0);
      window.setTimeout(() => { if (active) void refresh(); }, 0);
    });
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('quizzes-changed', refresh);
      listener.subscription.unsubscribe();
      void client.removeChannel(channel);
    };
  }, [pathname]);

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
    };

    loadUser();
  }, []);

  return <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
    <aside className="fixed inset-y-0 hidden w-64 border-r border-stone-200 bg-white px-4 py-6 md:flex md:flex-col">
      <Link href="/dashboard" className="mb-9 flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#b91c1c] text-lg text-white">汉</span><span className="font-semibold tracking-wide">CHINESE REVIEW</span></Link>
      <nav className="space-y-1">{navigation.filter(({ href }) => isStaff || !href.startsWith('/admin/')).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === href || pathname.startsWith(`${href}/`) ? 'bg-red-50 text-[#b91c1c]' : 'text-slate-600 hover:bg-stone-100'}`}><Icon size={18}/>{label}{href === '/quizzes' && quizCount > 0 && <span className="ml-auto inline-flex min-w-5 justify-center rounded-full bg-[#b91c1c] px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-white">{quizCount}</span>}</Link>)}</nav>
      <div className="mt-auto rounded-2xl bg-[#fff8e8] p-4"><Sparkles size={18} className="mb-2 text-amber-500"/><p className="text-sm font-semibold">Keep your streak alive</p><p className="mt-1 text-xs text-slate-500">A little review today goes a long way.</p></div>
    </aside>
    <main className="pb-24 md:ml-64 md:pb-8"><header className="hidden h-16 items-center justify-end border-b border-stone-200 bg-white px-5 md:flex md:px-8"><div className="flex items-center gap-3"><span className="text-sm font-medium text-slate-700">{displayName}</span><button type="button" onClick={logout} aria-label="Log out" className="rounded-lg p-2 text-slate-500 transition hover:bg-stone-100 hover:text-[#b91c1c]"><LogOut size={18}/></button></div></header><div className="mx-auto max-w-7xl p-4 sm:p-6 md:p-8">{children}</div></main>
    <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-stone-200 bg-white px-2 py-2 md:hidden">{[{href:'/dashboard',label:'Home',icon:House},{href:'/words',label:'Words',icon:BookOpen},{href:'/daily',label:'Daily',icon:CalendarDays},{href:'/quizzes',label:'Quiz',icon:GraduationCap},{href:'/settings',label:'Profile',icon:CircleUserRound}].map(({href,label,icon:Icon}) => <Link key={label} href={href} className={`flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${pathname === href ? 'text-[#b91c1c]' : 'text-slate-500'}`}><Icon size={19}/><span>{label}{href === '/quizzes' && quizCount > 0 && <span className="ml-1 rounded-full bg-[#b91c1c] px-1.5 py-0.5 text-white">{quizCount}</span>}</span></Link>)}</nav>
  </div>
}
