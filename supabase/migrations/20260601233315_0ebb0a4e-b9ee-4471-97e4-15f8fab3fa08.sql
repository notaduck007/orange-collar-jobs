-- 1) company_members table
CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  role text NOT NULL DEFAULT 'recruiter' CHECK (role IN ('owner','admin','recruiter')),
  invited_email text,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX idx_company_members_company ON public.company_members(company_id);
CREATE INDEX idx_company_members_user ON public.company_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_company_members_invited_email ON public.company_members(lower(invited_email)) WHERE invited_email IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- 2) Security-definer helpers (avoid recursive RLS lookups)
CREATE OR REPLACE FUNCTION public.is_company_member(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id = _user_id
      AND status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND owner_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id = _user_id
      AND status = 'active'
      AND role IN ('owner','admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND owner_id = _user_id
  )
$$;

-- 3) Policies on company_members
CREATE POLICY company_members_admin_all ON public.company_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY company_members_read ON public.company_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_company_member(company_id, auth.uid())
  );

CREATE POLICY company_members_owner_admin_manage ON public.company_members
  FOR ALL TO authenticated
  USING (public.is_company_admin(company_id, auth.uid()))
  WITH CHECK (public.is_company_admin(company_id, auth.uid()));

-- 4) Update RLS on jobs to grant access to members
DROP POLICY IF EXISTS jobs_owner_write ON public.jobs;
CREATE POLICY jobs_company_write ON public.jobs
  FOR ALL TO authenticated
  USING (
    posted_by = auth.uid()
    OR public.is_company_member(company_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    posted_by = auth.uid()
    OR public.is_company_member(company_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 5) applications: employer read/update via membership
DROP POLICY IF EXISTS applications_select_own_or_employer ON public.applications;
CREATE POLICY applications_select_own_or_employer ON public.applications
  FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = applications.job_id
        AND (j.posted_by = auth.uid() OR public.is_company_member(j.company_id, auth.uid()))
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS applications_update_employer ON public.applications;
CREATE POLICY applications_update_employer ON public.applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = applications.job_id
        AND (j.posted_by = auth.uid() OR public.is_company_member(j.company_id, auth.uid()))
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- 6) application_notes: members can read/write
DROP POLICY IF EXISTS application_notes_company_read ON public.application_notes;
CREATE POLICY application_notes_company_read ON public.application_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = application_notes.application_id
        AND (j.posted_by = auth.uid() OR public.is_company_member(j.company_id, auth.uid()))
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS application_notes_company_insert ON public.application_notes;
CREATE POLICY application_notes_company_insert ON public.application_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM public.applications a
        JOIN public.jobs j ON j.id = a.job_id
        WHERE a.id = application_notes.application_id
          AND (j.posted_by = auth.uid() OR public.is_company_member(j.company_id, auth.uid()))
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 7) advertisements: members can manage
DROP POLICY IF EXISTS ads_company_write ON public.advertisements;
CREATE POLICY ads_company_write ON public.advertisements
  FOR ALL TO authenticated
  USING (
    public.is_company_member(company_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_company_member(company_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- 8) Seed owners as company_members (owner role, active)
INSERT INTO public.company_members (company_id, user_id, role, status)
SELECT c.id, c.owner_id, 'owner', 'active'
FROM public.companies c
WHERE c.owner_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

-- 9) Auto-link invited members on signup + grant employer role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'job_seeker');
  _invited_count int := 0;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- If they were invited as a team member, link them and upgrade role to employer
  UPDATE public.company_members
     SET user_id = NEW.id, status = 'active'
   WHERE status = 'invited'
     AND invited_email IS NOT NULL
     AND lower(invited_email) = lower(NEW.email);
  GET DIAGNOSTICS _invited_count = ROW_COUNT;

  IF _invited_count > 0 THEN
    _role := 'employer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;