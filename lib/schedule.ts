import { supabase } from '@/lib/supabase';

export const todayISO = () => new Date().toISOString().slice(0, 10);

export async function ensureClassForDate(
  date: string,
  name?: string
): Promise<{ id: string | null; error?: string }> {
  if (!supabase) return { id: null, error: 'Supabase is not configured.' };
  const trimmed = date?.trim();
  if (!trimmed) return { id: null, error: 'Please choose a lesson date.' };

  const { data: existing, error: findError } = await supabase
    .from('classes')
    .select('id')
    .eq('date', trimmed)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) return { id: null, error: findError.message };
  const existingId = (existing as { id: string } | null)?.id;
  if (existingId) return { id: existingId };

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { id: null, error: 'Please sign in again.' };

  const { data: created, error: createError } = await supabase
    .from('classes')
    .insert({
      name: name?.trim() || `Lesson ${trimmed}`,
      date: trimmed,
      user_id: authData.user.id,
    } as never)
    .select('id')
    .single();

  if (createError) return { id: null, error: createError.message };
  const createdId = (created as { id: string } | null)?.id;
  return { id: createdId ?? null };
}