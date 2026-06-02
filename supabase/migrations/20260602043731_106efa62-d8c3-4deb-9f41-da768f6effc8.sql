
-- A. Admin superuser policies on every domain table.
-- Pattern: DROP IF EXISTS + CREATE "<table>_admin_all" allowing ALL ops when has_role(admin).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'profiles','user_roles','companies','jobs','job_categories','applications',
    'saved_jobs','job_alerts','orders','packages','company_packages',
    'advertisements','company_credits','credit_transactions','company_members',
    'screening_questions','application_answers','application_notes',
    'interview_slots','interview_bookings','seeker_profiles','notifications',
    'reviews','reports','abuse_reports','support_tickets','site_settings',
    'site_pages','faq_items','feature_flags','admin_permissions','deletion_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_all', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(),''admin''::public.app_role))',
        t || '_admin_all', t
      );
    END IF;
  END LOOP;
END $$;

-- C. Secure user_roles: replace the capability-based ALL policy with admin-only writes.
-- Non-admins keep self-SELECT only. has_role remains SECURITY DEFINER so it can read
-- user_roles without triggering its own policies.
DROP POLICY IF EXISTS user_roles_admin_capability ON public.user_roles;

-- user_roles_admin_all (created above) already grants admins full ALL.
-- user_roles_select_own already lets users see their own rows.
-- No INSERT/UPDATE/DELETE policy exists for non-admins -> they cannot mutate roles.

-- E. Bootstrap the first admin: if no admin exists, promote the earliest auth user.
-- Parameterized via app.seed_admin_email custom setting; falls back to oldest user.
DO $$
DECLARE
  v_seed_email text := current_setting('app.seed_admin_email', true);
  v_user_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) THEN
    RAISE NOTICE 'Admin already exists; skipping bootstrap.';
    RETURN;
  END IF;

  IF v_seed_email IS NOT NULL AND length(trim(v_seed_email)) > 0 THEN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_seed_email) LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;
    -- Also grant super_admin capability so admin_permissions-gated UI works.
    INSERT INTO public.admin_permissions (user_id, level)
    VALUES (v_user_id, 'super_admin')
    ON CONFLICT (user_id) DO UPDATE SET level = 'super_admin';
    RAISE NOTICE 'Bootstrapped admin role for user %', v_user_id;
  ELSE
    RAISE NOTICE 'No auth users found; bootstrap deferred.';
  END IF;
END $$;
