-- Daily Review Tracking
-- Track user daily Chinese review completion (Monday-Friday, once per day)

CREATE TABLE IF NOT EXISTS public.daily_review_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  review_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, review_date)
);

ALTER TABLE public.daily_review_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily review completions" ON public.daily_review_completions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create daily review completions" ON public.daily_review_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_review_completions_user_date
  ON public.daily_review_completions (user_id, review_date);

-- Function to check if user has completed today's review
CREATE OR REPLACE FUNCTION public.has_completed_daily_review()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.daily_review_completions
    WHERE user_id = auth.uid()
    AND review_date = CURRENT_DATE
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_completed_daily_review() TO authenticated;

-- Function to mark daily review as completed
CREATE OR REPLACE FUNCTION public.complete_daily_review()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Please sign in again.';
  END IF;

  INSERT INTO public.daily_review_completions (user_id, review_date)
  VALUES (v_user, CURRENT_DATE)
  ON CONFLICT (user_id, review_date) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_daily_review() TO authenticated;

-- Function to check if today is a review day (Monday-Friday)
CREATE OR REPLACE FUNCTION public.is_review_day()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXTRACT(DOW FROM CURRENT_DATE) BETWEEN 1 AND 5;
$$;

GRANT EXECUTE ON FUNCTION public.is_review_day() TO authenticated;