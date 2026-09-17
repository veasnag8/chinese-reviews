"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type QuizQuestion = { id: string; chinese: string; correct_answer: string; created_at: string };

export default function AdminQuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [word, setWord] = useState("");
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const loadQuestions = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("quiz_questions").select("id, chinese, correct_answer, created_at").order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setQuestions((data || []) as QuizQuestion[]);
  };

  useEffect(() => { loadQuestions(); }, []);

  const addQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !word.trim() || !answer.trim()) return;
    setSaving(true);
    setMessage("");
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setMessage("Please sign in again."); setSaving(false); return; }
    const { error } = await (supabase.from("quiz_questions") as any).insert({ question_type: "chinese-to-meaning", chinese: word.trim(), correct_answer: answer.trim(), user_id: authData.user.id });
    if (error) setMessage(error.message);
    else { setWord(""); setAnswer(""); await loadQuestions(); }
    setSaving(false);
  };

  const deleteQuestion = async (id: string) => {
    if (!supabase || !window.confirm("Delete this quiz question?")) return;
    const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
    if (error) setMessage(error.message);
    else await loadQuestions();
  };

  return <div className="space-y-6"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Administration</p><h1 className="mt-1 text-3xl font-bold">Manage Quiz</h1><p className="mt-2 text-slate-500">Enter a Chinese word and its one correct answer. The system creates random wrong choices for students.</p></div>{message && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}<form onSubmit={addQuestion} className="max-w-2xl rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Chinese word<input required value={word} onChange={(event) => setWord(event.target.value)} placeholder="学" className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label><label className="text-sm font-semibold">Correct answer<input required value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="រៀន" className="mt-1.5 w-full rounded-lg border border-stone-200 px-3 py-2.5 font-normal" /></label></div><button disabled={saving} className="mt-4 rounded-lg bg-[#b91c1c] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Add quiz question"}</button></form><div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white"><table className="w-full min-w-[500px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50"><tr><th className="p-4">Chinese word</th><th className="p-4">Correct answer</th><th className="p-4">Action</th></tr></thead><tbody>{questions.map((question) => <tr key={question.id} className="border-b border-stone-100"><td className="p-4 text-lg font-semibold">{question.chinese}</td><td className="p-4">{question.correct_answer}</td><td className="p-4"><button type="button" onClick={() => deleteQuestion(question.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={13} /> Delete</button></td></tr>)}{questions.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-500">No quiz questions yet.</td></tr>}</tbody></table></div></div>;
}
