import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

type HomeworkAlertPayload = {
  type: 'homework';
  assignmentId?: string;
  title: string;
  description?: string | null;
  expiresAt: string;
};

type QuizAlertPayload = {
  type: 'quiz';
  quizId: string;
  title: string;
  description?: string | null;
  questionCount?: number;
  deadline?: string | null;
};

type WordEntry = {
  chinese: string;
  pinyin?: string | null;
  khmer?: string | null;
};

type WordsTodayAlertPayload = {
  type: 'words_today';
  dateLabel: string;
  words: WordEntry[];
};

type TelegramAlertPayload =
  | HomeworkAlertPayload
  | QuizAlertPayload
  | WordsTodayAlertPayload;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'No expire date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Phnom_Penh',
  }).format(date);
}

async function requireStaff(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) return false;

  const authClient = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return false;

  const profileClient = serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

  const { data: profile, error: profileError } = await profileClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role;
  return !profileError && (role === 'admin' || role === 'teacher');
}

async function resolveGroupChatId(botToken: string): Promise<string | null> {
  const configured = process.env.TELEGRAM_CHAT_ID?.trim();
  if (configured) return configured;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=50`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const updates = Array.isArray(json?.result) ? json.result : [];
    for (let i = updates.length - 1; i >= 0; i -= 1) {
      const update = updates[i];
      const chat =
        update?.message?.chat ||
        update?.my_chat_member?.chat ||
        update?.channel_post?.chat;
      if (chat && (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel')) {
        return String(chat.id);
      }
    }
  } catch {
    return null;
  }
  return null;
}

function getBaseUrl(request: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const origin = request.headers.get('origin');
  if (origin) return origin.replace(/\/+$/, '');
  return request.nextUrl.origin.replace(/\/+$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const isStaff = await requireStaff(request);
    if (!isStaff) {
      return NextResponse.json({ error: 'Admin or teacher access required.' }, { status: 403 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
    if (!botToken || botToken.includes('*')) {
      return NextResponse.json(
        {
          error:
            'TELEGRAM_BOT_TOKEN is missing or masked in .env. Please add the full Telegram bot token and restart the server.',
        },
        { status: 500 }
      );
    }

    const chatId = await resolveGroupChatId(botToken);
    if (!chatId) {
      return NextResponse.json(
        {
          error:
            'TELEGRAM_CHAT_ID is not configured and no group was found yet. Add the bot to your Telegram group, send a message in the group (or set TELEGRAM_CHAT_ID in .env), and try again.',
        },
        { status: 400 }
      );
    }

    const payload = (await request.json()) as TelegramAlertPayload;
    const baseUrl = getBaseUrl(request);
    let messageHtml = '';

    if (payload.type === 'homework') {
      if (!payload.title?.trim()) {
        return NextResponse.json({ error: 'Homework title is required.' }, { status: 400 });
      }
      const link = `${baseUrl}/for-you`;
      const lines = [
        `📚 <b>New Homework</b>`,
        ``,
        `<b>Title:</b> ${escapeHtml(payload.title.trim())}`,
        `<b>Expire Date:</b> ${escapeHtml(formatDateTime(payload.expiresAt))}`,
      ];
      if (payload.description?.trim()) {
        lines.push(`<b>Note:</b> ${escapeHtml(payload.description.trim())}`);
      }
      lines.push(``, `🔗 <a href="${escapeHtml(link)}">Open Homework</a>`);
      messageHtml = lines.join('\n');
    } else if (payload.type === 'quiz') {
      if (!payload.quizId || !payload.title?.trim()) {
        return NextResponse.json({ error: 'Quiz ID and title are required.' }, { status: 400 });
      }
      const link = `${baseUrl}/quizzes/${encodeURIComponent(payload.quizId)}`;
      const lines = [
        `📝 <b>New Quiz Available</b>`,
        ``,
        `<b>Title:</b> ${escapeHtml(payload.title.trim())}`,
      ];
      if (typeof payload.questionCount === 'number') {
        lines.push(`<b>Questions:</b> ${payload.questionCount}`);
      }
      lines.push(`<b>Expire Date:</b> ${escapeHtml(formatDateTime(payload.deadline))}`);
      if (payload.description?.trim()) {
        lines.push(`<b>Note:</b> ${escapeHtml(payload.description.trim())}`);
      }
      lines.push(``, `🔗 <a href="${escapeHtml(link)}">Open Quiz</a>`);
      messageHtml = lines.join('\n');
    } else if (payload.type === 'words_today') {
      const words = Array.isArray(payload.words) ? payload.words : [];
      if (words.length === 0) {
        return NextResponse.json({ error: 'No words added today to send.' }, { status: 400 });
      }
      const link = `${baseUrl}/words`;
      const formattedRows = words.map((w) => {
        const ch = (w.chinese || '').trim();
        const py = (w.pinyin || '').trim() || '—';
        const km = (w.khmer || '').trim() || '—';
        return `${ch} - ${py} - ${km}`;
      });

      const header = [
        `📖 <b>Words Added Today</b>`,
        ``,
        `<b>Date:</b> ${escapeHtml(payload.dateLabel)}`,
        `<b>Total Words:</b> ${words.length}`,
        ``,
      ].join('\n');
      const footer = `\n\n🔗 <a href="${escapeHtml(link)}">Open Words</a>`;

      // Respect Telegram's 4096-character limit per message
      const maxListChars = 3500;
      let listText = '';
      let includedCount = 0;
      for (const row of formattedRows) {
        const escapedRow = escapeHtml(row);
        const candidate = listText ? `${listText}\n${escapedRow}` : escapedRow;
        if (candidate.length > maxListChars) break;
        listText = candidate;
        includedCount += 1;
      }
      const truncatedNote =
        includedCount < formattedRows.length
          ? `\n...and ${formattedRows.length - includedCount} more words`
          : '';

      messageHtml = `${header}<pre>${listText}${escapeHtml(truncatedNote)}</pre>${footer}`;
    } else {
      return NextResponse.json({ error: 'Unsupported alert type.' }, { status: 400 });
    }

    const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageHtml,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const telegramData = await telegramRes.json();
    if (!telegramRes.ok || !telegramData?.ok) {
      return NextResponse.json(
        { error: telegramData?.description || 'Failed to send Telegram alert.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, chatId });
  } catch (error: any) {
    console.error('Telegram alert error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unexpected error sending Telegram alert.' },
      { status: 500 }
    );
  }
}
