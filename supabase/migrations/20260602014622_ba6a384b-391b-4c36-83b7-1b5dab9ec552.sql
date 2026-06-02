-- site_settings: key/value store for app-wide settings
CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY site_settings_super_admin_all ON public.site_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = auth.uid() AND ap.level = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = auth.uid() AND ap.level = 'super_admin'));

-- Authenticated users can read public settings (admins read all)
CREATE POLICY site_settings_public_read ON public.site_settings
  FOR SELECT TO authenticated
  USING (is_public = true OR has_admin_permission(auth.uid(), 'settings'::text));

-- feature_flags
CREATE TABLE public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  rollout_pct integer NOT NULL DEFAULT 100 CHECK (rollout_pct BETWEEN 0 AND 100),
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_flags_super_admin_all ON public.feature_flags
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = auth.uid() AND ap.level = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = auth.uid() AND ap.level = 'super_admin'));

CREATE POLICY feature_flags_authenticated_read ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

-- Public RPC returning ONLY non-sensitive public settings + feature flags
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'settings', COALESCE((SELECT jsonb_object_agg(key, value) FROM public.site_settings WHERE is_public = true), '{}'::jsonb),
    'flags', COALESCE((SELECT jsonb_object_agg(key, jsonb_build_object('enabled', enabled, 'rollout_pct', rollout_pct)) FROM public.feature_flags), '{}'::jsonb)
  )
$$;

GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- Seed default public settings
INSERT INTO public.site_settings (key, value, is_public) VALUES
  ('branding', jsonb_build_object('site_name', 'JobBoard', 'logo_url', '', 'support_email', 'support@example.com'), true),
  ('defaults', jsonb_build_object('job_duration_days', 30, 'free_post_allowance', 1), true),
  ('toggles', jsonb_build_object('reviews_enabled', true, 'candidate_search_enabled', true, 'require_email_verification', false), true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.feature_flags (key, enabled, rollout_pct, description) VALUES
  ('new_dashboard', false, 0, 'Enable the new dashboard experience'),
  ('ai_recommendations', true, 100, 'Show AI-powered job recommendations')
ON CONFLICT (key) DO NOTHING;
