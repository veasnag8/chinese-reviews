-- Class edit/delete is admin-only, matching words and sentences.
-- Run after 20240921_quiz_delivery.sql.

DROP POLICY IF EXISTS "Staff can update classes" ON public.classes;
CREATE POLICY "Admins can update classes" ON public.classes
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Staff can delete classes" ON public.classes;
CREATE POLICY "Admins can delete classes" ON public.classes
  FOR DELETE USING (public.is_admin());
