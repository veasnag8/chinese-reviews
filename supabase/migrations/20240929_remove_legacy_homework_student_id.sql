-- Homework is assigned globally. Remove the legacy per-student requirement
-- from databases that were created before global assignments were introduced.
DROP POLICY IF EXISTS "Students can view active personal assignments"
  ON public.for_you_assignments;

DROP INDEX IF EXISTS public.for_you_assignments_student_expiry_idx;

ALTER TABLE public.for_you_assignments
  DROP COLUMN IF EXISTS student_id CASCADE;

NOTIFY pgrst, 'reload schema';
