-- Shared lesson schedules for staff-created classes and student viewing.
-- Run after 20240916_admin_access.sql.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'teacher', 'admin'));

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('teacher', 'admin')
  );
$$;

DROP POLICY IF EXISTS "Users and admins can view classes" ON public.classes;
CREATE POLICY "Authenticated users can view lesson classes" ON public.classes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users and admins can create classes" ON public.classes;
CREATE POLICY "Staff can create classes" ON public.classes
  FOR INSERT WITH CHECK (public.is_staff() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and admins can update classes" ON public.classes;
CREATE POLICY "Staff can update classes" ON public.classes
  FOR UPDATE USING (public.is_staff() OR auth.uid() = user_id)
  WITH CHECK (public.is_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and admins can delete classes" ON public.classes;
CREATE POLICY "Staff can delete classes" ON public.classes
  FOR DELETE USING (public.is_staff() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and admins can view words" ON public.words;
CREATE POLICY "Users can view own or scheduled words" ON public.words
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = words.class_id
        AND auth.uid() IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users and admins can view sentences" ON public.sentences;
CREATE POLICY "Users can view own or scheduled sentences" ON public.sentences
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = sentences.class_id
        AND auth.uid() IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Users can view own quiz questions" ON public.quiz_questions;
CREATE POLICY "Authenticated users can view quiz questions" ON public.quiz_questions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can create quiz questions" ON public.quiz_questions;
CREATE POLICY "Staff can create quiz questions" ON public.quiz_questions
  FOR INSERT WITH CHECK (public.is_staff() AND auth.uid() = user_id);

CREATE POLICY "Staff can delete quiz questions" ON public.quiz_questions
  FOR DELETE USING (public.is_staff() OR auth.uid() = user_id);
