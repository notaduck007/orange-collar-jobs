-- Drop the view (flagged by linter as SECURITY DEFINER view)
DROP VIEW IF EXISTS public.discoverable_candidates;

-- Replace with a SECURITY DEFINER function that returns only safe public fields.
-- Only authenticated users may execute it; anon is explicitly revoked.
CREATE OR REPLACE FUNCTION public.list_discoverable_candidates()
RETURNS TABLE (
  id uuid,
  display_name text,
  location text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.location, p.avatar_url, p.created_at
    FROM public.profiles p
    JOIN public.seeker_profiles sp ON sp.user_id = p.id
   WHERE sp.discoverable = true
     AND p.active = true
     AND p.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.list_discoverable_candidates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_discoverable_candidates() TO authenticated;
