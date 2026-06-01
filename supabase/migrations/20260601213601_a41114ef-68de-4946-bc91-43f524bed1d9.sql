
-- 1. Add 'active' to job_status enum (used by RLS public-read)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'job_status' AND e.enumlabel = 'active'
  ) THEN
    ALTER TYPE public.job_status ADD VALUE 'active';
  END IF;
END $$;

-- 2. Replace jobs public-read policy to allow status in ('active','published')
DROP POLICY IF EXISTS jobs_public_read_published ON public.jobs;
CREATE POLICY "jobs_public_read_active"
  ON public.jobs FOR SELECT
  TO anon, authenticated
  USING (
    status::text IN ('active','published')
    OR posted_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- 3. Let applicants withdraw (delete) their own applications
DROP POLICY IF EXISTS applications_delete_own ON public.applications;
CREATE POLICY "applications_delete_own"
  ON public.applications FOR DELETE
  TO authenticated
  USING (applicant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. Admin override for full application management
DROP POLICY IF EXISTS applications_admin_all ON public.applications;
CREATE POLICY "applications_admin_all"
  ON public.applications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
