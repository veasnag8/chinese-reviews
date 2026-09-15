"use client";

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
});

export default function WordsPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [words, setWords] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [formState, setFormState] = useState<"idle" | "submitting" | "success">("idle");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchUser();
    fetchWords();
    fetchClasses();
  }, []);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      router.push("/login");
      return;
    }
    setUser(data.user.id);
  };

  const fetchWords = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("words")
      .select("*")
      .eq("user_id", user)
      .order("created_at", { ascending: false });
    
    if (error) return;
    setWords(data || []);
  };

  const fetchClasses = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("user_id", user)
      .order("date", { ascending: false });
    
    if (error) return;
    setClasses(data || []);
  };

  const { register, handleSubmit, reset, resetForm } = useForm({
    resolver: zodResolver(wordSchema),
  });

  const onAddWord = async (data: any) => {
    setFormState("submitting");
    setIsAdding(true);
    
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
        class_id: selectedClass,
        user_id: user,
      });
    
    if (error) {
      setFormState("error");
      setIsAdding(false);
      return;
    }
    
    setFormState("success");
    setIsAdding(false);
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">My Words</h2>
          
          <div className="flex gap-2">
            <Select
              options={classes.map((cls: any) => ({
                value: cls.id,
                label: cls.name,
              }))}
              placeholder="Select class"
              onValueChange={setSelectedClass}
            />
            
            <Button onClick={() => setIsAdding(true)} variant="primary">
              + Add Word
            </Button>
          </div>
        </div>
        
        {isAdding && (
          <Card className="max-w-md p-6">
            <h3 className="text-lg font-medium mb-4">Add New Word</h3>
            <form onSubmit={handleSubmit(onAddWord)} className="space-y-4">
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
              <p className="text-sm mt-2">Add your first word to get started</p>
              <Button onClick={() => setIsAdding(true)}>+ Add Word</Button>
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
                  {words.map((word: any) => (
                    <tr key={word.id} className="hover:bg-muted/50">
                      <td className="p-3">{word.chinese}</td>
                      <td className="p-3">{word.pinyin || "—"}</td>
                      <td className="p-3">{word.khmer || "—"}</td>
                      <td className="p-3">{word.english || "—"}</td>
                      <td className="p-3">{word.class_name || "—"}</td>
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