"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export default function FavoritesPage() {
  const [user, setUser] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!active || !authUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(authUser.id);
      await fetchFavorites(authUser.id);
      if (active) setLoading(false);
    };
    init();
    return () => { active = false; };
  }, []);

  const fetchFavorites = async (userId: string) => {
    const { data, error } = await supabase
      .from("favorites")
      .select(`
        id,
        created_at,
        word_id,
        sentence_id,
        words (id, chinese, pinyin, khmer, english, class_id, classes!words_class_id_fkey (name)),
        sentences (id, chinese_sentence, pinyin, khmer_translation, english_translation, class_id, classes!sentences_class_id_fkey (name))
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }
    setFavorites(data || []);
  };

  const removeFavorite = async (favId: string) => {
    if (!window.confirm("Remove this item from your favorites?")) {
      return;
    }
    await supabase.from("favorites").delete().eq("id", favId);
    setFavorites((prev) => prev.filter((f) => f.id !== favId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-slate-500">Loading favorites...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <Link href="/login" className="text-[#b91c1c] underline">Please sign in to view favorites</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="p-6">
          <h2 className="text-2xl font-bold text-foreground mb-6">❤️ Favorites</h2>

          {favorites.length === 0 ? (
            <EmptyState>
              <p>No favorites yet</p>
              <p className="text-sm mt-2">Tap the heart on words or sentences to save them here</p>
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {favorites.map((fav: any) => {
                const isWord = !!fav.word_id;
                const item = isWord ? fav.words : fav.sentences;
                const chinese = isWord ? item?.chinese : item?.chinese_sentence;
                const pinyin = isWord ? item?.pinyin : item?.pinyin;
                const khmer = isWord ? item?.khmer : item?.khmer_translation;
                const english = isWord ? item?.english : item?.english_translation;
                const className = item?.classes?.name;
                const link = isWord
                  ? `/writing?word=${item.id}`
                  : `/sentences`;

                return (
                  <div key={fav.id} className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Link href={link} className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg font-medium">{chinese}</span>
                        {pinyin && <span className="text-sm text-slate-500">{pinyin}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-slate-500">
                        {khmer && <span>{khmer}</span>}
                        {english && <span>{english}</span>}
                        {className && <span className="px-2 py-0.5 rounded bg-stone-100">{className}</span>}
                        <span className="text-xs bg-stone-100 px-2 py-0.5 rounded">
                          {isWord ? "Word" : "Sentence"}
                        </span>
                      </div>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:bg-red-50"
                      onClick={() => removeFavorite(fav.id)}
                      aria-label="Remove from favorites"
                    >
                      ✕
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}