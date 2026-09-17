"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EmptyState } from "@/components/ui/empty-state";

const sentenceSchema = z.object({
  chineseSentence: z.string().min(1, "Sentence is required"),
  pinyin: z.string().optional(),
  khmerTranslation: z.string().optional(),
  englishTranslation: z.string().optional(),
  audioUrl: z.string().optional(),
});

type SentenceFormData = z.infer<typeof sentenceSchema>;

export default function SentencesPage() {
  const router = useRouter();

  const [user, setUser] = useState<string | null>(null);
  const [sentences, setSentences] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const [formState, setFormState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSentences(user);
      fetchClasses(user);
    }
  }, [user]);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      router.push("/login");
      return;
    }

    setUser(data.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    setIsAdmin(profile?.role === "admin");
  };

  const fetchSentences = async (userId: string) => {
    const { data, error } = await supabase
      .from("sentences")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setSentences(data || []);
  };

  const fetchClasses = async (userId: string) => {
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setClasses(data || []);
  };

  const { register, handleSubmit, reset } = useForm<SentenceFormData>({
    resolver: zodResolver(sentenceSchema),
  });

  const onAddSentence = async (data: SentenceFormData) => {
    if (!user) return;

    setFormState("submitting");

    const { error } = await supabase
      .from("sentences")
      .insert({
        chinese_sentence: data.chineseSentence,
        pinyin: data.pinyin,
        khmer_translation: data.khmerTranslation,
        english_translation: data.englishTranslation,
        audio_url: data.audioUrl,
        class_id: selectedClass,
        user_id: user,
      } as any);

    if (error) {
      console.error(error);
      setFormState("error");
      return;
    }

    setFormState("success");
    reset();
    setIsAdding(false);

    await fetchSentences(user);
  };

  const deleteSentence = async (sentenceId: string) => {
    const { error } = await supabase
      .from("sentences")
      .delete()
      .eq("id", sentenceId);

    if (error) {
      console.error(error);
      return;
    }

    if (user) {
      await fetchSentences(user);
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
            My Sentences
          </h2>

          {isAdmin && <div className="flex gap-2">
              <Select
              value={selectedClass || ""}
              options={[
                { value: "", label: "Select lesson date" },
                ...classes.map((cls: any) => ({
                  value: cls.id,
                  label: cls.date ? `${cls.name} — ${cls.date}` : cls.name,
                })),
              ]}
              onChange={(event) =>
                setSelectedClass(event.target.value || null)
              }
              />

            <Button variant="primary" type="button" onClick={() => setIsAdding(true)}>
              + Add Sentence
            </Button>
          </div>}
        </div>

        {formState === "error" && (
          <div className="mb-4 rounded-md border border-destructive p-3 text-destructive">
            Failed to save sentence. Please try again.
          </div>
        )}

        {isAdmin && isAdding && (
          <form onSubmit={handleSubmit(onAddSentence)} className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-lg font-semibold">Add sentence</h3>
            <p className="text-sm text-muted-foreground">Choose the lesson date above before saving this sentence.</p>
            <textarea {...register("chineseSentence")} required placeholder="Chinese sentence" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input {...register("pinyin")} placeholder="Pinyin" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("khmerTranslation")} placeholder="Khmer translation" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("englishTranslation")} placeholder="English translation" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("audioUrl")} placeholder="Audio URL (optional)" className="rounded-md border border-input bg-background px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={formState === "submitting" || !selectedClass}>{formState === "submitting" ? "Saving..." : "Save Sentence"}</Button>
              <Button type="button" variant="outline" onClick={() => { setIsAdding(false); reset(); }}>Cancel</Button>
            </div>
          </form>
        )}

        {sentences.length === 0 ? (
          <EmptyState>
            <p>No sentences yet</p>
            <p className="text-sm mt-2">
              Add your first sentence to get started
            </p>
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="p-3 text-left">Sentence</th>
                  <th className="p-3 text-left">Pinyin</th>
                  <th className="p-3 text-left">Khmer</th>
                  <th className="p-3 text-left">English</th>
                  <th className="p-3 text-left">Class</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {sentences.map((sentence: any) => (
                  <tr
                    key={sentence.id}
                    className="hover:bg-muted/50"
                  >
                    <td className="p-3 truncate">
                      {sentence.chinese_sentence}
                    </td>

                    <td className="p-3">
                      {sentence.pinyin || "—"}
                    </td>

                    <td className="p-3">
                      {sentence.khmer_translation || "—"}
                    </td>

                    <td className="p-3">
                      {sentence.english_translation || "—"}
                    </td>

                    <td className="p-3">
                      {sentence.class_name || "—"}
                    </td>

                    <td className="p-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                      >
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        type="button"
                        onClick={() =>
                          deleteSentence(sentence.id)
                        }
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
