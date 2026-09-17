"use client";

import { useState, useEffect, useRef } from "react";
import { Heart } from "lucide-react";
import { fetchFavoriteIds, toggleFavorite } from "@/lib/favorites";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EmptyState } from "@/components/ui/empty-state";
import { ensureClassForDate, todayISO } from "@/lib/schedule";

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
  const [isStaff, setIsStaff] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [favoriteSentences, setFavoriteSentences] = useState<Set<string>>(new Set());
  const [favoriteError, setFavoriteError] = useState('');
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [pendingFavorites, setPendingFavorites] = useState<Set<string>>(new Set());
  const pendingFavoriteIds = useRef(new Set<string>());

  const [formState, setFormState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchSentences();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setFavoritesReady(false);
    fetchFavoriteIds(user).then((result) => {
      if (!active) return;
      if (result.error) setFavoriteError(result.error);
      else {
        setFavoriteSentences(result.sentences);
        setFavoritesReady(true);
      }
    }).catch(() => {
      if (active) setFavoriteError('Unable to load favorites. Please reload and try again.');
    });
    return () => { active = false; };
  }, [user]);

  const toggleSentenceFavorite = async (id: string) => {
    if (!user || !favoritesReady || pendingFavoriteIds.current.has(id)) return;
    const isFavorite = favoriteSentences.has(id);
    pendingFavoriteIds.current.add(id);
    setPendingFavorites(new Set(pendingFavoriteIds.current));
    setFavoriteError('');
    try {
      const result = await toggleFavorite(user, 'sentence', id, isFavorite);
      if (result.error) setFavoriteError(result.error);
      else setFavoriteSentences((current) => {
        const next = new Set(current);
        if (isFavorite) next.delete(id);
        else next.add(id);
        return next;
      });
    } catch {
      setFavoriteError('Unable to update favorites. Please try again.');
    } finally {
      pendingFavoriteIds.current.delete(id);
      setPendingFavorites(new Set(pendingFavoriteIds.current));
    }
  };

  const fetchUser = async () => {
    if (!supabase) return;
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
    const role = (profile as { role?: string } | null)?.role;
    setIsStaff(role === "admin" || role === "teacher");
    setIsAdmin(role === "admin");
  };

  const fetchSentences = async () => {
    const { data, error } = await supabase
      .from("sentences")
      .select("*, classes!sentences_class_id_fkey (name, date)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setSentences(data || []);
  };

  const { register, handleSubmit, reset } = useForm<SentenceFormData>({
    resolver: zodResolver(sentenceSchema),
  });

  const onAddSentence = async (data: SentenceFormData) => {
    if (!user) return;

    setFormState("submitting");

    const lesson = await ensureClassForDate(date);
    if (lesson.error) {
      console.error(lesson.error);
      setFormState("error");
      return;
    }

    const { error } = await supabase
      .from("sentences")
      .insert({
        chinese_sentence: data.chineseSentence,
        pinyin: data.pinyin,
        khmer_translation: data.khmerTranslation,
        english_translation: data.englishTranslation,
        audio_url: data.audioUrl,
        class_id: lesson.id,
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

    await fetchSentences();
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

    await fetchSentences();
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

          {isStaff && (
            <Button variant="primary" type="button" onClick={() => setIsAdding(true)}>
              + Add Sentence
            </Button>
          )}
        </div>

        {favoriteError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{favoriteError}</p>}

        {formState === "error" && (
          <div className="mb-4 rounded-md border border-destructive p-3 text-destructive">
            Failed to save sentence. Please try again.
          </div>
        )}

        {isStaff && isAdding && (
          <form onSubmit={handleSubmit(onAddSentence)} className="mb-6 space-y-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-lg font-semibold">Add sentence</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Lesson date
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2" />
                <span className="mt-1 block text-xs text-muted-foreground">Sentences saved on this date are shared with all students.</span>
              </label>
            </div>
            <textarea {...register("chineseSentence")} required placeholder="Chinese sentence" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input {...register("pinyin")} placeholder="Pinyin" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("khmerTranslation")} placeholder="Khmer translation" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("englishTranslation")} placeholder="English translation" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("audioUrl")} placeholder="Audio URL (optional)" className="rounded-md border border-input bg-background px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={formState === "submitting" || !date}>{formState === "submitting" ? "Saving..." : "Save Sentence"}</Button>
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
                  <th className="p-3 text-left">Lesson date</th>
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
                      {sentence.classes?.date || sentence.class_name || "—"}
                    </td>

                    <td className="p-3 flex gap-2">
                      <button
                        type="button"
                        disabled={!favoritesReady || pendingFavorites.has(sentence.id)}
                        onClick={() => void toggleSentenceFavorite(sentence.id)}
                        aria-pressed={favoriteSentences.has(sentence.id)}
                        aria-label={`${favoriteSentences.has(sentence.id) ? 'Remove' : 'Save'} sentence ${favoriteSentences.has(sentence.id) ? 'from' : 'to'} favorites`}
                        className={`rounded-lg p-2 disabled:opacity-50 ${favoriteSentences.has(sentence.id) ? 'text-red-500' : 'text-slate-400'}`}
                      >
                        <Heart size={20} fill={favoriteSentences.has(sentence.id) ? 'currentColor' : 'none'} />
                      </button>
                      {isAdmin ? (
                        <>
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
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Admin only
                        </span>
                      )}
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
