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
              <div key={group.name} className="bg-white rounded-2xl border border-stone-200 p-5">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">{group.name}</h3>
                <ul className="space-y-2 ml-4 border-l-2 border-stone-200 pl-4">
                  {group.lessons.map((lesson) => (
                    <li key={lesson.id} className="relative pb-2 before:absolute before:left-[-10px] before:top-[6px] before:w-2 before:h-2 before:bg-[#b91c1c] before:rounded-full">
                      <span className="font-medium text-slate-900">
                        Lesson {formatDate(lesson.date, 'dd/MM/yyyy')}
                      </span>
                      {lesson.lesson_number && (
                        <span className="ml-2 text-xs text-slate-500">(No. {lesson.lesson_number})</span>
                      )}
                      {lesson.description && (
                        <p className="mt-1 text-xs text-slate-500 ml-6">{lesson.description}</p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 ml-6">
                        <span>📝 {lesson.word_count || 0} words</span>
                        <span>📖 {lesson.sentence_count || 0} sentences</span>
                        {lesson.teacher && <span>👤 {lesson.teacher}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
