"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, FileText, Languages, PenLine, Volume2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Lesson = { id: string; name: string; date: string; description?: string | null; teacher?: string | null };

const speak = (text: string) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
};

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Daily lesson</p>
        <h1 className="mt-1 text-3xl font-bold">What I learned today</h1>
      </div>
      <label className="block max-w-xl text-sm font-semibold">
        Lesson date
        <select
          value={lessonId}
          onChange={(event) => setLessonId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-3 font-normal"
        >
          <option value="">Select a lesson date</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.date} — {lesson.name}
            </option>
          ))}
        </select>
      </label>

      {!selectedLesson ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-slate-500">
          No lesson schedules yet.
        </p>
      ) : (
        <>
          <div className="rounded-2xl border border-red-100 bg-white p-5">
            <p className="flex items-center gap-2 font-semibold">
              <CalendarDays size={19} className="text-[#b91c1c]" />
              {selectedLesson.date} — {selectedLesson.name}
            </p>
            {selectedLesson.description && (
              <p className="mt-2 text-sm text-slate-600">{selectedLesson.description}</p>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Languages size={20} className="text-[#b91c1c]" />
                Words
              </h2>
              <div className="mt-4 space-y-3">
                {words.length ? (
                  words.map((word) => (
                    <div
                      key={word.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 p-3 transition hover:bg-red-50/50"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => speak(word.chinese)}
                          className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-[#b91c1c] transition"
                          title="Listen"
                        >
                          <Volume2 size={18} />
                        </button>
                        <div>
                          <p className="text-xl font-semibold">{word.chinese}</p>
                          <p className="text-sm text-[#b91c1c]">{word.pinyin}</p>
                          <p className="text-sm text-slate-600">{word.khmer} · {word.english}</p>
                        </div>
                      </div>
                      <Link
                        href={`/writing?word=${encodeURIComponent(word.id)}`}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#b91c1c] hover:underline"
                      >
                        <PenLine size={14} /> Practice
                      </Link>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No words for this date.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <FileText size={20} className="text-[#b91c1c]" />
                Sentences
              </h2>
              <div className="mt-4 space-y-3">
                {sentences.length ? (
                  sentences.map((sentence) => (
                    <div
                      key={sentence.id}
                      className="flex items-start justify-between gap-3 rounded-xl bg-stone-50 p-3 transition hover:bg-stone-100/70"
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => speak(sentence.chinese_sentence)}
                          className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-[#b91c1c] transition shrink-0"
                          title="Listen"
                        >
                          <Volume2 size={18} />
                        </button>
                        <div>
                          <p className="font-semibold text-base text-slate-900">{sentence.chinese_sentence}</p>
                          <p className="text-sm text-[#b91c1c] font-medium">{sentence.pinyin}</p>
                          <p className="text-sm text-slate-600">
                            {[sentence.khmer_translation, sentence.english_translation].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No sentences for this date.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
