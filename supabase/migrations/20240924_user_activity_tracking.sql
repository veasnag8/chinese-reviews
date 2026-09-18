-- User Activity Tracking
-- Add last_active_at and is_online fields to profiles

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- Index for online users
CREATE INDEX IF NOT EXISTS idx_profiles_is_online ON public.profiles(is_online) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON public.profiles(last_active_at DESC);

-- Function to update user activity (call from client on page focus/activity)
CREATE OR REPLACE FUNCTION public.update_user_activity()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET last_active_at = NOW(),
      is_online = TRUE,
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_activity() TO authenticated;

-- Function to mark user as offline (call on page unload or session end)
CREATE OR REPLACE FUNCTION public.set_user_offline()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET is_online = FALSE,
      updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_offline() TO authenticated;

-- Function for admin to get all users with activity status
CREATE OR REPLACE FUNCTION public.get_all_users_with_activity()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role TEXT,
  last_active_at TIMESTAMPTZ,
  is_online BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.email, p.full_name,
         COALESCE(pr.role, 'student') as role,
         p.last_active_at,
         p.is_online,
         p.created_at
  FROM public.profiles p
  LEFT JOIN public.profiles pr ON pr.id = p.id
  ORDER BY p.last_active_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_with_activity() TO authenticated;

-- Policy for admin to view all profiles
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'teacher')
    )
  );