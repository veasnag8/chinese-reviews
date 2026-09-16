"use client";

import { useState, useEffect } from "react";
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
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      router.push("/login");
      return;
    }

    setUser(data.user.id);
  };

  const fetchClassesData = async (userId: string) => {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error) {
      setLoadError(
        "Your database classes table is not ready yet. Run the Supabase migration, then refresh this page."
      );
      return;
    }

    setLoadError("");
    setClasses(data || []);
  };

  const onAddClass = async (data: ClassFormData) => {
    if (!user) return;

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

          <Button
            variant="primary"
            onClick={() => {
              setFormState("idle");
              setShowCreateForm(true);
            }}
          >
            + Create Class
          </Button>
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

        {showCreateForm && (
          <Card className="max-w-md p-6">
            <h3 className="text-lg font-medium mb-4">
              Create New Class
            </h3>

            <form
              onSubmit={handleSubmit(onAddClass)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">
                  Class Name
                </label>
                <Input
                  placeholder="e.g., Class 01"
                  {...register("name")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Teacher (optional)
                </label>
                <Input
                  placeholder="Teacher name"
                  {...register("teacher")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Lesson Number (optional)
                </label>
                <Input
                  type="number"
                  placeholder="Lesson number"
                  {...register("lessonNumber", {
                    valueAsNumber: true,
                  })}
                />
              </div>

              <Button
                type="submit"
                disabled={formState === "submitting"}
              >
                {formState === "submitting" ? "Creating..." : "Save Class"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={formState === "submitting"}
                onClick={() => {
                  reset();
                  setFormState("idle");
                  setShowCreateForm(false);
                }}
              >
                Cancel
              </Button>
            </form>
          </Card>
        )}

        {classes.length === 0 ? (
          <EmptyState>
            <p>No classes yet</p>
            <p className="text-sm mt-2">
              Create your first class to organize your words and sentences
            </p>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="p-3 text-left">Class</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Words</th>
                  <th className="p-3 text-left">Sentences</th>
                  <th className="p-3 text-left">Teacher</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {classes.map((cls: any) => (
                  <tr
                    key={cls.id}
                    className="hover:bg-muted/50"
                  >
                    <td className="p-3">{cls.name}</td>
                    <td className="p-3">{formatDate(cls.date)}</td>
                    <td className="p-3">{cls.word_count || 0}</td>
                    <td className="p-3">
                      {cls.sentence_count || 0}
                    </td>
                    <td className="p-3">
                      {cls.teacher || "—"}
                    </td>
                    <td className="p-3 flex gap-2">
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteClass(cls.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
