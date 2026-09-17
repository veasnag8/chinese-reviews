-- Quiz delivery: scheduling, deadlines, submissions, answers, and
-- server-authoritative RPCs.
--
-- Builds on 20240920_quizzes.sql. The legacy flat-bank public.quiz_attempts
-- table is left untouched. Quiz Management submissions use the new
-- quiz_submissions / quiz_submission_answers tables.
--
-- Deadline/one-attempt rules are enforced by SECURITY DEFINER functions, so the
-- server (Postgres) is authoritative and students cannot bypass them from the
-- client. Students never get direct access to is_correct: quiz_options is
-- staff-only and students read questions through get_student_quiz().

-- 1. Quiz header: scheduling + expanded status ---------------------------------
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;

ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_status_check;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_status_check
  CHECK (status IN ('draft', 'active', 'inactive', 'expired', 'archived'));

-- 2. Question -> word link for word performance analysis ------------------------
ALTER TABLE public.quiz_items
  ADD COLUMN IF NOT EXISTS word_id UUID REFERENCES public.words ON DELETE SET NULL;

-- 3. Submission / result structure ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.quiz_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_id UUID REFERENCES public.quizzes ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quiz_submissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.quiz_submission_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attempt_id UUID REFERENCES public.quiz_submissions ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.quiz_items ON DELETE CASCADE NOT NULL,
  selected_option_id UUID REFERENCES public.quiz_options ON DELETE SET NULL,
  correct_option_id UUID REFERENCES public.quiz_options ON DELETE SET NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quiz_submission_answers ENABLE ROW LEVEL SECURITY;

-- One submitted attempt per student per quiz for v1. Dropping this partial
-- unique index is all that is needed to allow multiple attempts later.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_submissions_one_submitted_per_user
  ON public.quiz_submissions (quiz_id, user_id)
  WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS idx_quiz_submissions_quiz_id ON public.quiz_submissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submissions_user_id ON public.quiz_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_submission_answers_attempt_id ON public.quiz_submission_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_quiz_items_word_id ON public.quiz_items(word_id);

-- 4. Notification payload (for the "New Quiz Available" realtime toast) ---------
ALTER TABLE public.quiz_notifications
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS quiz_id UUID,
  ADD COLUMN IF NOT EXISTS link TEXT;

-- 5. Helpers -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_quiz_attempt(p_quiz_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quiz_submissions
    WHERE quiz_id = p_quiz_id AND user_id = auth.uid()
  );
$$;

-- 6. Tighten RLS ---------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Users can view available or attempted quizzes" ON public.quizzes;
CREATE POLICY "Users can view available or attempted quizzes" ON public.quizzes
  FOR SELECT USING (
    public.is_staff()
    OR status = 'active'
    OR public.has_quiz_attempt(id)
  );

DROP POLICY IF EXISTS "Authenticated users can view quiz items" ON public.quiz_items;
DROP POLICY IF EXISTS "Staff can view quiz items" ON public.quiz_items;
CREATE POLICY "Staff can view quiz items" ON public.quiz_items
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Authenticated users can view quiz options" ON public.quiz_options;
DROP POLICY IF EXISTS "Staff can view quiz options" ON public.quiz_options;
CREATE POLICY "Staff can view quiz options" ON public.quiz_options
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "Students can view own submissions" ON public.quiz_submissions;
CREATE POLICY "Students can view own submissions" ON public.quiz_submissions
  FOR SELECT USING (auth.uid() = user_id OR public.is_staff());

DROP POLICY IF EXISTS "Students can view own submission answers" ON public.quiz_submission_answers;
CREATE POLICY "Students can view own submission answers" ON public.quiz_submission_answers
  FOR SELECT USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.quiz_submissions s
      WHERE s.id = quiz_submission_answers.attempt_id AND s.user_id = auth.uid()
    )
  );

-- Staff need student names on the results dashboard.
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_staff());

