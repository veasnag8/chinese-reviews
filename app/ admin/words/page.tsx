import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatDate } from "@/lib/utils";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminWordsPage() {
  const [user, setUser] = useState<string | null>(null);
  const [words, setWords] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [isEditing, setIsEditing] = useState(false);
  const [editingWord, setEditingWord] = useState<any | null>(null);

  useEffect(() => {
    fetchUser();
    fetchWords();
    fetchClasses();
  }, []);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // In real app, check admin role
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
    
    if (error) return;
    setWords(data || []);
  };

  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name")
      .order("date", { ascending: false });
    
    if (error) return;
    setClasses(data || []);
  };

  const { register, handleSubmit, reset, resetForm } = useForm({
    resolver: zodResolver(z.object({
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
    })),
  });

  const onWordSubmit = async (data: any) => {
    setFormState("submitting");
    
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
        user_id: "admin-user-id", // Would come from auth
      });
    
    if (error) {
      setFormState("error");
      return;
    }
    
    setFormState("success");
    resetForm();
    fetchWords();
  };

  const onWordUpdate = async (data: any) => {
    setFormState("submitting");
    
    const { error } = await supabase
      .from("words")
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
      .eq("id", editingWord?.id);
    
    if (error) {
      setFormState("error");
      return;
    }
    
    setFormState("success");
    setIsEditing(false);
    resetForm();
    fetchWords();
  };

  const deleteWord = async (wordId: string) => {
    const { error } = await supabase
      .from("words")
      .delete()
      .eq("id", wordId);
    
    if (error) return;
    fetchWords();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">Manage Words</h2>
          
          <Button variant="primary" onClick={() => setIsEditing(true)}>
            + Add Word
          </Button>
        </div>
        
        {isEditing && (
          <Card className="max-w-2xl p-6">
            <h3 className="text-lg font-medium mb-4">Add New Word</h3>
            <form onSubmit={handleSubmit(onWordSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Chinese</label>
                <Input
                  placeholder="Enter Chinese character(s)"
                  {...register("chinese", { required: true })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Pinyin</label>
                  <Input placeholder="Enter pinyin" {...register("pinyin")} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Khmer</label>
                  <Input placeholder="Enter Khmer translation" {...register("khmer")} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">English</label>
                  <Input placeholder="Enter English translation" {...register("english")} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">HSK Level</label>
                  <Select
                    options={[
                      { value: 1, label: "HSK 1" },
                      { value: 2, label: "HSK 2" },
                      { value: 3, label: "HSK 3" },
                      { value: 4, label: "HSK 4" },
                      { value: 5, label: "HSK 5" },
                      { value: 6, label: "HSK 6" },
                    ]}
                    onValueChange={(val) => {/* set hskLevel */}}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <Input placeholder="Enter category" {...register("category")} />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Part of Speech</label>
                <Input placeholder="e.g., noun, verb" {...register("partOfSpeech")} />
              </div>
              
              <Button type="submit" disabled={formState === "submitting"}>
                {formState === "submitting" ? "Saving..." : "Save Word"}
              </Button>
              
              {formState === "success" && (
                <p className="text-sm text-success mt-2">Word saved successfully!</p>
              )}
            </form>
          </Card>
        )}
        
        <div className="mt-6">
          {words.length === 0 ? (
            <EmptyState>
              <p>No words yet</p>
              <p className="text-sm mt-2">Words will appear here once added</p>
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
                  {words.map((word: any) => (
                    <tr key={word.id} className="hover:bg-muted/50">
                      <td className="p-3">{word.chinese}</td>
                      <td className="p-3">{word.pinyin || "—"}</td>
                      <td className="p-3">{word.khmer || "—"}</td>
                      <td className="p-3">{word.english || "—"}</td>
                      <td className="p-3">{word.class_name || "—"}</td>
                      <td className="p-3">{word.hsk_level || "—"}</td>
                      <td className="p-3">
                        <Button size="sm" variant="outline">Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteWord(word.id)}>Delete</Button>
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