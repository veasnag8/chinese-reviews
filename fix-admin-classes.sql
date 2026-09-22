-- Fix admin class permissions
-- Run in Supabase SQL Editor

-- 1. Ensure is_admin() function exists
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

-- 2. Ensure is_staff() function exists (teacher + admin)
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

-- 3. Fix classes policies - allow staff to create classes they own, admins to manage all
DROP POLICY IF EXISTS "Users can view own classes" ON public.classes;
DROP POLICY IF EXISTS "Users can create classes" ON public.classes;
DROP POLICY IF EXISTS "Users can update own class" ON public.classes;
DROP POLICY IF EXISTS "Users can delete own class" ON public.classes;
DROP POLICY IF EXISTS "Users and admins can view classes" ON public.classes;
DROP POLICY IF EXISTS "Users and admins can create classes" ON public.classes;
DROP POLICY IF EXISTS "Users and admins can update classes" ON public.classes;
DROP POLICY IF EXISTS "Users and admins can delete classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated users can view lesson classes" ON public.classes;
DROP POLICY IF EXISTS "Staff can create classes" ON public.classes;
DROP POLICY IF EXISTS "Staff can update classes" ON public.classes;
DROP POLICY IF EXISTS "Staff can delete classes" ON public.classes;

-- Allow all authenticated users to view classes
CREATE POLICY "Authenticated users can view classes" ON public.classes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Staff (teacher/admin) can create classes where they are the owner
CREATE POLICY "Staff can create classes" ON public.classes
  FOR INSERT WITH CHECK (public.is_staff() AND auth.uid() = user_id);

-- Staff can update their own classes, admins can update any
CREATE POLICY "Staff can update classes" ON public.classes
  FOR UPDATE USING (public.is_staff() OR auth.uid() = user_id)
  WITH CHECK (public.is_staff() OR auth.uid() = user_id);

-- Staff can delete their own classes, admins can delete any
CREATE POLICY "Staff can delete classes" ON public.classes
  FOR DELETE USING (public.is_staff() OR auth.uid() = user_id);

-- 4. Also fix words/sentences for admin access
DROP POLICY IF EXISTS "Users can view own words" ON public.words;
DROP POLICY IF EXISTS "Users can create words" ON public.words;
DROP POLICY IF EXISTS "Users can update own word" ON public.words;
DROP POLICY IF EXISTS "Users can delete own word" ON public.words;
DROP POLICY IF EXISTS "Users and admins can view words" ON public.words;
DROP POLICY IF EXISTS "Users and admins can create words" ON public.words;
DROP POLICY IF EXISTS "Users and admins can update words" ON public.words;
DROP POLICY IF EXISTS "Users and admins can delete words" ON public.words;
DROP POLICY IF EXISTS "Users can view own or scheduled words" ON public.words;

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

CREATE POLICY "Staff can create words" ON public.words
  FOR INSERT WITH CHECK (public.is_staff() AND auth.uid() = user_id);

CREATE POLICY "Staff can update words" ON public.words
  FOR UPDATE USING (public.is_staff() OR auth.uid() = user_id)
  WITH CHECK (public.is_staff() OR auth.uid() = user_id);

CREATE POLICY "Staff can delete words" ON public.words
  FOR DELETE USING (public.is_staff() OR auth.uid() = user_id);

-- Sentences
DROP POLICY IF EXISTS "Users can view own sentences" ON public.sentences;
DROP POLICY IF EXISTS "Users can create sentences" ON public.sentences;
DROP POLICY IF EXISTS "Users can update own sentence" ON public.sentences;
DROP POLICY IF EXISTS "Users can delete own sentence" ON public.sentences;
DROP POLICY IF EXISTS "Users and admins can view sentences" ON public.sentences;
DROP POLICY IF EXISTS "Users can view own or scheduled sentences" ON public.sentences;

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

CREATE POLICY "Staff can create sentences" ON public.sentences
  FOR INSERT WITH CHECK (public.is_staff() AND auth.uid() = user_id);

CREATE POLICY "Staff can update sentences" ON public.sentences
  FOR UPDATE USING (public.is_staff() OR auth.uid() = user_id)
  WITH CHECK (public.is_staff() OR auth.uid() = user_id);

CREATE POLICY "Staff can delete sentences" ON public.sentences
  FOR DELETE USING (public.is_staff() OR auth.uid() = user_id);