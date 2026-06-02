-- 1) Table
CREATE TABLE public.admin_permissions (
  user_id uuid PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('super_admin','moderator','finance','support')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_permissions_self_read ON public.admin_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- super_admins manage the table
CREATE POLICY admin_permissions_super_write ON public.admin_permissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = auth.uid() AND ap.level = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_permissions ap WHERE ap.user_id = auth.uid() AND ap.level = 'super_admin'));

-- 2) Capability helper
CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_permissions ap
    WHERE ap.user_id = _user_id
      AND (
        ap.level = 'super_admin'
        OR (ap.level = 'moderator' AND _capability IN ('moderation','ads','support'))
        OR (ap.level = 'finance'   AND _capability IN ('billing'))
        OR (ap.level = 'support'   AND _capability IN ('support','users'))
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_admin_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(uuid, text) TO authenticated, service_role;

-- 3) Tighten sensitive admin policies by capability.
-- Orders: keep admin read; restrict update/delete (refunds) to billing capability.
DROP POLICY IF EXISTS orders_admin_update ON public.orders;
DROP POLICY IF EXISTS orders_admin_delete ON public.orders;

CREATE POLICY orders_finance_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'billing'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'billing'));

CREATE POLICY orders_finance_delete ON public.orders
  FOR DELETE TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'billing'));

-- Packages: writes require settings capability (reads remain public for active).
DROP POLICY IF EXISTS packages_admin_write ON public.packages;
CREATE POLICY packages_settings_write ON public.packages
  FOR ALL TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'settings'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'settings'));

-- Zip codes: writes require settings capability.
DROP POLICY IF EXISTS zip_codes_admin_write ON public.zip_codes;
CREATE POLICY zip_codes_settings_write ON public.zip_codes
  FOR ALL TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'settings'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'settings'));

-- Advertisements: admin-wide write requires ads capability.
DROP POLICY IF EXISTS ads_admin_all ON public.advertisements;
CREATE POLICY ads_admin_capability ON public.advertisements
  FOR ALL TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'ads'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'ads'));

-- User roles: admin writes require users capability.
DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_capability ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'users'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'users'));

-- 4) Seed super_admin for stevengbates@gmail.com if the user exists.
INSERT INTO public.admin_permissions (user_id, level)
SELECT id, 'super_admin' FROM auth.users WHERE lower(email) = 'stevengbates@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET level = 'super_admin';

-- Also make sure they have the admin app role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'stevengbates@gmail.com'
ON CONFLICT DO NOTHING;
