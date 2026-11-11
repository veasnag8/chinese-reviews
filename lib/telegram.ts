import { supabase } from '@/lib/supabase';

export type TelegramAlertResult = {
  ok: boolean;
  error?: string;
};

async function postTelegramAlert(body: Record<string, unknown>): Promise<TelegramAlertResult> {
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured.' };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { ok: false, error: 'Please sign in again before sending an alert.' };
  }

  try {
    const res = await fetch('/api/telegram/alert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error || 'Failed to send Telegram alert.' };
    }
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Network error while sending Telegram alert.' };
  }
}

export async function sendHomeworkTelegramAlert(params: {
  assignmentId: string;
  title: string;
  description?: string | null;
  expiresAt: string;
}): Promise<TelegramAlertResult> {
  return postTelegramAlert({
    type: 'homework',
    assignmentId: params.assignmentId,
    title: params.title,
    description: params.description,
    expiresAt: params.expiresAt,
  });
}

export async function sendQuizTelegramAlert(params: {
  quizId: string;
  title: string;
  description?: string | null;
  questionCount?: number;
  deadline?: string | null;
}): Promise<TelegramAlertResult> {
  return postTelegramAlert({
    type: 'quiz',
    quizId: params.quizId,
    title: params.title,
    description: params.description,
    questionCount: params.questionCount,
    deadline: params.deadline,
  });
}

export async function sendTodayWordsTelegramAlert(params: {
  dateLabel: string;
  words: { chinese: string; pinyin?: string | null; khmer?: string | null }[];
}): Promise<TelegramAlertResult> {
  return postTelegramAlert({
    type: 'words_today',
    dateLabel: params.dateLabel,
    words: params.words,
  });
}
