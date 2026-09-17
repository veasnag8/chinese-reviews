-- Only admins may edit or delete words and sentences.
-- Students and teachers can still view shared content (and staff can add it).
-- Run after 20240917_quiz_notifications.sql.

-- Words: replace owner-or-admin update/delete with admin-only.
DROP POLICY IF EXISTS "Users and admins can update words" ON public.words;
DROP POLICY IF EXISTS "Users can update own word" ON public.words;
CREATE POLICY "Admins can update words" ON public.words
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users and admins can delete words" ON public.words;
DROP POLICY IF EXISTS "Users can delete own word" ON public.words;
CREATE POLICY "Admins can delete words" ON public.words
  FOR DELETE USING (public.is_admin());

-- Sentences: replace owner-only update/delete with admin-only.
DROP POLICY IF EXISTS "Users can update own sentence" ON public.sentences;
DROP POLICY IF EXISTS "Users and admins can update sentences" ON public.sentences;
CREATE POLICY "Admins can update sentences" ON public.sentences
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can delete own sentence" ON public.sentences;
DROP POLICY IF EXISTS "Users and admins can delete sentences" ON public.sentences;
CREATE POLICY "Admins can delete sentences" ON public.sentences
  FOR DELETE USING (public.is_admin());