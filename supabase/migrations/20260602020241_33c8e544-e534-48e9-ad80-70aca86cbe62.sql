
-- Privacy: soft-delete & DSR
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pii_anonymized_at timestamptz;

CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested_by uuid,
  type text NOT NULL CHECK (type IN ('export','delete')),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','completed','rejected','cancelled')),
  reason text,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY deletion_requests_owner_read ON public.deletion_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_admin_permission(auth.uid(), 'support'));

CREATE POLICY deletion_requests_owner_insert ON public.deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR has_admin_permission(auth.uid(), 'support'));

CREATE POLICY deletion_requests_admin_update ON public.deletion_requests
  FOR UPDATE TO authenticated
  USING (has_admin_permission(auth.uid(), 'support'))
  WITH CHECK (has_admin_permission(auth.uid(), 'support'));

CREATE TRIGGER deletion_requests_updated_at
  BEFORE UPDATE ON public.deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Anonymize user PII while preserving aggregate counts
CREATE OR REPLACE FUNCTION public.anonymize_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _suffix text := substring(_user_id::text, 1, 8);
BEGIN
  -- Anonymize profile
  UPDATE public.profiles
     SET display_name = 'Deleted user',
         full_name = NULL,
         phone = NULL,
         location = NULL,
         avatar_url = NULL,
         default_resume_url = NULL,
         active = false,
         deleted_at = COALESCE(deleted_at, now()),
         pii_anonymized_at = now(),
         updated_at = now()
   WHERE id = _user_id;

  -- Anonymize seeker profile (preserve aggregate skill stats but clear identifying narrative)
  UPDATE public.seeker_profiles
     SET headline = NULL, summary = NULL, discoverable = false, updated_at = now()
   WHERE user_id = _user_id;

  -- Anonymize applications: keep row + job_id for aggregate counts, scrub PII
  UPDATE public.applications
     SET cover_letter = NULL, resume_url = NULL
   WHERE applicant_id = _user_id;

  -- Anonymize reviews authored by user but keep aggregate ratings
  UPDATE public.reviews
     SET body = '[Removed at user request]', title = NULL
   WHERE author_id = _user_id;

  -- Clear personal saved jobs / alerts (these are private, no aggregate value)
  DELETE FROM public.saved_jobs WHERE user_id = _user_id;
  DELETE FROM public.job_alerts WHERE applicant_id = _user_id;

  -- Clear work history narrative
  UPDATE public.work_history
     SET description = NULL, employer_name = 'Redacted'
   WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_user(uuid) TO service_role;

-- Seed privacy policy page (idempotent)
INSERT INTO public.site_pages (slug, title, body, published)
VALUES ('privacy', 'Privacy Policy',
'# Privacy Policy

We respect your privacy. This page explains what data we collect and your rights.

## Data we collect
- Account info (email, name)
- Profile and resume content you upload
- Applications, saved jobs, alerts, and reviews

## Your rights
- **Export**: download a copy of your data anytime from your account settings.
- **Delete**: request account deletion. Your PII will be anonymized while aggregate counts (e.g. application totals) are preserved.

## Contact
Email us at support for any privacy questions.', true)
ON CONFLICT (slug) DO NOTHING;
