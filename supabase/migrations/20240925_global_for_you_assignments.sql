-- Make each For You assignment available to every authenticated user.

DROP POLICY IF EXISTS "Students can view active personal assignments" ON public.for_you_assignments;
DROP POLICY IF EXISTS "Authenticated users can view active assignments" ON public.for_you_assignments;

DROP INDEX IF EXISTS public.for_you_assignments_student_expiry_idx;

ALTER TABLE public.for_you_assignments
  DROP COLUMN IF EXISTS student_id;

CREATE INDEX IF NOT EXISTS for_you_assignments_expiry_idx
  ON public.for_you_assignments (expires_at DESC);

CREATE POLICY "Authenticated users can view active assignments"
  ON public.for_you_assignments
  FOR SELECT
  USING (
    public.is_admin()
    OR (auth.uid() IS NOT NULL AND expires_at > NOW())
  );

NOTIFY pgrst, 'reload schema';
