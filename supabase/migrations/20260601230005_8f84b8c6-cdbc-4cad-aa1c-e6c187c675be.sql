
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.seeker_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline text,
  summary text,
  desired_pay_min numeric,
  desired_shift public.job_shift,
  desired_employment_type public.employment_type,
  willing_to_relocate boolean NOT NULL DEFAULT false,
  certifications text[] NOT NULL DEFAULT '{}',
  skills text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seeker_profiles TO authenticated;
GRANT ALL ON public.seeker_profiles TO service_role;

ALTER TABLE public.seeker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seeker_profiles_owner_all" ON public.seeker_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "seeker_profiles_admin_all" ON public.seeker_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "seeker_profiles_employer_read_applicants" ON public.seeker_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.applicant_id = seeker_profiles.user_id
      AND j.posted_by = auth.uid()
  ));

CREATE TRIGGER seeker_profiles_set_updated_at
BEFORE UPDATE ON public.seeker_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.work_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employer_name text NOT NULL,
  title text NOT NULL,
  start_date date,
  end_date date,
  current boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX work_history_user_id_idx ON public.work_history(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_history TO authenticated;
GRANT ALL ON public.work_history TO service_role;

ALTER TABLE public.work_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_history_owner_all" ON public.work_history
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "work_history_admin_all" ON public.work_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "work_history_employer_read_applicants" ON public.work_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE a.applicant_id = work_history.user_id
      AND j.posted_by = auth.uid()
  ));

CREATE TRIGGER work_history_set_updated_at
BEFORE UPDATE ON public.work_history
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
