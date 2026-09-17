import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export function resolveDisplayName(user: {
  user_metadata?: Record<string, unknown>;
  email?: string | null;
}): string {
  const metadataName =
    (typeof user.user_metadata?.full_name === 'string' && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === 'string' && user.user_metadata.name) ||
    '';
  const fromEmail = user.email?.split('@')[0]?.replace(/[._]/g, ' ') ?? '';
  return (metadataName || fromEmail || 'User').trim();
}

export type QuizNotificationMeta = {
  title?: string;
  quizId?: string;
  link?: string;
};

export async function sendQuizNotification(
  type: string,
  message: string,
  meta: QuizNotificationMeta = {}
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

  const { data: authData } = await supabase.auth.getUser();
  const user: User | null = authData.user;
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const { error } = await supabase.from('quiz_notifications').insert({
    user_id: user.id,
    display_name: resolveDisplayName(user),
    type,
    message,
    title: meta.title ?? null,
    quiz_id: meta.quizId ?? null,
    link: meta.link ?? null,
  } as never);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}