"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, LockKeyhole, Mail, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"student" | "teacher" | "admin">("student");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      setBusy(false);
      return;
    }

    if (!supabase) {
      setMessage("Supabase is not configured. Add keys to .env.local.");
      setBusy(false);
      return;
    }

    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
        },
      });

      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }

      if (data.user?.identities?.length === 0) {
        setMessage("User already exists. Try logging in instead.");
        setBusy(false);
        return;
      }

      setMessage("Account created! Check your email to confirm.");
      setBusy(false);
    } catch (err) {
      console.error("Register error:", err);
      setMessage("An unexpected error occurred. Please try again.");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbfaf8] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_24px_80px_rgba(45,32,20,0.10)] lg:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[#8f1717] p-12 text-white lg:block">
          <div className="absolute -right-32 -top-32 size-96 rounded-full border-[60px] border-red-800/60" />
          <div className="relative">
            <div className="flex items-center gap-3 font-semibold tracking-wide">
              <span className="grid size-10 place-items-center rounded-xl bg-white text-xl text-[#b91c1c]">汉</span>
              CHINESE REVIEW
            </div>
            <div className="mt-32 max-w-md">
              <p className="text-sm font-semibold tracking-[0.18em] text-red-200">YOUR CLASSROOM COMPANION</p>
              <h1 className="mt-5 text-5xl font-bold leading-tight">
                Create your account
                <br />
                Start learning today.
              </h1>
              <p className="mt-6 text-lg leading-8 text-red-100">
                Join thousands of learners mastering Chinese with spaced repetition.
              </p>
            </div>
            <div className="mt-20 flex items-center gap-3 text-sm text-red-100">
              <BookOpen size={19} /> Chinese · Pinyin · Khmer · English
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center p-7 sm:p-12">
          <div className="w-full max-w-sm">
            <div className="mb-10 lg:hidden">
              <div className="flex items-center gap-2 font-semibold">
                <span className="grid size-9 place-items-center rounded-xl bg-[#b91c1c] text-white">汉</span>
                CHINESE REVIEW
              </div>
            </div>
            <p className="text-sm font-semibold tracking-wider text-[#b91c1c]">CREATE ACCOUNT</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Sign up to continue</h2>
            <p className="mt-3 text-slate-500">Enter your details to get started.</p>
            {message && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block text-sm font-semibold text-slate-700">
                Full name
                <span className="relative mt-2 block">
                  <User className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3 outline-none transition focus:border-[#b91c1c] focus:ring-4 focus:ring-red-50"
                  />
                </span>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Email address
                <span className="relative mt-2 block">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3 outline-none transition focus:border-[#b91c1c] focus:ring-4 focus:ring-red-50"
                  />
                </span>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Password
                <span className="relative mt-2 block">
                  <LockKeyhole className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3 outline-none transition focus:border-[#b91c1c] focus:ring-4 focus:ring-red-50"
                  />
                </span>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Confirm password
                <span className="relative mt-2 block">
                  <LockKeyhole className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full rounded-xl border border-stone-200 py-2.5 pl-10 pr-3 outline-none transition focus:border-[#b91c1c] focus:ring-4 focus:ring-red-50"
                  />
                </span>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Register as
                <span className="relative mt-2 block">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "student" | "teacher" | "admin")}
                    className="w-full rounded-xl border border-stone-200 py-2.5 pl-3 pr-10 outline-none transition focus:border-[#b91c1c] focus:ring-4 focus:ring-red-50 appearance-none bg-white"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </span>
              </label>
              <button
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b91c1c] py-3 font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {busy ? "Creating account…" : "Create account"} <ArrowRight size={18} />
              </button>
            </form>
            <p className="mt-7 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <a href="/login" className="font-semibold text-[#b91c1c] hover:underline">
                Sign in
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}