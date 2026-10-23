"use client";

import { Suspense, useState } from "react";
import { ArrowRight, BookOpen, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return <div className="flex items-center gap-3 font-bold tracking-wide"><span className={`grid size-11 place-items-center rounded-2xl text-xl shadow-sm ${inverse ? "bg-white text-[#b91c1c]" : "bg-[#b91c1c] text-white"}`}>汉</span><span>CHINESE REVIEW</span></div>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    if (!supabase) {
      setMessage("The sign-in service is not configured yet.");
      setBusy(false);
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }
      router.replace(redirect);
      router.refresh();
    } catch {
      setMessage("Unable to sign in right now. Please check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <main className="login-safe-area min-h-[100dvh] overflow-hidden bg-[#f7f3ef] lg:p-7">
      <div className="mx-auto grid min-h-[100dvh] max-w-6xl overflow-hidden bg-white lg:min-h-[calc(100dvh-3.5rem)] lg:grid-cols-[1.05fr_0.95fr] lg:rounded-[2rem] lg:border lg:border-stone-200 lg:shadow-[0_30px_90px_rgba(69,31,23,0.14)]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#a51616] via-[#b91c1c] to-[#741010] px-6 pb-16 pt-7 text-white sm:px-10 lg:p-12">
          <div className="absolute -right-20 -top-24 size-72 rounded-full border-[42px] border-white/5 lg:size-96 lg:border-[60px]" />
          <div className="absolute -bottom-32 -left-24 size-72 rounded-full bg-black/10 blur-sm" />
          <div className="relative z-10"><BrandMark inverse /></div>
          <div className="relative z-10 mt-12 max-w-md sm:mt-16 lg:mt-28">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-red-50 backdrop-blur"><Sparkles size={14} /> Learn a little every day</div>
            <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Learn today.<br />Remember tomorrow.</h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-red-100 sm:text-base lg:text-lg lg:leading-8">Your Chinese words, conversations, homework, and reviews—all in one calm place.</p>
          </div>
          <div className="relative z-10 mt-8 hidden items-center gap-3 text-sm text-red-100 lg:flex"><BookOpen size={19} /> Chinese · Pinyin · Khmer · English</div>
        </section>

        <section className="relative -mt-7 flex items-start justify-center rounded-t-[2rem] bg-white px-5 pb-10 pt-8 sm:px-10 lg:mt-0 lg:items-center lg:rounded-none lg:p-12">
          <div className="w-full max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#b91c1c]">Welcome back</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Sign in to continue</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">Pick up right where your last review ended.</p>
            {message && <p role="alert" className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{message}</p>}

            <form onSubmit={submit} className="mt-7 space-y-5">
              <label className="block text-sm font-semibold text-slate-700">Email address<span className="relative mt-2 block"><Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input required autoComplete="email" inputMode="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50/70 py-3 pl-12 pr-4 text-base outline-none transition focus:border-[#b91c1c] focus:bg-white focus:ring-4 focus:ring-red-50" /></span></label>
              <label className="block text-sm font-semibold text-slate-700">Password<span className="relative mt-2 block"><LockKeyhole className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input required autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" className="min-h-14 w-full rounded-2xl border border-stone-200 bg-stone-50/70 py-3 pl-12 pr-12 text-base outline-none transition focus:border-[#b91c1c] focus:bg-white focus:ring-4 focus:ring-red-50" /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-xl text-slate-400 hover:bg-stone-100 hover:text-slate-700">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></span></label>
              <button type="submit" disabled={busy} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#b91c1c] px-4 font-semibold text-white shadow-lg shadow-red-900/15 transition hover:bg-[#991b1b] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70">{busy ? <><LoaderCircle className="animate-spin" size={20} /> Signing in…</> : <>Sign in <ArrowRight size={19} /></>}</button>
            </form>
            <p className="mt-6 text-center text-sm leading-6 text-slate-500">Need an account? Contact your administrator.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function LoginLoading() {
  return <div className="grid min-h-[100dvh] place-items-center bg-[#b91c1c] text-white"><div className="text-center"><span className="mx-auto grid size-20 place-items-center rounded-[1.75rem] bg-white text-4xl font-bold text-[#b91c1c] shadow-xl">汉</span><p className="mt-5 font-bold tracking-[0.18em]">CHINESE REVIEW</p><LoaderCircle className="mx-auto mt-5 animate-spin text-red-200" size={24} /></div></div>;
}

export default function LoginPage() {
  return <Suspense fallback={<LoginLoading />}><LoginForm /></Suspense>;
}
