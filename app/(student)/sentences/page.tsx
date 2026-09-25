"use client";

import { useState, useEffect, useRef } from "react";
import { Heart, Upload, AlertCircle, CheckCircle, Loader2, Volume2, X, Edit2, Trash2, Sparkles } from "lucide-react";
import { fetchFavoriteIds, toggleFavorite } from "@/lib/favorites";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EmptyState } from "@/components/ui/empty-state";
import { parseCSV, parseExcel, mapSentenceRow, type SentenceImportRow } from '@/lib/import';
import { fetchSentenceAutofill } from '@/lib/ai-autofill';

const sentenceSchema = z.object({
  chineseSentence: z.string().min(1, "Sentence is required"),
  pinyin: z.string().optional(),
  khmerTranslation: z.string().optional(),
  englishTranslation: z.string().optional(),
  audioUrl: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
});

type SentenceFormData = z.infer<typeof sentenceSchema>;

const speakWithSynthesis = (text: string) => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
};

const speak = (text: string, audioUrl?: string | null) => {
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => {
        speakWithSynthesis(text);
      });
      return;
    } catch {
      speakWithSynthesis(text);
      return;
    }
  }
  speakWithSynthesis(text);
};

const isWithinLast24Hours = (createdAt?: string | null) => {
  if (!createdAt) return false;
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return false;
  const now = Date.now();
  return now - time <= 24 * 60 * 60 * 1000 && now - time >= 0;
};

