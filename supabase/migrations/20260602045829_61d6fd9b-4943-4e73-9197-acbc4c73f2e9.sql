-- Helper: returns current user's effective permission keys (admins get all)
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN ARRAY[]::text[]
    WHEN EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id
      WHERE ura.user_id = auth.uid() AND r.key = 'admin'
    ) THEN (SELECT COALESCE(array_agg(key), ARRAY[]::text[]) FROM public.permissions)
    ELSE COALESCE((
      SELECT array_agg(DISTINCT rp.permission_key)
        FROM public.user_role_assignments ura
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
       WHERE ura.user_id = auth.uid()
    ), ARRAY[]::text[])
  END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- ORDERS: allow permission holders to update/delete (admin already covered)
DROP POLICY IF EXISTS orders_perm_update ON public.orders;
CREATE POLICY orders_perm_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'orders.refund') OR public.has_permission(auth.uid(), 'orders.edit_any'))
  WITH CHECK (public.has_permission(auth.uid(), 'orders.refund') OR public.has_permission(auth.uid(), 'orders.edit_any'));

DROP POLICY IF EXISTS orders_perm_delete ON public.orders;
CREATE POLICY orders_perm_delete ON public.orders
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'orders.edit_any'));

-- JOBS: permission-based moderation
DROP POLICY IF EXISTS jobs_perm_update ON public.jobs;
CREATE POLICY jobs_perm_update ON public.jobs
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'jobs.moderate') OR public.has_permission(auth.uid(), 'jobs.edit_any'))
  WITH CHECK (public.has_permission(auth.uid(), 'jobs.moderate') OR public.has_permission(auth.uid(), 'jobs.edit_any'));

DROP POLICY IF EXISTS jobs_perm_delete ON public.jobs;
CREATE POLICY jobs_perm_delete ON public.jobs
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'jobs.delete_any') OR public.has_permission(auth.uid(), 'jobs.moderate'));

-- COMPANIES: suspend / edit any
DROP POLICY IF EXISTS companies_perm_update ON public.companies;
CREATE POLICY companies_perm_update ON public.companies
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'companies.suspend') OR public.has_permission(auth.uid(), 'companies.edit_any') OR public.has_permission(auth.uid(), 'companies.verify'))
  WITH CHECK (public.has_permission(auth.uid(), 'companies.suspend') OR public.has_permission(auth.uid(), 'companies.edit_any') OR public.has_permission(auth.uid(), 'companies.verify'));

-- PACKAGES: manage
DROP POLICY IF EXISTS packages_perm_write ON public.packages;
CREATE POLICY packages_perm_write ON public.packages
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'packages.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'packages.manage'));

-- ADVERTISEMENTS: manage
DROP POLICY IF EXISTS ads_perm_write ON public.advertisements;
CREATE POLICY ads_perm_write ON public.advertisements
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'ads.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'ads.manage'));
