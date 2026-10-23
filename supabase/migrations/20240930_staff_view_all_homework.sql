-- Staff need the complete homework list to edit scheduled and expired items.
DROP POLICY IF EXISTS "Authenticated users can view active assignments"
  ON public.for_you_assignments;

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
