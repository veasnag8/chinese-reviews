"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, CheckCircle, Loader2, X, Table, Download, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EmptyState } from "@/components/ui/empty-state";
import { todayISO } from "@/lib/schedule";
import { parseCSV, parseExcel, mapWordRow, type WordImportRow, exportToCSV, exportToExcel } from '@/lib/import';
import { useToasts } from '@/components/ui/toast';

const wordSchema = z.object({
  chinese: z.string().min(1, "Chinese is required"),
  pinyin: z.string().optional(),
  khmer: z.string().optional(),
  english: z.string().optional(),
  partOfSpeech: z.string().optional(),
  exampleSentence: z.string().optional(),
  examplePinyin: z.string().optional(),
  exampleKhmer: z.string().optional(),
  category: z.string().optional(),
  className: z.string().min(1, "Class is required"),
  date: z.string().min(1, "Lesson date is required"),
});

type WordFormData = z.infer<typeof wordSchema>;

export default function AdminWordsPage() {
  const [user, setUser] = useState<string | null>(null);
  const [access, setAccess] = useState<"checking" | "allowed" | "denied">("checking");
  const [isAdmin, setIsAdmin] = useState(false);
  const [words, setWords] = useState<any[]>([]);
  const [formState, setFormState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingWord, setEditingWord] = useState<any | null>(null);

  // Import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importPreview, setImportPreview] = useState<WordImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<{ row: number; error: string }[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast notifications
  const { push: toast } = useToasts();

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchWords();
    }
  }, [user]);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      setAccess("denied");
      return;
    }

    setUser(data.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    const role = (profile as { role?: string } | null)?.role;
    setIsAdmin(role === "admin");
    setAccess(
      role === "admin" || role === "teacher" ? "allowed" : "denied"
    );
  };

  const [classes, setClasses] = useState<any[]>([]);
  const [classNames, setClassNames] = useState<string[]>([]);

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
    const uniqueNames = [...new Set(data?.map((c: any) => c.name).filter(Boolean))].sort();
    setClassNames(uniqueNames);
  };

  const fetchWords = async () => {
    const { data, error } = await supabase
      .from("words")
      .select(`
        *,
        classes!words_class_id_fkey (name, date)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setWords(data || []);
  };

  useEffect(() => {
    if (user) {
      fetchClasses();
    }
  }, [user]);

  const [search, setSearch] = useState("");
  const { register, handleSubmit, reset, setValue, watch } = useForm<WordFormData>({
    resolver: zodResolver(wordSchema),
    defaultValues: {
      className: "",
      date: todayISO(),
    },
  });

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return words;

    return words.filter((word: any) =>
      [word.chinese, word.pinyin, word.khmer, word.english, word.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, words]);

const getOrCreateClass = async (name: string, date: string) => {
    if (!supabase) return { id: null, error: 'Supabase not configured' };

    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('name', name)
      .eq('date', date)
      .maybeSingle();

    if (existing && typeof existing === 'object' && 'id' in existing) {
      return { id: (existing as { id: string }).id };
    }

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return { id: null, error: 'Not authenticated' };

    const { data: created, error } = await supabase
      .from('classes')
      .insert({ name, date, user_id: auth.user.id } as any)
      .select('id')
      .single();

    if (error) return { id: null, error: error.message };
    return { id: (created as { id: string } | null)?.id ?? null };
  };

  const resolveClassId = async (className: string | undefined, classDate: string | undefined): Promise<string | null> => {
    if (!className || !supabase) return null;
    // Try to find by name only first
    const { data: existing } = await supabase
      .from('classes')
      .select('id, date')
      .eq('name', className)
      .maybeSingle();
    if (existing && typeof existing === 'object' && 'id' in existing) {
      return (existing as { id: string }).id;
    }
    // If date provided, try to create with name+date
    if (classDate) {
      const result = await getOrCreateClass(className, classDate);
      return result.id;
    }
    return null;
  };

  const onWordSubmit = async (data: WordFormData) => {
    if (!user) return;

    setFormState("submitting");
    setErrorMessage("");

    const classResult = await getOrCreateClass(data.className, data.date);
    if (classResult.error) {
      setErrorMessage(classResult.error);
      setFormState("error");
      return;
    }

    const { error } = await supabase
      .from("words")
      .insert({
        chinese: data.chinese,
        pinyin: data.pinyin,
        khmer: data.khmer,
        english: data.english,
        part_of_speech: data.partOfSpeech,
        example_sentence: data.exampleSentence,
        example_pinyin: data.examplePinyin,
        example_khmer: data.exampleKhmer,
        category: data.category,
        class_id: classResult.id,
        user_id: user,
      } as any);

    if (error) {
      console.error("Word update failed", error);
      setErrorMessage(error.message || JSON.stringify(error));
      setFormState("error");
      return;
    }

    setFormState("success");
    reset();
    setEditingWord(null);

    await fetchWords();
  };

const onWordUpdate = async (data: WordFormData) => {
    if (!editingWord?.id) return;

    setFormState("submitting");
    setErrorMessage("");

    const classResult = await getOrCreateClass(data.className, data.date);
    if (classResult.error) {
      setErrorMessage(classResult.error);
      setFormState("error");
      return;
    }

    const { error } = await (supabase.from("words") as any)
      .update({
        chinese: data.chinese,
        pinyin: data.pinyin,
        khmer: data.khmer,
        english: data.english,
        part_of_speech: data.partOfSpeech,
        example_sentence: data.exampleSentence,
        example_pinyin: data.examplePinyin,
        example_khmer: data.exampleKhmer,
        category: data.category,
        class_id: classResult.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingWord.id);

    if (error) {
      console.error(error);
      setErrorMessage(error.message);
      setFormState("error");
      return;
    }

    setFormState("success");
    setIsEditing(false);
    setEditingWord(null);
    reset();

    await fetchWords();
  };

  const deleteWord = async (wordId: string) => {
    const { error } = await supabase
      .from("words")
      .delete()
      .eq("id", wordId);

    if (error) {
      console.error(error);
      return;
    }

    await fetchWords();
  };

  const handleFileSelect = async (file: File) => {
    if (!user) { setImportError('Please sign in first.'); return; }
    setImportError('');
    setImportPreview([]);
    setImportErrors([]);
    setImportHeaders([]);
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
      const validRows: WordImportRow[] = [];
      const errors: { row: number; error: string }[] = [];

      // Pre-fetch all unique class names to resolve in batch
      const classNames = new Set<string>();
      dataRows.forEach((row) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h.toLowerCase().trim()] = row[i]?.trim() || ''; });
        const className = obj['class'] || obj['class_name'] || obj['classname'] || '';
        if (className) classNames.add(className);
      });

      // Resolve all class names to IDs
      const classNameToId = new Map<string, string | null>();
      for (const className of classNames) {
        const classId = await resolveClassId(className, undefined);
        classNameToId.set(className, classId);
      }

      dataRows.forEach((row, idx) => {
        const rowNum = idx + 2; // +2 for 1-based header + data offset
        const mapped = mapWordRow(row, headers);
        if (mapped) {
          // Resolve class_id from class name
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h.toLowerCase().trim()] = row[i]?.trim() || ''; });
          const className = obj['class'] || obj['class_name'] || obj['classname'] || '';
          if (className && classNameToId.has(className)) {
            mapped.class_id = classNameToId.get(className) || undefined;
          }
          validRows.push(mapped);
        } else {
          // Check what's missing
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h.toLowerCase().trim()] = row[i]?.trim() || ''; });
          const chinese = obj['chinese'] || obj['word'] || obj['hanzi'] || '';
          if (!chinese) {
            errors.push({ row: rowNum, error: 'Missing required "Chinese" column' });
          } else {
            errors.push({ row: rowNum, error: 'Invalid row data' });
          }
        }
      });
      if (validRows.length === 0) { 
        const errMsg = errors.length > 0 ? `All ${errors.length} rows failed. First error: ${errors[0].error}` : 'No valid words found. Check column names.';
        setImportError(errMsg);
        setImportErrors(errors);
        toast({ title: 'Import Failed', message: errMsg });
        return; 
      }
      setImportHeaders(headers);
      setImportPreview(validRows);
      setImportErrors(errors);
      setShowImportDialog(true);
      toast({ title: 'File Ready', message: `${validRows.length} valid words found. Review and click Import.` });
    } catch (e: any) {
      const errMsg = e.message || 'Failed to parse file';
      setImportError(errMsg);
      toast({ title: 'Error', message: errMsg });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    if (!user || importPreview.length === 0) return;
    setImporting(true);
    setImportError('');
    try {
      const inserts = importPreview.map(w => ({
        chinese: w.chinese,
        pinyin: w.pinyin || null,
        khmer: w.khmer || null,
        english: w.english || null,
        hsk_level: w.hsk_level || null,
        class_id: w.class_id || null, // Already resolved during preview
        user_id: user,
      }));
      const { error } = await supabase.from('words').insert(inserts as any);
      if (error) {
        // Try individual inserts to find which rows fail
        const insertErrors: { row: number; error: string }[] = [];
        for (let i = 0; i < inserts.length; i++) {
          const { error: rowError } = await supabase.from('words').insert(inserts[i] as any);
          if (rowError) {
            insertErrors.push({ row: i + 1, error: rowError.message });
          }
        }
        if (insertErrors.length > 0) {
          setImportErrors(insertErrors);
          const errMsg = `${insertErrors.length} of ${inserts.length} rows failed. See details below.`;
          setImportError(errMsg);
          toast({ title: 'Partial Import', message: errMsg });
        } else {
          throw error;
        }
      } else {
        setShowImportDialog(false);
        setImportPreview([]);
        setImportHeaders([]);
        setImportErrors([]);
        await fetchWords();
        toast({ title: 'Success', message: `Imported ${importPreview.length} words!` });
      }
    } catch (e: any) {
      const errMsg = e.message || 'Import failed';
      setImportError(errMsg);
      toast({ title: 'Import Failed', message: errMsg });
    } finally {
      setImporting(false);
    }
  };

  const startAdd = () => {
    setEditingWord(null);
    setIsEditing(true);
    setFormState("idle");
    reset({ className: "", date: todayISO() });
  };

  if (access === "checking") {
    return null;
  }

  if (access === "denied") {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          Only teachers and admins can manage words. Ask your teacher to add
          words for your lesson date.
        </div>
      </div>
    );
  }

  // Import Preview Dialog (renders as modal overlay)
  if (showImportDialog) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b p-4">
            <h3 className="text-lg font-semibold">Import Preview — {importPreview.length} words</h3>
            <button onClick={() => setShowImportDialog(false)} className="p-2 hover:bg-muted rounded-lg"><X size={20} /></button>
          </div>
          {importError && (
            <div className="border-b border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle size={16} /> {importError}
            </div>
          )}
          {importErrors.length > 0 && (
            <div className="border-b border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                <AlertCircle size={16} /> {importErrors.length} row error(s) — fix in Excel and re-import
              </div>
              <div className="max-h-40 overflow-auto text-sm">
                {importErrors.slice(0, 20).map((e, i) => (
                  <div key={i} className="text-amber-800 font-mono">Row {e.row}: {e.error}</div>
                ))}
                {importErrors.length > 20 && <div className="text-amber-600">... and {importErrors.length - 20} more</div>}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto p-4">
            {importPreview.length > 0 && (
              <Table>
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-2">#</th>
                    <th className="p-2">Chinese</th>
                    <th className="p-2">Pinyin</th>
                    <th className="p-2">Khmer</th>
                    <th className="p-2">English</th>
                    <th className="p-2">HSK</th>
                    <th className="p-2">Class ID</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-sm">{i + 1}</td>
                      <td className="p-2 text-lg font-bold">{row.chinese}</td>
                      <td className="p-2 text-sm">{row.pinyin || '—'}</td>
                      <td className="p-2 text-sm">{row.khmer || '—'}</td>
                      <td className="p-2 text-sm">{row.english || '—'}</td>
                      <td className="p-2 text-sm">{row.hsk_level ? `HSK ${row.hsk_level}` : '—'}</td>
                      <td className="p-2 text-sm">{row.class_id || '—'}</td>
                    </tr>
                  ))}
                  {importPreview.length > 100 && (
                    <tr>
                      <td colSpan={7} className="p-2 text-center text-muted-foreground">
                        ... and {importPreview.length - 100} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            )}
          </div>
          <div className="border-t p-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing ? (<><Loader2 size={16} className="animate-spin mr-2" /> Importing...</>) : (`Import ${importPreview.length} Words`)}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="pointer-events-none fixed right-4 top-20 z-50">
        <div className="flex flex-col gap-2">
          {importError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/95 p-4 shadow-lg">
              <AlertCircle className="mt-0.5 size-8 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-800">Import Error</p>
                <p className="mt-0.5 text-xs text-red-700">{importError}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            Manage Words
          </h2>

          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700 cursor-pointer hover:bg-sky-100"
              onClick={() => { if (fileInputRef.current) fileInputRef.current.value = ''; }}
            >
              <Upload size={17} />
              <span>Import CSV/Excel</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
                disabled={importing}
              />
            </label>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                const headers = ['Chinese', 'Pinyin', 'Khmer', 'English', 'HSK Level', 'Class'];
                const data = filteredWords.map(w => ({
                  Chinese: w.chinese,
                  Pinyin: w.pinyin || '',
                  Khmer: w.khmer || '',
                  English: w.english || '',
                  'HSK Level': w.hsk?.replace('HSK ', '') || '',
                  Class: w.className || '',
                }));
                const csv = exportToCSV(data, headers);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `words-export-${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                URL.revokeObjectURL(link.href);
                toast({ title: 'Exported', message: `Downloaded ${filteredWords.length} words as CSV` });
              }}
            >
              <Download size={17} />
              <span>Export CSV</span>
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                const headers = ['Chinese', 'Pinyin', 'Khmer', 'English', 'HSK Level', 'Class'];
                const data = filteredWords.map(w => ({
                  Chinese: w.chinese,
                  Pinyin: w.pinyin || '',
                  Khmer: w.khmer || '',
                  English: w.english || '',
                  'HSK Level': w.hsk?.replace('HSK ', '') || '',
                  Class: w.className || '',
                }));
                exportToExcel(data, headers, `words-export-${new Date().toISOString().split('T')[0]}.xlsx`);
                toast({ title: 'Exported', message: `Downloaded ${filteredWords.length} words as Excel (Khmer supported)` });
              }}
            >
              <Download size={17} />
              <span>Export Excel</span>
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={startAdd}
            >
              + Add Word
            </Button>
          </div>
        </div>

        {isEditing && (
          <Card className="max-w-2xl p-6">
            <h3 className="text-lg font-medium mb-4">
              {editingWord ? "Edit Word" : "Add New Word"}
            </h3>

            <form
              onSubmit={handleSubmit(
                editingWord
                  ? onWordUpdate
                  : onWordSubmit
              )}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-2">
                  Chinese
                </label>

                <Input
                  placeholder="Enter Chinese character(s)"
                  {...register("chinese")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Pinyin
                  </label>

                  <Input
                    placeholder="Enter pinyin"
                    {...register("pinyin")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Khmer
                  </label>

                  <Input
                    placeholder="Enter Khmer translation"
                    {...register("khmer")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    English
                  </label>

                  <Input
                    placeholder="Enter English translation"
                    {...register("english")}
                  />
                </div>
<div className="grid grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-2">
                    Class
                  </label>
                  <Select
                    value={watch("className") || ""}
                    options={[
                      { value: "", label: "Select a class" },
                      ...classNames.map((name) => ({ value: name, label: name })),
                    ]}
                    onChange={(event) => {
                      const value = event.target.value;
                      setValue("className", value || undefined);
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Lesson Date
                  </label>
                  <Input
                    type="date"
                    {...register("date")}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Words with this class name and date will be grouped together.
                  </p>
                </div>
              </div>
            </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Category
                </label>

                <Input
                  placeholder="Enter category"
                  {...register("category")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Part of Speech
                </label>

                <Input
                  placeholder="e.g., noun, verb"
                  {...register("partOfSpeech")}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={formState === "submitting"}
                >
                  {formState === "submitting"
                    ? "Saving..."
                    : editingWord
                      ? "Update Word"
                      : "Save Word"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingWord(null);
                    reset();
                  }}
                >
                  Cancel
                </Button>
              </div>

              {formState === "success" && (
                <p className="text-sm text-success mt-2">
                  Word saved successfully!
                </p>
              )}

              {formState === "error" && (
                <p className="mt-2 text-sm text-destructive">
                  Failed to save word: {errorMessage || "Please try again."}
                </p>
              )}
            </form>
          </Card>
        )}

        <div className="mt-6">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Words List</h3>
              <p className="text-sm text-muted-foreground">
                {filteredWords.length} of {words.length} words
              </p>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Chinese, Pinyin, Khmer, or English"
              className="sm:max-w-sm"
            />
          </div>

          {words.length === 0 ? (
            <EmptyState>
              <p>No words yet</p>
              <p className="text-sm mt-2">
                Words will appear here once added
              </p>
            </EmptyState>
          ) : filteredWords.length === 0 ? (
            <EmptyState>
              <p>No matching words</p>
              <p className="text-sm mt-2">Try another search term.</p>
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-card">
                    <th className="p-3 text-left">Chinese</th>
                    <th className="p-3 text-left">Pinyin</th>
                    <th className="p-3 text-left">Khmer</th>
                    <th className="p-3 text-left">English</th>
                    <th className="p-3 text-left">Class</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredWords.map((word: any) => (
                    <tr
                      key={word.id}
                      className="hover:bg-muted/50"
                    >
                      <td className="p-3">
                        {word.chinese}
                      </td>

                      <td className="p-3">
                        {word.pinyin || "—"}
                      </td>

                      <td className="p-3">
                        {word.khmer || "—"}
                      </td>

                      <td className="p-3">
                        {word.english || "—"}
                      </td>

                      <td className="p-3">
                        {word.classes?.name ||
                          word.classes?.date ||
                          word.class_name ||
                          "—"}
                      </td>

                      <td className="p-3 flex gap-2">
                        {isAdmin ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              onClick={() => {
                                setEditingWord(word);
                                setIsEditing(true);
                                setFormState("idle");

reset({
                              chinese: word.chinese || "",
                              pinyin: word.pinyin || "",
                              khmer: word.khmer || "",
                              english: word.english || "",
                              partOfSpeech:
                                word.part_of_speech || "",
                              exampleSentence:
                                word.example_sentence || "",
                              examplePinyin:
                                word.example_pinyin || "",
                              exampleKhmer:
                                word.example_khmer || "",
                              category: word.category || "",
                              className: word.classes?.name || "",
                              date: word.classes?.date || todayISO(),
                            });
                              }}
                            >
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              type="button"
                              onClick={() =>
                                deleteWord(word.id)
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
    </div>
  );
}
