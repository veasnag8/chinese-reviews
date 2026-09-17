import { supabase } from '@/lib/supabase';

export type FavoriteType = 'word' | 'sentence';

export async function fetchFavoriteIds(
  userId: string
): Promise<{ words: Set<string>; sentences: Set<string>; error?: string }> {
  if (!supabase) return { words: new Set(), sentences: new Set(), error: 'Supabase is not configured.' };

  const { data, error } = await supabase
    .from('favorites')
    .select('word_id, sentence_id')
    .eq('user_id', userId);

  if (error) {
    return { words: new Set(), sentences: new Set(), error: error.message };
  }

  const words = new Set<string>();
  const sentences = new Set<string>();
  ((data || []) as { word_id: string | null; sentence_id: string | null }[]).forEach((row) => {
    if (row.word_id) words.add(row.word_id);
    if (row.sentence_id) sentences.add(row.sentence_id);
  });

  return { words, sentences };
}

export async function toggleFavorite(
  userId: string,
  type: FavoriteType,
  itemId: string,
  isFavorite: boolean
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Supabase is not configured.' };

  if (isFavorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq(type === 'word' ? 'word_id' : 'sentence_id', itemId);

    return error ? { error: error.message } : {};
  }

  const insert =
    type === 'word'
      ? { user_id: userId, word_id: itemId }
      : { user_id: userId, sentence_id: itemId };

  const { error } = await supabase.from('favorites').insert(insert as never);
  if (error && error.code === '23505') return {};
  return error ? { error: error.message } : {};
}
