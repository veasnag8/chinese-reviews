-- Add scheduling and display fields for image-based homework.
-- Homework is global, so remove the legacy required student reference when
-- this migration is run directly against an older database.
DROP POLICY IF EXISTS "Students can view active personal assignments"
  ON public.for_you_assignments;
DROP INDEX IF EXISTS public.for_you_assignments_student_expiry_idx;
ALTER TABLE public.for_you_assignments
  DROP COLUMN IF EXISTS student_id CASCADE;

ALTER TABLE public.for_you_assignments
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;

-- Preserve existing assignments when upgrading an existing database.
UPDATE public.for_you_assignments
SET
  title = COALESCE(NULLIF(title, ''), NULLIF(chinese, ''), 'Homework'),
  starts_at = COALESCE(starts_at, created_at)
WHERE title IS NULL OR starts_at IS NULL;

ALTER TABLE public.for_you_assignments
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN starts_at SET NOT NULL;

ALTER TABLE public.for_you_assignments
  DROP CONSTRAINT IF EXISTS for_you_assignments_valid_schedule;

ALTER TABLE public.for_you_assignments
  ADD CONSTRAINT for_you_assignments_valid_schedule
  CHECK (expires_at > starts_at);

CREATE INDEX IF NOT EXISTS for_you_assignments_schedule_idx
  ON public.for_you_assignments (starts_at, expires_at);

DROP POLICY IF EXISTS "Authenticated users can view active assignments" ON public.for_you_assignments;
CREATE POLICY "Authenticated users can view active assignments"
  ON public.for_you_assignments
  FOR SELECT
  USING (
    public.is_staff()
    OR (
      auth.uid() IS NOT NULL
      AND starts_at <= NOW()
      AND expires_at > NOW()
    )
  );

NOTIFY pgrst, 'reload schema';
