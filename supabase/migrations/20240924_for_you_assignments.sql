-- Personal, expiring practice assigned by administrators.

-- Keep this migration safe to run on databases where earlier helper-function
-- migrations were not applied.
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

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.for_you_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('word', 'sentence')),
  chinese TEXT NOT NULL,
  pinyin TEXT,
  khmer TEXT,
  english TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT for_you_assignments_future_expiry CHECK (expires_at > created_at)
);

-- Earlier versions targeted one student. Assignments are now global, so make
-- rerunning this migration upgrade an existing installation as well.
DROP POLICY IF EXISTS "Students can view active personal assignments" ON public.for_you_assignments;
DROP INDEX IF EXISTS public.for_you_assignments_student_expiry_idx;
ALTER TABLE public.for_you_assignments
  DROP COLUMN IF EXISTS student_id;

CREATE INDEX IF NOT EXISTS for_you_assignments_expiry_idx
  ON public.for_you_assignments (expires_at DESC);

CREATE INDEX IF NOT EXISTS for_you_assignments_created_by_idx
  ON public.for_you_assignments (created_by, created_at DESC);

ALTER TABLE public.for_you_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view active personal assignments" ON public.for_you_assignments;
CREATE POLICY "Students can view active personal assignments"
  ON public.for_you_assignments
  FOR SELECT
  USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND expires_at > NOW())
  );

DROP POLICY IF EXISTS "Admins can create personal assignments" ON public.for_you_assignments;
CREATE POLICY "Admins can create personal assignments"
  ON public.for_you_assignments
  FOR INSERT
  WITH CHECK (public.is_admin() AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can update personal assignments" ON public.for_you_assignments;
CREATE POLICY "Admins can update personal assignments"
  ON public.for_you_assignments
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete personal assignments" ON public.for_you_assignments;
CREATE POLICY "Admins can delete personal assignments"
  ON public.for_you_assignments
  FOR DELETE
  USING (public.is_admin());

DROP TRIGGER IF EXISTS for_you_assignments_set_updated_at ON public.for_you_assignments;
CREATE TRIGGER for_you_assignments_set_updated_at
  BEFORE UPDATE ON public.for_you_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Make the new table immediately visible to Supabase's PostgREST API.
NOTIFY pgrst, 'reload schema';
