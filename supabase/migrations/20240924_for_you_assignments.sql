-- Personal, expiring practice assigned by administrators.

CREATE TABLE IF NOT EXISTS public.for_you_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS for_you_assignments_student_expiry_idx
  ON public.for_you_assignments (student_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS for_you_assignments_created_by_idx
  ON public.for_you_assignments (created_by, created_at DESC);

ALTER TABLE public.for_you_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view active personal assignments" ON public.for_you_assignments;
CREATE POLICY "Students can view active personal assignments"
  ON public.for_you_assignments
  FOR SELECT
  USING (
    public.is_admin()
    OR (auth.uid() = student_id AND expires_at > NOW())
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