export default function SentencesPage() {
  const router = useRouter();

  const [user, setUser] = useState<string | null>(null);
  const [sentences, setSentences] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSentence, setEditingSentence] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    chineseSentence: "",
    pinyin: "",
    khmerTranslation: "",
    englishTranslation: "",
    audioUrl: "",
    classId: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [favoriteSentences, setFavoriteSentences] = useState<Set<string>>(new Set());
  const [favoriteError, setFavoriteError] = useState("");
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [pendingFavorites, setPendingFavorites] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(0);
  const [isAutofillingAdd, setIsAutofillingAdd] = useState(false);
  const [isAutofillingEdit, setIsAutofillingEdit] = useState(false);
  const pendingFavoriteIds = useRef(new Set<string>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ITEMS_PER_PAGE = 12;

  const handleImport = async (file: File) => {
    if (!user) { setImportError('Please sign in first.'); return; }
    setImporting(true);
    setImportError('');
    setImportSuccess(0);
    try {
      let rows: string[][];
      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        rows = parseCSV(text);
      } else {
        rows = await parseExcel(file);
      }
      if (rows.length < 2) { setImportError('File must have header + at least 1 row.'); return; }
      const headers = rows[0];
      const dataRows = rows.slice(1);
      const validRows: SentenceImportRow[] = [];
      for (const row of dataRows) {
        const mapped = mapSentenceRow(row, headers);
        if (mapped) validRows.push(mapped);
      }
      if (validRows.length === 0) { setImportError('No valid sentences found. Check column names.'); return; }

      const inserts = validRows.map(s => ({
        chinese_sentence: s.chinese_sentence,
        pinyin: s.pinyin || null,
        khmer_translation: s.khmer_translation || null,
        english_translation: s.english_translation || null,
        class_id: s.class_id || null,
        user_id: user,
      }));

      const { error } = await supabase.from('sentences').insert(inserts as any);
      if (error) throw error;
      setImportSuccess(validRows.length);
      setSentences((current) => [...validRows.map((s, i) => ({ 
        id: `temp-${Date.now()}-${i}`,
        chinese_sentence: s.chinese_sentence,
        pinyin: s.pinyin || '',
        khmer_translation: s.khmer_translation || '',
        english_translation: s.english_translation || '',
        classes: { name: s.class_id || 'Imported' },
      })), ...current]);
    } catch (e: any) {
      setImportError(e.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [formState, setFormState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, date")
      .order("name", { ascending: true })
      .order("date", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setClasses(data || []);
  };

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

    await fetchClasses();
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

  const { register, handleSubmit, reset, watch, setValue } = useForm<SentenceFormData>({
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
        class_id: data.classId,
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

  const startEditing = (sentence: any) => {
    setEditingSentence(sentence);
    setEditFormData({
      chineseSentence: sentence.chinese_sentence || "",
      pinyin: sentence.pinyin || "",
      khmerTranslation: sentence.khmer_translation || "",
      englishTranslation: sentence.english_translation || "",
      audioUrl: sentence.audio_url || "",
      classId: sentence.class_id || "",
    });
    setEditError("");
  };

  const saveEditSentence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSentence || !editFormData.chineseSentence.trim()) return;

    setIsSavingEdit(true);
    setEditError("");

    const { error } = await (supabase.from("sentences") as any)
      .update({
        chinese_sentence: editFormData.chineseSentence.trim(),
        pinyin: editFormData.pinyin.trim() || null,
        khmer_translation: editFormData.khmerTranslation.trim() || null,
        english_translation: editFormData.englishTranslation.trim() || null,
        audio_url: editFormData.audioUrl.trim() || null,
        class_id: editFormData.classId || null,
      })
      .eq("id", editingSentence.id);

    setIsSavingEdit(false);

    if (error) {
      setEditError(error.message || "Failed to update sentence.");
      return;
    }

    setEditingSentence(null);
    await fetchSentences();
  };

  const handleAutofillAdd = async () => {
    const text = (watch("chineseSentence") || "").trim();
    if (!text) {
      setFavoriteError("Please enter a Chinese sentence first.");
      return;
    }
    setIsAutofillingAdd(true);
    setFavoriteError("");
    try {
      const res = await fetchSentenceAutofill(text);
      if (res.error) {
        setFavoriteError(res.error);
        return;
      }
      if (res.data) {
        setValue("pinyin", res.data.pinyin, { shouldValidate: true, shouldDirty: true });
        setValue("khmerTranslation", res.data.khmerTranslation, { shouldValidate: true, shouldDirty: true });
        setValue("englishTranslation", res.data.englishTranslation, { shouldValidate: true, shouldDirty: true });
      }
    } catch (err: any) {
      setFavoriteError(err.message || "Failed to auto-fill sentence");
    } finally {
      setIsAutofillingAdd(false);
    }
  };

  const handleAutofillEdit = async () => {
    const text = (editFormData.chineseSentence || "").trim();
    if (!text) {
      setEditError("Please enter a Chinese sentence first.");
      return;
    }
    setIsAutofillingEdit(true);
    setEditError("");
    try {
      const res = await fetchSentenceAutofill(text);
      if (res.error) {
        setEditError(res.error);
        return;
      }
      if (res.data) {
        setEditFormData(prev => ({
          ...prev,
          pinyin: res.data?.pinyin || prev.pinyin,
          khmerTranslation: res.data?.khmerTranslation || prev.khmerTranslation,
          englishTranslation: res.data?.englishTranslation || prev.englishTranslation,
        }));
      }
    } catch (err: any) {
      setEditError(err.message || "Failed to auto-fill sentence");
    } finally {
      setIsAutofillingEdit(false);
    }
  };

  const deleteSentence = async (sentenceId: string, sentenceText?: string) => {
    const label = sentenceText ? `"${sentenceText}"` : "this sentence";
    if (!window.confirm(`Are you sure you want to delete ${label}? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabase
      .from("sentences")
      .delete()
      .eq("id", sentenceId);

    if (error) {
      console.error(error);
      setFavoriteError(error.message || "Failed to delete sentence");
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

          <div className="flex flex-wrap gap-2">
            {isStaff && (
              <Button variant="primary" type="button" onClick={() => setIsAdding(true)}>
                + Add Sentence
              </Button>
            )}
            <label className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 cursor-pointer hover:bg-sky-100">
              <Upload size={17} />
              <span>Import CSV/Excel</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
                className="hidden"
                disabled={importing}
              />
            </label>
            {importSuccess > 0 && (
              <span className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle size={16} /> Imported {importSuccess} sentences
              </span>
            )}
          </div>
        </div>

        {favoriteError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{favoriteError}</p>}
        {importError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2"><AlertCircle size={16} />{importError}</p>}
        {importing && <p className="mb-4 text-sm text-sky-600 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Importing...</p>}

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
                Class
                <Select
                  value={watch("classId") || ""}
                  options={[
                    { value: "", label: "Select a class" },
                    ...classes.map((cls: any) => ({
                      value: cls.id,
                      label: cls.date ? `${cls.date} — ${cls.name}` : cls.name,
                    })),
                  ]}
                  onChange={(event) => {
                    const value = event.target.value;
                    setValue("classId", value || undefined);
                  }}
                  required
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Sentences are assigned to this class and shared with its students.
                </span>
              </label>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Chinese Sentence *</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isAutofillingAdd}
                  onClick={handleAutofillAdd}
                  className="h-7 text-xs px-2.5 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 hover:from-violet-500/20 hover:to-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                >
                  {isAutofillingAdd ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-indigo-600" />
                      <span>AI Auto-filling...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                      <span>✨ AI Auto-fill (Gemini)</span>
                    </>
                  )}
                </Button>
              </div>
              <textarea {...register("chineseSentence")} required placeholder="Chinese sentence" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input {...register("pinyin")} placeholder="Pinyin" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("khmerTranslation")} placeholder="Khmer translation" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("englishTranslation")} placeholder="English translation" className="rounded-md border border-input bg-background px-3 py-2" />
              <input {...register("audioUrl")} placeholder="Audio URL (optional)" className="rounded-md border border-input bg-background px-3 py-2" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={formState === "submitting" || !watch("classId")}>{formState === "submitting" ? "Saving..." : "Save Sentence"}</Button>
              <Button type="button" variant="outline" onClick={() => { setIsAdding(false); reset(); }}>Cancel</Button>
            </div>
          </form>
        )}

        {/* Edit Sentence Modal */}
        {editingSentence && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Edit2 size={18} className="text-[#b91c1c]" /> Edit Sentence
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingSentence(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-stone-100 hover:text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>

              {editError && (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {editError}
                </p>
              )}

              <form onSubmit={saveEditSentence} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Class</label>
                  <select
                    value={editFormData.classId}
                    onChange={(e) => setEditFormData({ ...editFormData, classId: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {classes.map((cls: any) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.date ? `${cls.date} — ${cls.name}` : cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium">Chinese Sentence *</label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isAutofillingEdit}
                        onClick={handleAutofillEdit}
                        className="h-7 text-xs px-2 bg-gradient-to-r from-violet-500/10 to-indigo-500/10 hover:from-violet-500/20 hover:to-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                      >
                        {isAutofillingEdit ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin text-indigo-600" />
                            <span>Auto-filling...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1 text-indigo-600 dark:text-indigo-400" />
                            <span>✨ AI Auto-fill</span>
                          </>
                        )}
                      </Button>
                      <button
                        type="button"
                        onClick={() => speak(editFormData.chineseSentence, editFormData.audioUrl)}
                        className="inline-flex items-center gap-1 text-xs text-[#b91c1c] font-semibold hover:underline"
                      >
                        <Volume2 size={14} /> Test voice
                      </button>
                    </div>
                  </div>
                  <textarea
                    required
                    value={editFormData.chineseSentence}
                    onChange={(e) => setEditFormData({ ...editFormData, chineseSentence: e.target.value })}
                    className="w-full min-h-20 rounded-xl border border-stone-200 p-3 text-base"
                    placeholder="Enter Chinese sentence..."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Pinyin</label>
                    <input
                      type="text"
                      value={editFormData.pinyin}
                      onChange={(e) => setEditFormData({ ...editFormData, pinyin: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                      placeholder="Pinyin"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Khmer Translation</label>
                    <input
                      type="text"
                      value={editFormData.khmerTranslation}
                      onChange={(e) => setEditFormData({ ...editFormData, khmerTranslation: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                      placeholder="Khmer translation"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">English Translation</label>
                    <input
                      type="text"
                      value={editFormData.englishTranslation}
                      onChange={(e) => setEditFormData({ ...editFormData, englishTranslation: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                      placeholder="English translation"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Audio URL (optional)</label>
                    <input
                      type="text"
                      value={editFormData.audioUrl}
                      onChange={(e) => setEditFormData({ ...editFormData, audioUrl: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingSentence(null)}
                    disabled={isSavingEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSavingEdit || !editFormData.chineseSentence.trim()}
                  >
                    {isSavingEdit ? "Saving Changes..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {sentences.length === 0 ? (
          <EmptyState>
            <p>No sentences yet</p>
            <p className="text-sm mt-2">
              Add your first sentence to get started
            </p>
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="p-3 text-left">Sentence</th>
                    <th className="p-3 text-left">Pinyin</th>
                    <th className="p-3 text-left">Khmer</th>
                    <th className="p-3 text-left">English</th>
                    <th className="p-3 text-left">Class</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100">
                  {sentences
                    .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                    .map((sentence: any) => (
                      <tr
                        key={sentence.id}
                        className="hover:bg-stone-50/70 transition"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => speak(sentence.chinese_sentence, sentence.audio_url)}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-[#b91c1c] transition shrink-0"
                              title="Listen to sentence"
                              aria-label="Listen"
                            >
                              <Volume2 size={18} />
                            </button>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-base text-slate-900">
                                {sentence.chinese_sentence}
                              </span>
                              {isWithinLast24Hours(sentence.created_at) && (
                                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#b91c1c] border border-red-200 animate-pulse shrink-0">
                                  NEW
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="p-3 text-sm text-[#b91c1c] font-medium">
                          {sentence.pinyin || "—"}
                        </td>

                        <td className="p-3 text-sm text-slate-700">
                          {sentence.khmer_translation || "—"}
                        </td>

                        <td className="p-3 text-sm text-slate-600">
                          {sentence.english_translation || "—"}
                        </td>

                        <td className="p-3 text-sm text-slate-500">
                          {sentence.classes?.name ||
                            sentence.classes?.date ||
                            sentence.class_name ||
                            "—"}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={!favoritesReady || pendingFavorites.has(sentence.id)}
                              onClick={() => void toggleSentenceFavorite(sentence.id)}
                              aria-pressed={favoriteSentences.has(sentence.id)}
                              aria-label={`${favoriteSentences.has(sentence.id) ? 'Remove' : 'Save'} sentence ${favoriteSentences.has(sentence.id) ? 'from' : 'to'} favorites`}
                              className={`rounded-lg p-1.5 transition disabled:opacity-50 ${favoriteSentences.has(sentence.id) ? 'text-red-500 hover:bg-red-50' : 'text-slate-400 hover:bg-stone-100 hover:text-slate-600'}`}
                              title={favoriteSentences.has(sentence.id) ? "Remove favorite" : "Add to favorites"}
                            >
                              <Heart size={18} fill={favoriteSentences.has(sentence.id) ? 'currentColor' : 'none'} />
                            </button>

                            {(isStaff || isAdmin || sentence.user_id === user) ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  type="button"
                                  onClick={() => startEditing(sentence)}
                                  className="h-8 px-2.5 text-xs"
                                >
                                  <Edit2 size={13} className="mr-1" /> Edit
                                </Button>

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  type="button"
                                  onClick={() => deleteSentence(sentence.id, sentence.chinese_sentence)}
                                  className="h-8 px-2.5 text-xs"
                                >
                                  <Trash2 size={13} className="mr-1" /> Delete
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {Math.ceil(sentences.length / ITEMS_PER_PAGE) > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-50"
                >
                  Previous
                </button>
                <span className="text-sm font-medium text-slate-700">
                  Page {currentPage} of {Math.ceil(sentences.length / ITEMS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(Math.ceil(sentences.length / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage === Math.ceil(sentences.length / ITEMS_PER_PAGE)}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-stone-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
