-- 1) Drop the leaky discoverable-profile read policy (exposed phone column)
DROP POLICY IF EXISTS profiles_discoverable_read ON public.profiles;

-- 2) Employers can read an applicant's profile only if that applicant applied
--    to a job they posted or are a member of the owning company. Mirrors the
--    pattern used elsewhere (e.g. applications_select_own_or_employer).
CREATE POLICY profiles_applicant_read
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
     WHERE a.applicant_id = profiles.id
       AND (
         j.posted_by = auth.uid()
         OR public.is_company_member(j.company_id, auth.uid())
       )
  )
);

-- 3) Phone-free view for the public candidate directory.
--    Runs with the view owner's privileges (definer-style) so it can read
--    profiles even though there is no discoverable SELECT policy on the base
--    table. Only safe, non-PII columns are projected.
CREATE OR REPLACE VIEW public.discoverable_candidates AS
SELECT
  p.id,
  p.display_name,
  p.location,
  p.avatar_url,
  p.created_at
FROM public.profiles p
JOIN public.seeker_profiles sp ON sp.user_id = p.id
WHERE sp.discoverable = true
  AND p.active = true
  AND p.deleted_at IS NULL;

GRANT SELECT ON public.discoverable_candidates TO authenticated;
