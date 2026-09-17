'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToasts, ToastViewport } from '@/components/ui/toast';

type NotificationRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  type: string;
  message: string;
  title: string | null;
  quiz_id: string | null;
  link: string | null;
  created_at: string;
};

const notificationTitle = (row: NotificationRow) => {
  if (row.title) return row.title;
  if (row.type === 'quiz-available') return 'New Quiz Available';
  if (row.type === 'quiz-updated') return 'Quiz updated';
  if (row.type === 'quiz-submission') return 'Quiz submission';
  return 'Quiz notification';
};

export function QuizNotificationToaster() {
  const { toasts, push, dismiss } = useToasts();
  const sessionUserId = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const attach = () => {
      channelRef.current?.unsubscribe();
      const channel = supabase
        .channel('quiz-notifications-live')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'quiz_notifications' },
          (payload) => {
            const row = payload.new as NotificationRow;
            if (!sessionUserId.current || row.user_id === sessionUserId.current) return;
            push({
              id: row.id,
              title: notificationTitle(row),
              message: row.message,
              href: row.link || undefined,
              actionLabel: row.type === 'quiz-available' ? 'Start Quiz' : undefined,
            });
          }
        )
        .subscribe();
      channelRef.current = channel;
    };

    const trackUser = async () => {
      const { data } = await supabase.auth.getUser();
      sessionUserId.current = data.user?.id ?? null;
      if (data.user?.id) attach();
    };

    trackUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionUserId.current = session?.user?.id ?? null;
      if (session?.user) attach();
      else channelRef.current?.unsubscribe();
    });

    return () => {
      authListener.subscription.unsubscribe();
      channelRef.current?.unsubscribe();
    };
  }, [push]);

  return <ToastViewport toasts={toasts} onDismiss={dismiss} />;
}