
-- Protect system roles from delete/rename, allow editing description/name only for non-system
CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_system THEN
    RAISE EXCEPTION 'System roles cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_system THEN
    IF NEW.key IS DISTINCT FROM OLD.key THEN
      RAISE EXCEPTION 'System role key cannot be changed';
    END IF;
    IF NEW.is_system IS DISTINCT FROM OLD.is_system THEN
      RAISE EXCEPTION 'Cannot toggle is_system on a system role';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_protect_system_roles ON public.roles;
CREATE TRIGGER trg_protect_system_roles
  BEFORE UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

-- Prevent reducing admin role permissions (admin keeps everything)
CREATE OR REPLACE FUNCTION public.protect_admin_permissions()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE admin_role_id uuid;
BEGIN
  SELECT id INTO admin_role_id FROM public.roles WHERE key = 'admin';
  IF TG_OP = 'DELETE' AND OLD.role_id = admin_role_id THEN
    RAISE EXCEPTION 'Cannot remove permissions from the admin role';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_protect_admin_perms ON public.role_permissions;
CREATE TRIGGER trg_protect_admin_perms
  BEFORE DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.protect_admin_permissions();

-- Backfill: ensure admin role has every permission
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.roles r CROSS JOIN public.permissions p
WHERE r.key = 'admin'
ON CONFLICT DO NOTHING;

-- Prevent removing last admin via user_role_assignments
CREATE OR REPLACE FUNCTION public.protect_last_admin_assignment()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE admin_role_id uuid; remaining int;
BEGIN
  SELECT id INTO admin_role_id FROM public.roles WHERE key = 'admin';
  IF OLD.role_id = admin_role_id THEN
    SELECT count(*) INTO remaining
      FROM public.user_role_assignments
      WHERE role_id = admin_role_id AND user_id <> OLD.user_id;
    IF remaining = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last administrator';
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_protect_last_admin ON public.user_role_assignments;
CREATE TRIGGER trg_protect_last_admin
  BEFORE DELETE ON public.user_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin_assignment();

-- Prevent self role escalation: a non-admin cannot grant/revoke roles on themselves
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE me uuid; target uuid;
BEGIN
  me := auth.uid();
  target := COALESCE(NEW.user_id, OLD.user_id);
  IF me IS NOT NULL AND target = me THEN
    IF NOT public.has_role(me, 'admin'::app_role) THEN
      RAISE EXCEPTION 'You cannot modify your own role assignments';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.user_role_assignments;
CREATE TRIGGER trg_prevent_self_role_change
  BEFORE INSERT OR DELETE ON public.user_role_assignments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();

-- RPC: get effective permissions for any user (admins / users.view_all readers can call)
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT rp.permission_key
  FROM public.user_role_assignments ura
  JOIN public.role_permissions rp ON rp.role_id = ura.role_id
  WHERE ura.user_id = _user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_permissions(uuid) TO authenticated;

-- RPC: member counts per role
CREATE OR REPLACE FUNCTION public.role_member_counts()
RETURNS TABLE(role_id uuid, member_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role_id, count(*)::bigint
  FROM public.user_role_assignments
  GROUP BY role_id;
$$;
GRANT EXECUTE ON FUNCTION public.role_member_counts() TO authenticated;
