-- Admin access for shared word/class management.
-- Run after 20240101_initial.sql and 20240916_learning_content.sql.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'admin'));

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Users can view own words" ON public.words;
DROP POLICY IF EXISTS "Users can create words" ON public.words;
DROP POLICY IF EXISTS "Users can update own word" ON public.words;
DROP POLICY IF EXISTS "Users can delete own word" ON public.words;

CREATE POLICY "Users and admins can view words" ON public.words
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users and admins can create words" ON public.words
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users and admins can update words" ON public.words
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users and admins can delete words" ON public.words
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can view own classes" ON public.classes;
DROP POLICY IF EXISTS "Users can create classes" ON public.classes;
DROP POLICY IF EXISTS "Users can update own class" ON public.classes;
DROP POLICY IF EXISTS "Users can delete own class" ON public.classes;

CREATE POLICY "Users and admins can view classes" ON public.classes
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users and admins can create classes" ON public.classes
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users and admins can update classes" ON public.classes
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users and admins can delete classes" ON public.classes
  FOR DELETE USING (auth.uid() = user_id OR public.is_admin());
