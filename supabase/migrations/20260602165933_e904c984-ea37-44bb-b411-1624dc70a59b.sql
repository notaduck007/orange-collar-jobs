-- 1) Split company_members read policy
DROP POLICY IF EXISTS company_members_read ON public.company_members;

-- Own row always visible
CREATE POLICY company_members_read_own
ON public.company_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Active members in the same company are visible to other active members
CREATE POLICY company_members_read_active_peers
ON public.company_members
FOR SELECT
TO authenticated
USING (
  status = 'active'
  AND is_company_member(company_id, auth.uid())
);

-- Owners/company admins see everything in their company (incl. pending invites + invited_email)
CREATE POLICY company_members_read_admin
ON public.company_members
FOR SELECT
TO authenticated
USING (is_company_admin(company_id, auth.uid()));

-- 2) Clear invited_email once an invite is accepted (link in handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'job_seeker');
  _invited_count int := 0;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  -- If they were invited as a team member, link them, activate, and clear invited_email
  UPDATE public.company_members
     SET user_id = NEW.id,
         status = 'active',
         invited_email = NULL
   WHERE status = 'invited'
     AND invited_email IS NOT NULL
     AND lower(invited_email) = lower(NEW.email);
  GET DIAGNOSTICS _invited_count = ROW_COUNT;

  IF _invited_count > 0 THEN
    _role := 'employer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 3) Backfill: clear invited_email on already-accepted member rows
UPDATE public.company_members
   SET invited_email = NULL
 WHERE status = 'active'
   AND user_id IS NOT NULL
   AND invited_email IS NOT NULL;
