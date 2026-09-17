"use client";

import { useEffect, useState } from "react";
import { CalendarDays, FileText, Languages } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Lesson = { id: string; name: string; date: string; description?: string | null; teacher?: string | null };

export default function DailyPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [words, setWords] = useState<any[]>([]);
  const [sentences, setSentences] = useState<any[]>([]);
  const selectedLesson = lessons.find((lesson) => lesson.id === lessonId);

  useEffect(() => {
    const loadLessons = async () => {
      if (!supabase) return;
      const { data } = await supabase.from("classes").select("id, name, date, description, teacher").order("date", { ascending: false });
      const loadedLessons = (data || []) as Lesson[];
      setLessons(loadedLessons);
      setLessonId(loadedLessons[0]?.id || "");
    };
    loadLessons();
  }, []);

  useEffect(() => {
    const loadContent = async () => {
      if (!supabase || !lessonId) return;
      const [wordResult, sentenceResult] = await Promise.all([
        supabase.from("words").select("id, chinese, pinyin, khmer, english").eq("class_id", lessonId),
        supabase.from("sentences").select("id, chinese_sentence, pinyin, khmer_translation, english_translation").eq("class_id", lessonId),
      ]);
      setWords(wordResult.data || []);
      setSentences(sentenceResult.data || []);
    };
    loadContent();
  }, [lessonId]);

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Daily lesson</p><h1 className="mt-1 text-3xl font-bold">What I learned today</h1></div>
    <label className="block max-w-xl text-sm font-semibold">Lesson date<select value={lessonId} onChange={(event) => setLessonId(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 font-normal"><option value="">Select a lesson date</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.date} — {lesson.name}</option>)}</select></label>
    {!selectedLesson ? <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-slate-500">No lesson schedules yet.</p> : <><div className="rounded-2xl border border-red-100 bg-white p-5"><p className="flex items-center gap-2 font-semibold"><CalendarDays size={19} className="text-[#b91c1c]" />{selectedLesson.date} — {selectedLesson.name}</p>{selectedLesson.description && <p className="mt-2 text-sm text-slate-600">{selectedLesson.description}</p>}</div><div className="grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><Languages size={20} className="text-[#b91c1c]" />Words</h2><div className="mt-4 space-y-3">{words.length ? words.map((word) => <div key={word.id} className="rounded-xl bg-stone-50 p-3"><p className="text-xl font-semibold">{word.chinese}</p><p className="text-sm text-[#b91c1c]">{word.pinyin}</p><p className="text-sm text-slate-600">{word.khmer} · {word.english}</p></div>) : <p className="text-sm text-slate-500">No words for this date.</p>}</div></section><section className="rounded-2xl border border-stone-200 bg-white p-5"><h2 className="flex items-center gap-2 text-lg font-bold"><FileText size={20} className="text-[#b91c1c]" />Sentences</h2><div className="mt-4 space-y-3">{sentences.length ? sentences.map((sentence) => <div key={sentence.id} className="rounded-xl bg-stone-50 p-3"><p className="font-semibold">{sentence.chinese_sentence}</p><p className="text-sm text-[#b91c1c]">{sentence.pinyin}</p><p className="text-sm text-slate-600">{sentence.khmer_translation} · {sentence.english_translation}</p></div>) : <p className="text-sm text-slate-500">No sentences for this date.</p>}</div></section></div></>}
  </div>;
}
