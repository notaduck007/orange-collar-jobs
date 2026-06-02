-- ============================================================
-- Granular Roles & Permissions layer
-- ============================================================

-- 1) Catalog tables
CREATE TABLE IF NOT EXISTS public.permissions (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'General',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON public.user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);

-- 2) GRANTS
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_role_assignments TO authenticated;
GRANT ALL ON public.user_role_assignments TO service_role;

-- 3) Seed system roles
INSERT INTO public.roles (key, name, description, is_system) VALUES
  ('admin', 'Administrator', 'Full system access', true),
  ('employer', 'Employer', 'Company / hiring user', true),
  ('job_seeker', 'Job Seeker', 'Candidate searching for jobs', true)
ON CONFLICT (key) DO UPDATE SET is_system = true, name = EXCLUDED.name;

-- 4) Seed permissions catalog
INSERT INTO public.permissions (key, name, description, category) VALUES
  ('jobs.moderate',        'Moderate jobs',         'Review/flag/approve job postings', 'Jobs'),
  ('jobs.delete_any',      'Delete any job',        'Remove any job posting',           'Jobs'),
  ('jobs.edit_any',        'Edit any job',          'Edit any job posting',             'Jobs'),
  ('companies.view_all',   'View all companies',    'Browse all companies',             'Companies'),
  ('companies.edit_any',   'Edit any company',      'Modify any company',               'Companies'),
  ('companies.suspend',    'Suspend companies',     'Suspend or reactivate companies',  'Companies'),
  ('companies.verify',     'Verify companies',      'Approve company verification',     'Companies'),
  ('applications.view_all','View all applications', 'See applications across companies','Applications'),
  ('applications.edit_any','Edit any application',  'Modify any application',           'Applications'),
  ('orders.view_all',      'View all orders',       'See all billing orders',           'Billing'),
  ('orders.refund',        'Refund orders',         'Issue refunds',                    'Billing'),
  ('orders.edit_any',      'Edit any order',        'Modify any order',                 'Billing'),
  ('packages.manage',      'Manage packages',       'Create/edit pricing packages',     'Billing'),
  ('ads.manage',           'Manage advertisements', 'Approve and edit ads',             'Ads'),
  ('users.view_all',       'View all users',        'Browse all users',                 'Users'),
  ('users.manage_roles',   'Manage user roles',     'Grant/revoke roles to users',      'Users'),
  ('users.suspend',        'Suspend users',         'Disable user accounts',            'Users'),
  ('users.delete',         'Delete users',          'Permanently remove user accounts', 'Users'),
  ('roles.manage',         'Manage roles',          'Create/edit roles and permissions','Roles'),
  ('impersonate.use',      'Impersonate users',     'View site as another user',        'Admin'),
  ('settings.manage',      'Manage settings',       'Edit site settings and feature flags','Settings'),
  ('moderation.manage',    'Manage moderation',     'Handle reports and abuse cases',   'Moderation'),
  ('analytics.view',       'View analytics',        'Access admin analytics dashboards','Analytics'),
  ('audit.view',           'View audit log',        'Read the audit trail',             'Admin')
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category;

-- 5) Grant admin role every permission
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
  FROM public.roles r
  CROSS JOIN public.permissions p
 WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

-- 6) Backfill user_role_assignments from existing user_roles
INSERT INTO public.user_role_assignments (user_id, role_id, granted_at)
SELECT ur.user_id, r.id, COALESCE(ur.created_at, now())
  FROM public.user_roles ur
  JOIN public.roles r ON r.key = ur.role::text
ON CONFLICT DO NOTHING;

-- 7) Rewrite has_role to read from new structure (keeps signature)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.roles r ON r.id = ura.role_id
     WHERE ura.user_id = _user_id
       AND r.key = _role::text
  );
$$;

-- 8) has_permission helper (admins implicitly hold all permissions)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.roles r ON r.id = ura.role_id
       WHERE ura.user_id = _user_id
         AND r.key = 'admin'
    )
    OR EXISTS (
      SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
       WHERE ura.user_id = _user_id
         AND rp.permission_key = _permission_key
    );
$$;

-- 9) Keep legacy user_roles in sync with assignments for the 3 system roles
CREATE OR REPLACE FUNCTION public.sync_user_roles_from_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT key INTO v_key FROM public.roles WHERE id = NEW.role_id;
    IF v_key IN ('admin','employer','job_seeker') THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.user_id, v_key::public.app_role)
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT key INTO v_key FROM public.roles WHERE id = OLD.role_id;
    IF v_key IN ('admin','employer','job_seeker') THEN
      DELETE FROM public.user_roles WHERE user_id = OLD.user_id AND role = v_key::public.app_role;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_roles_from_assignment ON public.user_role_assignments;
CREATE TRIGGER trg_sync_user_roles_from_assignment
AFTER INSERT OR DELETE ON public.user_role_assignments
FOR EACH ROW EXECUTE FUNCTION public.sync_user_roles_from_assignment();

-- And reverse: legacy writes propagate into assignments
CREATE OR REPLACE FUNCTION public.sync_assignment_from_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id INTO v_role_id FROM public.roles WHERE key = NEW.role::text;
    IF v_role_id IS NOT NULL THEN
      INSERT INTO public.user_role_assignments (user_id, role_id)
      VALUES (NEW.user_id, v_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT id INTO v_role_id FROM public.roles WHERE key = OLD.role::text;
    IF v_role_id IS NOT NULL THEN
      DELETE FROM public.user_role_assignments
       WHERE user_id = OLD.user_id AND role_id = v_role_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_assignment_from_user_roles ON public.user_roles;
CREATE TRIGGER trg_sync_assignment_from_user_roles
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_from_user_roles();

-- 10) RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_assignments ENABLE ROW LEVEL SECURITY;

-- permissions: read all authenticated, write requires roles.manage
CREATE POLICY permissions_read ON public.permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_write ON public.permissions
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.manage'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles.manage'));

-- roles: read all authenticated, write requires roles.manage (system roles immutable except by admins)
CREATE POLICY roles_read ON public.roles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY roles_write ON public.roles
  FOR ALL TO authenticated
  USING (
    public.has_permission(auth.uid(), 'roles.manage')
    AND (NOT is_system OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
  WITH CHECK (
    public.has_permission(auth.uid(), 'roles.manage')
    AND (NOT is_system OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

-- role_permissions: read all authenticated, write requires roles.manage; cannot grant a permission you don't hold (unless admin)
CREATE POLICY role_permissions_read ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_write ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.manage'))
  WITH CHECK (
    public.has_permission(auth.uid(), 'roles.manage')
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_permission(auth.uid(), permission_key)
    )
  );

-- user_role_assignments: row owner or users.view_all can read; users.manage_roles can write; cannot self-grant a role you don't already hold (unless admin)
CREATE POLICY ura_read ON public.user_role_assignments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_permission(auth.uid(), 'users.view_all')
  );

CREATE POLICY ura_insert ON public.user_role_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission(auth.uid(), 'users.manage_roles')
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR user_id <> auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_role_assignments existing
         WHERE existing.user_id = auth.uid() AND existing.role_id = user_role_assignments.role_id
      )
    )
  );

CREATE POLICY ura_delete ON public.user_role_assignments
  FOR DELETE TO authenticated
  USING (
    public.has_permission(auth.uid(), 'users.manage_roles')
  );

CREATE POLICY ura_update ON public.user_role_assignments
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'users.manage_roles'))
  WITH CHECK (public.has_permission(auth.uid(), 'users.manage_roles'));