-- 7. save_quiz: transactionally create/update a quiz with its questions/options -
CREATE OR REPLACE FUNCTION public.save_quiz(
  p_quiz_id uuid,
  p_title text,
  p_description text,
  p_category text,
  p_hsk_level integer,
  p_status text,
  p_start_at timestamptz,
  p_deadline timestamptz,
  p_questions jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_quiz_id uuid;
  v_question jsonb;
  v_option jsonb;
  v_item_id uuid;
  v_index integer := 0;
  v_option_index integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Please sign in again.';
  END IF;

  IF p_quiz_id IS NULL THEN
    IF NOT public.is_staff() THEN
      RAISE EXCEPTION 'Only teachers and admins can create quizzes.';
    END IF;
    IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
      RAISE EXCEPTION 'Quiz title is required.';
    END IF;

    INSERT INTO public.quizzes (
      title, description, category, hsk_level, status, start_at, deadline, user_id
    ) VALUES (
      trim(p_title),
      NULLIF(trim(coalesce(p_description, '')), ''),
      NULLIF(trim(coalesce(p_category, '')), ''),
      p_hsk_level,
      coalesce(p_status, 'draft'),
      p_start_at,
      p_deadline,
      v_user
    )
    RETURNING id INTO v_quiz_id;
  ELSE
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admins can edit quizzes.';
    END IF;

    UPDATE public.quizzes SET
      title = trim(p_title),
      description = NULLIF(trim(coalesce(p_description, '')), ''),
      category = NULLIF(trim(coalesce(p_category, '')), ''),
      hsk_level = p_hsk_level,
      status = coalesce(p_status, status),
      start_at = p_start_at,
      deadline = p_deadline,
      updated_at = now()
    WHERE id = p_quiz_id
    RETURNING id INTO v_quiz_id;

    IF v_quiz_id IS NULL THEN
      RAISE EXCEPTION 'Quiz not found.';
    END IF;

    DELETE FROM public.quiz_items WHERE quiz_id = v_quiz_id;
  END IF;

  FOR v_question IN SELECT * FROM jsonb_array_elements(coalesce(p_questions, '[]'::jsonb))
  LOOP
    IF length(trim(coalesce(v_question->>'question', ''))) = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.quiz_items (
      quiz_id, question, question_type, explanation, hint, word_id, sort_order
    ) VALUES (
      v_quiz_id,
      trim(v_question->>'question'),
      coalesce(NULLIF(v_question->>'question_type', ''), 'single'),
      NULLIF(trim(coalesce(v_question->>'explanation', '')), ''),
      NULLIF(trim(coalesce(v_question->>'hint', '')), ''),
      NULLIF(v_question->>'word_id', '')::uuid,
      v_index
    )
    RETURNING id INTO v_item_id;

    v_option_index := 0;
    FOR v_option IN SELECT * FROM jsonb_array_elements(coalesce(v_question->'options', '[]'::jsonb))
    LOOP
      IF length(trim(coalesce(v_option->>'option_text', ''))) = 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order)
      VALUES (
        v_item_id,
        trim(v_option->>'option_text'),
        coalesce((v_option->>'is_correct')::boolean, false),
        v_option_index
      );
      v_option_index := v_option_index + 1;
    END LOOP;

    v_index := v_index + 1;
  END LOOP;

  RETURN v_quiz_id;
END;
$$;

-- 8. get_student_quiz: questions/options without correct answers ---------------
CREATE OR REPLACE FUNCTION public.get_student_quiz(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz public.quizzes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in again.';
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found.';
  END IF;

  IF v_quiz.status <> 'active' AND NOT public.has_quiz_attempt(p_quiz_id) THEN
    RAISE EXCEPTION 'This quiz is not available.';
  END IF;

  IF v_quiz.start_at IS NOT NULL AND now() < v_quiz.start_at THEN
    RAISE EXCEPTION 'This quiz has not started yet.';
  END IF;

  RETURN jsonb_build_object(
    'quiz', jsonb_build_object(
      'id', v_quiz.id,
      'title', v_quiz.title,
      'description', v_quiz.description,
      'category', v_quiz.category,
      'hsk_level', v_quiz.hsk_level,
      'status', v_quiz.status,
      'start_at', v_quiz.start_at,
      'deadline', v_quiz.deadline
    ),
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'question', i.question,
        'question_type', i.question_type,
        'hint', i.hint,
        'sort_order', i.sort_order,
        'options', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', o.id,
            'option_text', o.option_text,
            'sort_order', o.sort_order
          ) ORDER BY o.sort_order)
          FROM public.quiz_options o
          WHERE o.question_id = i.id
        ), '[]'::jsonb)
      ) ORDER BY i.sort_order)
      FROM public.quiz_items i
      WHERE i.quiz_id = p_quiz_id
    ), '[]'::jsonb)
  );
