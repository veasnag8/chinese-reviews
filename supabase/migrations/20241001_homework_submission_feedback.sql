-- Let staff request corrections or finish checking a homework submission.
ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS remark TEXT;

ALTER TABLE public.homework_submissions
  DROP CONSTRAINT IF EXISTS homework_submissions_status_check;

ALTER TABLE public.homework_submissions
  ADD CONSTRAINT homework_submissions_status_check
  CHECK (status IN ('pending_checking', 'needs_revision', 'checked'));

NOTIFY pgrst, 'reload schema';
