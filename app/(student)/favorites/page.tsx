"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export default function FavoritesPage() {
  const [user, setUser] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);

  useEffect(() => {
    fetchUser();
    fetchFavorites();
  }, []);

  const fetchUser = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Redirect to login
    }
    setUser(data.user.id);
  };

  const fetchFavorites = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from("favorites")
      .select(`
        *,
        words (*),
        sentences (*)
      `)
      .eq("user_id", user);
    
    if (error) return;
    setFavorites(data || []);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        <Card className="p-6">
          <h2 className="text-2xl font-bold text-foreground mb-6">❤️ Favorites</h2>
          
          {favorites.length === 0 ? (
            <EmptyState>
              <p>No favorites yet</p>
              <p className="text-sm mt-2">Star words or sentences to save them here</p>
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {favorites.map((fav: any, index: number) => {
                const item = fav.word_id ? fav.words : fav.sentences;
                return (
                  <div key={index} className="p-4 rounded-md border bg-card">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-lg">{item.chinese || item.chinese_sentence}</p>
                        {item.pinyin && <p className="text-sm text-muted-foreground">{item.pinyin}</p>}
                        {item.khmer && <p className="text-sm text-primary">{item.khmer}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Remove from favorites
                          supabase.from("favorites").delete().eq("id", fav.id);
                          fetchFavorites();
                        }}
                      >
                        ❌
                      </Button>
                    </div>
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