END;
$$;

-- 9. start_quiz_attempt: enforced start/deadline + one attempt per student ------
CREATE OR REPLACE FUNCTION public.start_quiz_attempt(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_quiz public.quizzes%ROWTYPE;
  v_attempt public.quiz_submissions%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Please sign in again.';
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found.';
  END IF;

  IF v_quiz.status <> 'active' THEN
    RAISE EXCEPTION 'This quiz is not available.';
  END IF;
  IF v_quiz.start_at IS NOT NULL AND now() < v_quiz.start_at THEN
    RAISE EXCEPTION 'This quiz has not started yet.';
  END IF;
  IF v_quiz.deadline IS NOT NULL AND now() > v_quiz.deadline THEN
    RAISE EXCEPTION 'This quiz has ended.';
  END IF;

  SELECT * INTO v_attempt FROM public.quiz_submissions
    WHERE quiz_id = p_quiz_id AND user_id = v_user AND status = 'submitted'
    ORDER BY submitted_at DESC LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('attempt_id', v_attempt.id, 'status', 'submitted');
  END IF;

  SELECT * INTO v_attempt FROM public.quiz_submissions
    WHERE quiz_id = p_quiz_id AND user_id = v_user AND status = 'in_progress'
    ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('attempt_id', v_attempt.id, 'status', 'in_progress');
  END IF;

  INSERT INTO public.quiz_submissions (quiz_id, user_id, started_at, status, total_questions)
  VALUES (
    p_quiz_id,
    v_user,
    now(),
    'in_progress',
    (SELECT count(*) FROM public.quiz_items WHERE quiz_id = p_quiz_id)
  )
  RETURNING * INTO v_attempt;

  RETURN jsonb_build_object('attempt_id', v_attempt.id, 'status', 'in_progress');
END;
$$;

-- 10. submit_quiz_attempt: authoritative grading + deadline + duplicate guard ---
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_quiz public.quizzes%ROWTYPE;
  v_attempt public.quiz_submissions%ROWTYPE;
  v_item record;
  v_selected uuid;
  v_correct_option uuid;
  v_is_correct boolean;
  v_total integer := 0;
  v_correct integer := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Please sign in again.';
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found.';
  END IF;

  IF v_quiz.status <> 'active' THEN
    RAISE EXCEPTION 'This quiz is not available.';
  END IF;

  -- Deadline is enforced here (server clock), not on the client.
  IF v_quiz.deadline IS NOT NULL AND now() > v_quiz.deadline THEN
    UPDATE public.quiz_submissions
      SET status = 'expired', updated_at = now()
      WHERE quiz_id = p_quiz_id AND user_id = v_user AND status = 'in_progress';
    RAISE EXCEPTION 'This quiz has ended.';
  END IF;

  -- Duplicate submission guard: return the existing result instead of grading again.
  SELECT * INTO v_attempt FROM public.quiz_submissions
    WHERE quiz_id = p_quiz_id AND user_id = v_user AND status = 'submitted'
    ORDER BY submitted_at DESC LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempt_id', v_attempt.id,
      'score', v_attempt.score,
      'total_questions', v_attempt.total_questions,
      'correct_answers', v_attempt.correct_answers,
      'wrong_answers', v_attempt.wrong_answers,
      'percentage', v_attempt.percentage,
      'status', 'submitted',
      'already_submitted', true
    );
  END IF;

  SELECT * INTO v_attempt FROM public.quiz_submissions
    WHERE quiz_id = p_quiz_id AND user_id = v_user AND status = 'in_progress'
    ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.quiz_submissions (quiz_id, user_id, started_at, status)
    VALUES (p_quiz_id, v_user, now(), 'in_progress')
    RETURNING * INTO v_attempt;
  END IF;

  DELETE FROM public.quiz_submission_answers WHERE attempt_id = v_attempt.id;

  FOR v_item IN
    SELECT * FROM public.quiz_items WHERE quiz_id = p_quiz_id ORDER BY sort_order
  LOOP
    v_total := v_total + 1;
    v_selected := NULLIF((
      SELECT a->>'selected_option_id'
      FROM jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) a
      WHERE a->>'question_id' = v_item.id::text
      LIMIT 1
    ), '')::uuid;

    SELECT id INTO v_correct_option
      FROM public.quiz_options
      WHERE question_id = v_item.id AND is_correct
      ORDER BY sort_order LIMIT 1;

    v_is_correct := (v_selected IS NOT NULL AND v_selected = v_correct_option);
    IF v_is_correct THEN
      v_correct := v_correct + 1;
    END IF;

    INSERT INTO public.quiz_submission_answers (
      attempt_id, question_id, selected_option_id, correct_option_id, is_correct, answered_at
    ) VALUES (
      v_attempt.id, v_item.id, v_selected, v_correct_option, v_is_correct, now()
    );
  END LOOP;

  UPDATE public.quiz_submissions SET
    submitted_at = now(),
    score = v_correct,
    total_questions = v_total,
    correct_answers = v_correct,
    wrong_answers = GREATEST(v_total - v_correct, 0),
    percentage = CASE WHEN v_total > 0
      THEN ROUND((v_correct::numeric / v_total) * 100, 2) ELSE 0 END,
    status = 'submitted',
    updated_at = now()
  WHERE id = v_attempt.id
  RETURNING * INTO v_attempt;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt.id,
    'score', v_attempt.score,
    'total_questions', v_attempt.total_questions,
    'correct_answers', v_attempt.correct_answers,
    'wrong_answers', v_attempt.wrong_answers,
    'percentage', v_attempt.percentage,
    'status', 'submitted',
    'already_submitted', false
  );
