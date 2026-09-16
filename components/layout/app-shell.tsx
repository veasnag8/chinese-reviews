'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, CalendarDays, ChartNoAxesColumnIncreasing, CircleUserRound, Heart, House, PenLine, Plus, Repeat2, Settings, Sparkles, TextQuote } from 'lucide-react';
import type { ReactNode } from 'react';

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: House }, { href: '/words', label: 'My Words', icon: BookOpen },
  { href: '/sentences', label: 'Sentences', icon: TextQuote }, { href: '/classes', label: 'My Classes', icon: CalendarDays },
  { href: '/review', label: 'Review', icon: Repeat2 }, { href: '/writing', label: 'Practice Writing', icon: PenLine }, { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing }, { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-[#f7f6f3] text-slate-900">
    <aside className="fixed inset-y-0 hidden w-64 border-r border-stone-200 bg-white px-4 py-6 md:flex md:flex-col">
      <Link href="/dashboard" className="mb-9 flex items-center gap-3 px-2"><span className="grid size-9 place-items-center rounded-xl bg-[#b91c1c] text-lg text-white">汉</span><span className="font-semibold tracking-wide">CHINESE REVIEW</span></Link>
      <nav className="space-y-1">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${pathname === href ? 'bg-red-50 text-[#b91c1c]' : 'text-slate-600 hover:bg-stone-100'}`}><Icon size={18}/>{label}</Link>)}</nav>
      <div className="mt-auto rounded-2xl bg-[#fff8e8] p-4"><Sparkles size={18} className="mb-2 text-amber-500"/><p className="text-sm font-semibold">Keep your streak alive</p><p className="mt-1 text-xs text-slate-500">A little review today goes a long way.</p></div>
    </aside>
    <main className="pb-24 md:ml-64 md:pb-8"><header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-5 md:px-8"><div className="text-sm text-slate-500">Your personal Chinese class notebook</div><Link href="/settings" className="flex items-center gap-2 text-sm font-medium"><span className="hidden sm:inline">Veasna</span><CircleUserRound className="text-slate-500"/></Link></header><div className="mx-auto max-w-7xl p-4 sm:p-6 md:p-8">{children}</div></main>
    <nav className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-around border-t border-stone-200 bg-white px-2 py-2 md:hidden">{[{href:'/dashboard',label:'Home',icon:House},{href:'/words',label:'Words',icon:BookOpen},{href:'/words?add=1',label:'Add',icon:Plus},{href:'/review',label:'Review',icon:Repeat2},{href:'/settings',label:'Profile',icon:CircleUserRound}].map(({href,label,icon:Icon}) => <Link key={label} href={href} className={`flex min-w-14 flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${href.startsWith('/words?') ? 'text-white' : pathname === href ? 'text-[#b91c1c]' : 'text-slate-500'}`}><span className={href.startsWith('/words?') ? 'grid size-10 -mt-6 place-items-center rounded-full bg-[#b91c1c] shadow-lg' : ''}><Icon size={href.startsWith('/words?') ? 22 : 19}/></span>{label}</Link>)}</nav>
  </div>
}
