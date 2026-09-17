"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { EmptyState } from "@/components/ui/empty-state";

const wordSchema = z.object({
  chinese: z.string().min(1, "Chinese is required"),
  pinyin: z.string().optional(),
  khmer: z.string().optional(),
  english: z.string().optional(),
  partOfSpeech: z.string().optional(),
  exampleSentence: z.string().optional(),
  examplePinyin: z.string().optional(),
  exampleKhmer: z.string().optional(),
  hskLevel: z.number().optional(),
  category: z.string().optional(),
  classId: z.string().optional(),
});

type WordFormData = z.infer<typeof wordSchema>;

export default function AdminWordsPage() {
  const [user, setUser] = useState<string | null>(null);
  const [words, setWords] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [formState, setFormState] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingWord, setEditingWord] = useState<any | null>(null);

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchWords();
      fetchClasses();
    }
  }, [user]);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return;
    }

    setUser(data.user.id);
  };

  const fetchWords = async () => {
    const { data, error } = await supabase
      .from("words")
      .select(`
        *,
        classes!words_class_id_fkey (name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setWords(data || []);
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, date")
      .order("date", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setClasses(data || []);
  };

  const [search, setSearch] = useState("");
  const { register, handleSubmit, reset, setValue, watch } = useForm<WordFormData>({
    resolver: zodResolver(wordSchema),
    defaultValues: {
      classId: "",
      hskLevel: undefined,
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

  const onWordSubmit = async (data: WordFormData) => {
    if (!user) return;

    setFormState("submitting");
    setErrorMessage("");

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
        hsk_level: data.hskLevel,
        category: data.category,
        class_id: data.classId,
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
        hsk_level: data.hskLevel,
        category: data.category,
        class_id: data.classId,
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

  const startAdd = () => {
    setEditingWord(null);
    setIsEditing(true);
    setFormState("idle");
    reset();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            Manage Words
          </h2>

          <Button
            variant="primary"
            type="button"
            onClick={startAdd}
          >
            + Add Word
          </Button>
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

                <div>
                  <label className="block text-sm font-medium mb-2">
                  Lesson date
                  </label>

                  <Select
                    value={watch("classId") || ""}
                    options={[
                      { value: "", label: "Select a lesson date" },
                      ...classes.map((cls: any) => ({
                        value: cls.id,
                        label: cls.date ? `${cls.date} — ${cls.name}` : cls.name,
                      })),
                    ]}
                    onChange={(event) => {
                      const value = event.target.value;
                      setValue("classId", value || undefined);
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  HSK Level
                </label>

                <Select
                  value={
                    watch("hskLevel") === undefined
                      ? ""
                      : String(watch("hskLevel"))
                  }
                  options={[
                    { value: "", label: "Select an HSK level" },
                    { value: "0", label: "Foundation" },
                    { value: "1", label: "HSK 1" },
                    { value: "2", label: "HSK 2" },
                    { value: "3", label: "HSK 3" },
                    { value: "4", label: "HSK 4" },
                    { value: "5", label: "HSK 5" },
                    { value: "6", label: "HSK 6" },
                  ]}
                  onChange={(event) => {
                    const value = event.target.value;

                    setValue("hskLevel", value ? Number(value) : undefined);
                  }}
                />
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
                    <th className="p-3 text-left">HSK</th>
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
                          word.class_name ||
                          "—"}
                      </td>

                      <td className="p-3">
                        {word.hsk_level === 0
                          ? "Foundation"
                          : word.hsk_level
                            ? `HSK ${word.hsk_level}`
                            : "—"}
                      </td>

                      <td className="p-3 flex gap-2">
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
                              classId:
                                word.class_id || "",
                              hskLevel:
                                word.hsk_level === null || word.hsk_level === undefined
                                  ? undefined
                                  : Number(word.hsk_level),
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
