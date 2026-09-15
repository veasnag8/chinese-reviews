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

const sentenceSchema = z.object({
  chineseSentence: z.string().min(1, "Sentence is required"),
  pinyin: z.string().optional(),
  khmerTranslation: z.string().optional(),
  englishTranslation: z.string().optional(),
  audioUrl: z.string().optional(),
});

export default function SentencesPage() {
  const router = useRouter();
  const [user, setUser] = useState<string | null>(null);
  const [sentences, setSentences] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [formState, setFormState] = useState<"idle" | "submitting" | "success">("idle");

  useEffect(() => {
    fetchUser();
    fetchSentences();
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

  const fetchSentences = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("sentences")
      .select("*")
      .eq("user_id", user)
      .order("created_at", { ascending: false });
    
    if (error) return;
    setSentences(data || []);
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
    resolver: zodResolver(sentenceSchema),
  });

  const onAddSentence = async (data: any) => {
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
      });
    
    if (error) {
      setFormState("error");
      return;
    }
    
    setFormState("success");
    resetForm();
    fetchSentences();
  };

  const deleteSentence = async (sentenceId: string) => {
    const { error } = await supabase
      .from("sentences")
      .delete()
      .eq("id", sentenceId);
    
    if (error) return;
    fetchSentences();
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">My Sentences</h2>
          
          <div className="flex gap-2">
            <Select
              options={classes.map((cls: any) => ({
                value: cls.id,
                label: cls.name,
              }))}
              placeholder="Select class"
              onValueChange={setSelectedClass}
            />
            
            <Button variant="primary">+ Add Sentence</Button>
          </div>
        </div>
        
        {sentences.length === 0 ? (
          <EmptyState>
            <p>No sentences yet</p>
            <p className="text-sm mt-2">Add your first sentence to get started</p>
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
                  <tr key={sentence.id} className="hover:bg-muted/50">
                    <td className="p-3 truncate">{sentence.chinese_sentence}</td>
                    <td className="p-3">{sentence.pinyin || "—"}</td>
                    <td className="p-3">{sentence.khmer_translation || "—"}</td>
                    <td className="p-3">{sentence.english_translation || "—"}</td>
                    <td className="p-3">{sentence.class_name || "—"}</td>
                    <td className="p-3">
                      <Button size="sm" variant="outline">Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteSentence(sentence.id)}>Delete</Button>
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