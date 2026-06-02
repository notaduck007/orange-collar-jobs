
-- 1. Add '*' wildcard permission
INSERT INTO public.permissions (key, name, description, category)
VALUES ('*', 'All permissions (wildcard)', 'Holder bypasses every permission check', 'System')
ON CONFLICT (key) DO NOTHING;

-- 2. has_admin_permission: super-admin bypass via app_role 'admin'
CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id uuid, _capability text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    -- System 'admin' role always bypasses
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
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
$function$;

-- 3. has_permission: explicit admin role bypass + wildcard support
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1
        FROM public.user_role_assignments ura
        JOIN public.role_permissions rp ON rp.role_id = ura.role_id
       WHERE ura.user_id = _user_id
         AND (rp.permission_key = _permission_key OR rp.permission_key = '*')
    );
$function$;

-- 4. Grant every catalog permission (including '*') to the admin system role
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

-- 5. Backfill: any user marked super_admin in legacy admin_permissions, or holding
-- the legacy 'admin' app_role in user_roles, must also have the admin system role
-- in user_role_assignments so client/server checks resolve them as admins.
INSERT INTO public.user_role_assignments (user_id, role_id)
SELECT ap.user_id, r.id
FROM public.admin_permissions ap
JOIN public.roles r ON r.key = 'admin'
WHERE ap.level = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_role_assignments (user_id, role_id)
SELECT ur.user_id, r.id
FROM public.user_roles ur
JOIN public.roles r ON r.key = 'admin'
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;
