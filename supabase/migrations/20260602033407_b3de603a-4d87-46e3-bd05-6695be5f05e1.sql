CREATE OR REPLACE FUNCTION public.feature_existing_job(_job_id uuid, _company_id uuid)
RETURNS TABLE(job_id uuid, company_package_id uuid, featured_until timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg record;
  v_job record;
BEGIN
  IF NOT (
    public.is_company_member(_company_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT j.* INTO v_job FROM public.jobs j
   WHERE j.id = _job_id AND j.company_id = _company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_not_found'; END IF;
  IF v_job.featured THEN
    RETURN QUERY SELECT v_job.id, v_job.company_package_id, v_job.featured_until;
    RETURN;
  END IF;

  SELECT cp.* INTO v_pkg
    FROM public.company_packages cp
   WHERE cp.company_id = _company_id
     AND cp.status = 'active'
     AND cp.expires_at > now()
     AND (cp.featured_total - cp.featured_used) >= 1
   ORDER BY cp.expires_at ASC
   LIMIT 1
   FOR UPDATE;
  IF v_pkg IS NULL THEN RAISE EXCEPTION 'no_featured_remaining'; END IF;

  UPDATE public.company_packages
     SET featured_used = featured_used + 1
   WHERE id = v_pkg.id;

  UPDATE public.jobs
     SET featured = true,
         featured_until = COALESCE(expires_at, v_pkg.expires_at)
   WHERE id = _job_id
   RETURNING id, company_package_id, featured_until
   INTO v_job;

  RETURN QUERY SELECT v_job.id, v_job.company_package_id, v_job.featured_until;
END;
$$;

GRANT EXECUTE ON FUNCTION public.feature_existing_job(uuid, uuid) TO authenticated;