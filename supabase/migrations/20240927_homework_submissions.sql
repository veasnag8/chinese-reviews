-- Homework attachments and per-student answer tracking.
ALTER TABLE public.for_you_assignments
  ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Teachers and administrators can manage homework.
DROP POLICY IF EXISTS "Admins can create personal assignments" ON public.for_you_assignments;
DROP POLICY IF EXISTS "Staff can create homework" ON public.for_you_assignments;
CREATE POLICY "Staff can create homework"
  ON public.for_you_assignments FOR INSERT
  WITH CHECK (public.is_staff() AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can update personal assignments" ON public.for_you_assignments;
DROP POLICY IF EXISTS "Staff can update homework" ON public.for_you_assignments;
CREATE POLICY "Staff can update homework"
  ON public.for_you_assignments FOR UPDATE
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "Admins can delete personal assignments" ON public.for_you_assignments;
DROP POLICY IF EXISTS "Staff can delete homework" ON public.for_you_assignments;
CREATE POLICY "Staff can delete homework"
  ON public.for_you_assignments FOR DELETE
  USING (public.is_staff());

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.for_you_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_image_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_checking'
    CHECK (status IN ('pending_checking', 'checked')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (assignment_id, user_id)
);

CREATE INDEX IF NOT EXISTS homework_submissions_assignment_idx
  ON public.homework_submissions (assignment_id, status, submitted_at DESC);

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own homework submissions" ON public.homework_submissions;
CREATE POLICY "Students can view own homework submissions"
  ON public.homework_submissions FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff());

DROP POLICY IF EXISTS "Students can submit homework" ON public.homework_submissions;
CREATE POLICY "Students can submit homework"
  ON public.homework_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending_checking');

DROP POLICY IF EXISTS "Students can resubmit homework" ON public.homework_submissions;
CREATE POLICY "Students can resubmit homework"
  ON public.homework_submissions FOR UPDATE
  USING (auth.uid() = user_id OR public.is_staff())
  WITH CHECK (
    (auth.uid() = user_id AND status = 'pending_checking' AND checked_at IS NULL AND checked_by IS NULL)
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "Staff can delete homework submissions" ON public.homework_submissions;
CREATE POLICY "Staff can delete homework submissions"
  ON public.homework_submissions FOR DELETE
  USING (public.is_staff());

-- A private bucket keeps student work from being publicly accessible.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homework-files',
  'homework-files',
  FALSE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can view homework prompts" ON storage.objects;
CREATE POLICY "Authenticated users can view homework prompts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'homework-files' AND (storage.foldername(name))[1] = 'assignments');

DROP POLICY IF EXISTS "Staff can manage homework prompts" ON storage.objects;
CREATE POLICY "Staff can manage homework prompts"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'homework-files' AND (storage.foldername(name))[1] = 'assignments' AND public.is_staff())
  WITH CHECK (bucket_id = 'homework-files' AND (storage.foldername(name))[1] = 'assignments' AND public.is_staff());

DROP POLICY IF EXISTS "Users and staff can view homework answers" ON storage.objects;
CREATE POLICY "Users and staff can view homework answers"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'submissions'
    AND ((storage.foldername(name))[2] = auth.uid()::TEXT OR public.is_staff())
  );

DROP POLICY IF EXISTS "Users can upload homework answers" ON storage.objects;
CREATE POLICY "Users can upload homework answers"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'submissions'
    AND (storage.foldername(name))[2] = auth.uid()::TEXT
  );

DROP POLICY IF EXISTS "Users can replace homework answers" ON storage.objects;
CREATE POLICY "Users can replace homework answers"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'submissions'
    AND ((storage.foldername(name))[2] = auth.uid()::TEXT OR public.is_staff())
  )
  WITH CHECK (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'submissions'
    AND ((storage.foldername(name))[2] = auth.uid()::TEXT OR public.is_staff())
  );

DROP POLICY IF EXISTS "Users can delete own homework answers" ON storage.objects;
CREATE POLICY "Users can delete own homework answers"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'homework-files'
    AND (storage.foldername(name))[1] = 'submissions'
    AND ((storage.foldername(name))[2] = auth.uid()::TEXT OR public.is_staff())
  );

NOTIFY pgrst, 'reload schema';
