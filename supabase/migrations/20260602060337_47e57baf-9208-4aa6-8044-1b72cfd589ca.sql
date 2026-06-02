
-- Roles
INSERT INTO public.roles (key, name, description, is_system) VALUES
  ('moderator','Moderator','Content moderation, ads, and basic support', false),
  ('finance','Finance','Billing, refunds, and order management', false),
  ('support','Support','User support and account assistance', false)
ON CONFLICT (key) DO NOTHING;

WITH r AS (SELECT id, key FROM public.roles WHERE key IN ('moderator','finance','support'))
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM r
JOIN LATERAL (
  SELECT unnest(CASE r.key
    WHEN 'moderator' THEN ARRAY['moderation.manage','jobs.moderate','jobs.edit_any','jobs.delete_any','ads.manage','users.view_all']
    WHEN 'finance'   THEN ARRAY['orders.view_all','orders.refund','orders.edit_any','packages.manage']
    WHEN 'support'   THEN ARRAY['users.view_all','users.suspend','users.delete']
  END) AS key
) p ON true
WHERE EXISTS (SELECT 1 FROM public.permissions pp WHERE pp.key = p.key)
ON CONFLICT DO NOTHING;

-- Backfill
INSERT INTO public.user_role_assignments (user_id, role_id)
SELECT ap.user_id, r.id
FROM public.admin_permissions ap
JOIN public.roles r ON r.key = CASE ap.level
  WHEN 'super_admin' THEN 'admin'
  WHEN 'moderator'   THEN 'moderator'
  WHEN 'finance'     THEN 'finance'
  WHEN 'support'     THEN 'support'
END
ON CONFLICT DO NOTHING;

-- Drop legacy policies (these are redundant or being replaced)
DROP POLICY IF EXISTS ads_admin_capability ON public.advertisements;
DROP POLICY IF EXISTS orders_finance_delete ON public.orders;
DROP POLICY IF EXISTS orders_finance_update ON public.orders;
DROP POLICY IF EXISTS packages_settings_write ON public.packages;
DROP POLICY IF EXISTS feature_flags_super_admin_all ON public.feature_flags;
DROP POLICY IF EXISTS site_settings_super_admin_all ON public.site_settings;

-- deletion_requests
DROP POLICY IF EXISTS deletion_requests_admin_update ON public.deletion_requests;
DROP POLICY IF EXISTS deletion_requests_owner_insert ON public.deletion_requests;
DROP POLICY IF EXISTS deletion_requests_owner_read ON public.deletion_requests;
CREATE POLICY deletion_requests_owner_read ON public.deletion_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'users.delete'));
CREATE POLICY deletion_requests_owner_insert ON public.deletion_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_permission(auth.uid(), 'users.delete'));
CREATE POLICY deletion_requests_admin_update ON public.deletion_requests
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'users.delete'))
  WITH CHECK (public.has_permission(auth.uid(), 'users.delete'));

-- faq_items
DROP POLICY IF EXISTS faq_items_public_read ON public.faq_items;
DROP POLICY IF EXISTS faq_items_settings_write ON public.faq_items;
CREATE POLICY faq_items_public_read ON public.faq_items
  FOR SELECT TO anon, authenticated
  USING (published = true OR public.has_permission(auth.uid(), 'settings.manage'));
CREATE POLICY faq_items_settings_write ON public.faq_items
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'settings.manage'));

-- reports
DROP POLICY IF EXISTS reports_support_all ON public.reports;
CREATE POLICY reports_support_all ON public.reports
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'moderation.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'moderation.manage'));

-- reviews
DROP POLICY IF EXISTS reviews_moderation ON public.reviews;
CREATE POLICY reviews_moderation ON public.reviews
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'moderation.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'moderation.manage'));

-- site_pages
DROP POLICY IF EXISTS site_pages_public_read ON public.site_pages;
DROP POLICY IF EXISTS site_pages_settings_write ON public.site_pages;
CREATE POLICY site_pages_public_read ON public.site_pages
  FOR SELECT TO anon, authenticated
  USING (published = true OR public.has_permission(auth.uid(), 'settings.manage'));
CREATE POLICY site_pages_settings_write ON public.site_pages
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'settings.manage'));

-- site_settings
DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;
CREATE POLICY site_settings_public_read ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (is_public = true OR public.has_permission(auth.uid(), 'settings.manage'));

-- zip_codes
DROP POLICY IF EXISTS zip_codes_settings_write ON public.zip_codes;
CREATE POLICY zip_codes_settings_write ON public.zip_codes
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'settings.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'settings.manage'));

-- support_tickets
DROP POLICY IF EXISTS support_tickets_support_all ON public.support_tickets;
CREATE POLICY support_tickets_support_all ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'users.view_all'))
  WITH CHECK (public.has_permission(auth.uid(), 'users.view_all'));

-- storage: company verification
DROP POLICY IF EXISTS company_verif_read ON storage.objects;
CREATE POLICY company_verif_read ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'company-verification'
    AND (
      EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.owner_id = auth.uid()
      )
      OR public.has_permission(auth.uid(), 'companies.verify')
    )
  );

-- Drop legacy table & helper
DROP POLICY IF EXISTS admin_permissions_admin_all ON public.admin_permissions;
DROP POLICY IF EXISTS admin_permissions_self_read ON public.admin_permissions;
DROP POLICY IF EXISTS admin_permissions_super_write ON public.admin_permissions;
DROP TABLE IF EXISTS public.admin_permissions;
DROP FUNCTION IF EXISTS public.has_admin_permission(uuid, text);
