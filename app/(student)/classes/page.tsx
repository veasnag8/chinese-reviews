"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

const classSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  description: z.string().optional(),
  teacher: z.string().optional(),
  lessonNumber: z.number().optional(),
});

type ClassFormData = z.infer<typeof classSchema>;

export default function ClassesPage() {
  const router = useRouter();

  const [user, setUser] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [formState, setFormState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { register, handleSubmit, reset } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
  });

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchClassesData(user);
    }
  }, [user]);

  const fetchUser = async () => {
    if (!supabase) {
      setLoadError("Supabase is not configured. Add the public keys to .env.local.");
      return;
    }

    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      router.push("/login");
      return;
    }

    setUser(data.user.id);
  };

  const fetchClassesData = async (userId: string) => {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("name", { ascending: true })
      .order("date", { ascending: false });

    if (error) {
      setLoadError(`Unable to load classes: ${error.message}`);
      return;
    }

    const classesWithContentCounts = await Promise.all(
      (data || []).map(async (lessonClass: any) => {
        const [wordsResult, sentencesResult] = await Promise.all([
          supabase
            .from("words")
            .select("id", { count: "exact", head: true })
            .eq("class_id", lessonClass.id),
          supabase
            .from("sentences")
            .select("id", { count: "exact", head: true })
            .eq("class_id", lessonClass.id),
        ]);

        return {
          ...lessonClass,
          word_count: wordsResult.count || 0,
          sentence_count: sentencesResult.count || 0,
        };
      })
    );

    setLoadError("");
    setClasses(classesWithContentCounts);
  };

  const groupedClasses = useMemo(() => {
    const groups = new Map<string, any[]>();
    classes.forEach((cls) => {
      const key = cls.name || "Unnamed Class";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(cls);
    });
    return Array.from(groups.entries()).map(([name, lessons]) => ({
      name,
      lessons: lessons.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalWords: lessons.reduce((sum, l) => sum + (l.word_count || 0), 0),
      totalSentences: lessons.reduce((sum, l) => sum + (l.sentence_count || 0), 0),
    }));
  }, [classes]);

  const onAddClass = async (data: ClassFormData) => {
    if (!user) return;
    if (!supabase) {
      setLoadError("Supabase is not configured. Add the public keys to .env.local.");
      return;
    }

    setFormState("submitting");

    const { error } = await supabase
      .from("classes")
      .insert({
        name: data.name,
        description: data.description,
        teacher: data.teacher,
        lesson_number: data.lessonNumber,
        date: new Date().toISOString().split("T")[0],
        user_id: user,
      } as any);

    if (error) {
      console.error(error);
      setLoadError(`Unable to create class: ${error.message}`);
      setFormState("error");
      return;
    }

    setFormState("success");
    reset();
    await fetchClassesData(user);
    setFormState("idle");
    setShowCreateForm(false);
  };

  const deleteClass = async (classId: string) => {
    const { error } = await supabase
      .from("classes")
      .delete()
      .eq("id", classId);

    if (error) {
      console.error(error);
      return;
    }

    if (user) {
      await fetchClassesData(user);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            My Classes
          </h2>
        </div>

        {formState === "error" && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            Failed to create class. Please try again.
          </div>
        )}

        {loadError && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {loadError}
          </div>
        )}

        {classes.length === 0 ? (
          <EmptyState>
            <p>No classes yet</p>
            <p className="text-sm mt-2">
              Create your first class to organize your words and sentences
            </p>
          </EmptyState>
) : (
          <div className="space-y-4">
            {groupedClasses.map((group) => (
              <details key={group.name} className="group bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <summary className="flex items-center justify-between p-4 bg-stone-50 border-b border-stone-200 cursor-pointer list-none">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900 truncate">{group.name}</h3>
                    <p className="mt-1 text-sm text-slate-500 truncate">
                      {group.lessons.length} lesson{group.lessons.length !== 1 ? 's' : ''} •
                      {group.totalWords} word{group.totalWords !== 1 ? 's' : ''} •
                      {group.totalSentences} sentence{group.totalSentences !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-slate-400 transition-transform group-open:rotate-180 flex-shrink-0 ml-4">▼</span>
                </summary>
                <div className="divide-y divide-stone-100">
                  {group.lessons.map((lesson) => (
                    <div key={lesson.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-stone-50 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-[#b91c1c] text-white flex-shrink-0">
                          <span className="font-semibold text-sm leading-tight">
                            {formatDate(lesson.date, 'dd')}
                          </span>
                          <span className="absolute bottom-1 right-1 text-[10px] font-medium opacity-90">
                            {formatDate(lesson.date, 'MMM').toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {lesson.lesson_number ? `Lesson #${lesson.lesson_number}` : 'Lesson'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {lesson.description || 'No description'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap flex-shrink-0">
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-stone-100">
                          📝 {lesson.word_count || 0}
                        </span>
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-stone-100">
                          📖 {lesson.sentence_count || 0}
                        </span>
                        {lesson.teacher && (
                          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-stone-100">
                            👤 {lesson.teacher}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
