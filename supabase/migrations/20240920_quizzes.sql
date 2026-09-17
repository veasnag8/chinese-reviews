-- Quiz Management: quiz-level quizzes with ordered questions and options.
--
-- The existing public.quiz_questions table is a flat question bank used by the
-- student Quiz page (/quiz) and the quick "Manage Quiz" tool (/admin/quiz).
-- It is intentionally left untouched so those features keep working.
-- Quiz Management uses the new quiz-scoped tables below. The question table is
-- named quiz_items to avoid colliding with the existing quiz_questions table.
--
-- Run after 20240916_admin_access.sql and 20240916_schedule_access.sql.

CREATE TABLE IF NOT EXISTS public.quizzes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  hsk_level INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_id UUID REFERENCES public.quizzes ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'single' CHECK (question_type IN ('single', 'multiple', 'true-false')),
  explanation TEXT,
  hint TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.quiz_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_id UUID REFERENCES public.quiz_items ON DELETE CASCADE NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;

-- Quizzes ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view quizzes" ON public.quizzes;
CREATE POLICY "Authenticated users can view quizzes" ON public.quizzes
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can create quizzes" ON public.quizzes;
CREATE POLICY "Staff can create quizzes" ON public.quizzes
  FOR INSERT WITH CHECK (public.is_staff() AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update quizzes" ON public.quizzes;
CREATE POLICY "Admins can update quizzes" ON public.quizzes
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete quizzes" ON public.quizzes;
CREATE POLICY "Admins can delete quizzes" ON public.quizzes
  FOR DELETE USING (public.is_admin());

-- Quiz items ------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view quiz items" ON public.quiz_items;
CREATE POLICY "Authenticated users can view quiz items" ON public.quiz_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can create quiz items" ON public.quiz_items;
CREATE POLICY "Staff can create quiz items" ON public.quiz_items
  FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Admins can update quiz items" ON public.quiz_items;
CREATE POLICY "Admins can update quiz items" ON public.quiz_items
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete quiz items" ON public.quiz_items;
CREATE POLICY "Admins can delete quiz items" ON public.quiz_items
  FOR DELETE USING (public.is_admin());

-- Quiz options ----------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view quiz options" ON public.quiz_options;
CREATE POLICY "Authenticated users can view quiz options" ON public.quiz_options
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can create quiz options" ON public.quiz_options;
CREATE POLICY "Staff can create quiz options" ON public.quiz_options
  FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Admins can update quiz options" ON public.quiz_options;
CREATE POLICY "Admins can update quiz options" ON public.quiz_options
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete quiz options" ON public.quiz_options;
CREATE POLICY "Admins can delete quiz options" ON public.quiz_options
  FOR DELETE USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_items_quiz_id ON public.quiz_items(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_options_question_id ON public.quiz_options(question_id);
