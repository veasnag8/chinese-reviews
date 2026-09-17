-- Quiz questions: admins can edit any question, and only admins can delete.
-- Staff (teachers/admins) can still add questions.
-- Run after 20240918_admin_only_edit_delete.sql.

DROP POLICY IF EXISTS "Staff can delete quiz questions" ON public.quiz_questions;
CREATE POLICY "Admins can delete quiz questions" ON public.quiz_questions
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update quiz questions" ON public.quiz_questions;
CREATE POLICY "Admins can update quiz questions" ON public.quiz_questions
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());