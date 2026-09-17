-- Real-time quiz notifications broadcast to all authenticated users.
-- Run after 20240916_schedule_access.sql.

CREATE TABLE IF NOT EXISTS public.quiz_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  display_name TEXT,
  type TEXT NOT NULL DEFAULT 'quiz',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quiz_notifications ENABLE ROW LEVEL SECURITY;

-- Every authenticated user can see live notifications as they arrive.
CREATE POLICY "Authenticated users can view quiz notifications" ON public.quiz_notifications
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Any authenticated user can post a quiz notification about their own action.
CREATE POLICY "Authenticated users can create quiz notifications" ON public.quiz_notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Broadcast INSERT rows to every connected client in real time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'quiz_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_notifications;
  END IF;
END $$;