END;
$$;

-- 11. get_student_result: post-submission review with answers ------------------
CREATE OR REPLACE FUNCTION public.get_student_result(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.quiz_submissions%ROWTYPE;
  v_quiz public.quizzes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in again.';
  END IF;

  SELECT * INTO v_attempt FROM public.quiz_submissions
    WHERE quiz_id = p_quiz_id AND user_id = auth.uid() AND status = 'submitted'
    ORDER BY submitted_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_quiz FROM public.quizzes WHERE id = p_quiz_id;

  RETURN jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'score', v_attempt.score,
      'total_questions', v_attempt.total_questions,
      'correct_answers', v_attempt.correct_answers,
      'wrong_answers', v_attempt.wrong_answers,
      'percentage', v_attempt.percentage,
      'status', v_attempt.status,
      'started_at', v_attempt.started_at,
      'submitted_at', v_attempt.submitted_at
    ),
    'quiz', jsonb_build_object('id', v_quiz.id, 'title', v_quiz.title, 'deadline', v_quiz.deadline),
    'answers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'question_id', a.question_id,
        'question', i.question,
        'selected_option_id', a.selected_option_id,
        'student_answer', (SELECT o.option_text FROM public.quiz_options o WHERE o.id = a.selected_option_id),
        'correct_option_id', a.correct_option_id,
        'correct_answer', (SELECT o.option_text FROM public.quiz_options o WHERE o.id = a.correct_option_id),
        'is_correct', a.is_correct,
        'sort_order', i.sort_order,
        'word_id', i.word_id
      ) ORDER BY i.sort_order)
      FROM public.quiz_submission_answers a
      JOIN public.quiz_items i ON i.id = a.question_id
      WHERE a.attempt_id = v_attempt.id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_quiz(uuid, text, text, text, integer, text, timestamptz, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_quiz(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_quiz_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_result(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_quiz_attempt(uuid) TO authenticated;

-- Realtime: students get notification rows without a refresh (already published,
-- re-asserted here for completeness).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'quiz_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_notifications;
  END IF;
END;
$$;
