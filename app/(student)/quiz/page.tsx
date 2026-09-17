"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Trophy, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type QuizQuestion = { id: string; chinese: string; correct_answer: string };

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

export default function QuizPage() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const loadQuestions = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase.from("quiz_questions").select("id, chinese, correct_answer").order("created_at", { ascending: false });
      setQuestions((data || []) as QuizQuestion[]);
      setLoading(false);
    };
    loadQuestions();
  }, []);

  const quizQuestions = useMemo(() => questions.map((question) => {
    const wrongAnswers = shuffle([...new Set(questions.filter((item) => item.id !== question.id && item.correct_answer !== question.correct_answer).map((item) => item.correct_answer))]).slice(0, 3);
    return { ...question, choices: shuffle([question.correct_answer, ...wrongAnswers]) };
  }), [questions]);
  const question = quizQuestions[questionIndex];
  const restart = () => { setQuestionIndex(0); setSelectedAnswer(""); setChecked(false); setScore(0); };

  if (loading) return <p className="text-slate-500">Loading quiz...</p>;
  if (questions.length < 2) return <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-slate-500">Quiz is not ready yet. Your teacher needs to add at least 2 quiz questions.</div>;
  if (!question) return <div className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm"><Trophy className="mx-auto text-amber-500" size={42} /><p className="mt-4 text-sm font-semibold tracking-wider text-[#b91c1c]">QUIZ COMPLETE</p><h1 className="mt-2 text-3xl font-bold">Your score: {score} / {quizQuestions.length}</h1><button onClick={restart} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white"><RotateCcw size={17} /> Try again</button></div>;

  const correct = selectedAnswer === question.correct_answer;
  const next = () => { if (correct) setScore((current) => current + 1); setQuestionIndex((current) => current + 1); setSelectedAnswer(""); setChecked(false); };

  return <div className="mx-auto max-w-2xl space-y-6"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Student quiz</p><h1 className="mt-1 text-3xl font-bold">Test your Chinese</h1></div><span className="rounded-full bg-stone-200 px-3 py-1.5 text-sm font-semibold">{questionIndex + 1} / {quizQuestions.length}</span></div><div className="h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-[#b91c1c]" style={{ width: `${(questionIndex / quizQuestions.length) * 100}%` }} /></div><section className="rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm sm:p-10"><p className="text-sm text-slate-500">Choose the correct answer</p><p className="mt-5 text-6xl font-semibold">{question.chinese}</p><div className="mt-8 grid gap-3 text-left">{question.choices.map((choice, index) => <button key={`${choice}-${index}`} disabled={checked} onClick={() => setSelectedAnswer(choice)} className={`rounded-xl border p-4 text-left font-medium ${selectedAnswer === choice ? "border-[#b91c1c] bg-red-50" : "border-stone-200"} ${checked && choice === question.correct_answer ? "border-emerald-500 bg-emerald-50" : ""}`}>{String.fromCharCode(65 + index)}. {choice}</button>)}</div>{checked && <p className={`mt-5 rounded-xl p-3 text-sm font-semibold ${correct ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{correct ? <><Check className="mr-1 inline" size={16} /> Correct!</> : <><X className="mr-1 inline" size={16} /> Correct answer: {question.correct_answer}</>}</p>}<div className="mt-7 flex justify-end">{checked ? <button onClick={next} className="rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white">Next question</button> : <button disabled={!selectedAnswer} onClick={() => setChecked(true)} className="rounded-xl bg-[#b91c1c] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">Check answer</button>}</div></section></div>;
}
