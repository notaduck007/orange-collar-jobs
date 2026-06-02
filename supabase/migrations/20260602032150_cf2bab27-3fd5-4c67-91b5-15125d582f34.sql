-- consume_post_and_publish: atomically transition a draft to active (or insert a new active job),
-- attach to the company's active package, and consume 1 post (+ optional featured).
CREATE OR REPLACE FUNCTION public.consume_post_and_publish(
  _job_id uuid,
  _company_id uuid,
  _want_featured boolean DEFAULT false
)
RETURNS TABLE(
  job_id uuid,
  company_package_id uuid,
  expires_at timestamptz,
  featured boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg record;
  v_featured boolean := false;
  v_expires timestamptz;
BEGIN
  -- Authorization: caller must own/be member of the company or admin
  IF NOT (
    public.is_company_member(_company_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Lock the best active package row
  SELECT cp.*
  INTO v_pkg
  FROM public.company_packages cp
  WHERE cp.company_id = _company_id
    AND cp.status = 'active'
    AND cp.expires_at > now()
    AND (cp.posts_total - cp.posts_used) >= 1
    AND (NOT _want_featured OR (cp.featured_total - cp.featured_used) >= 1)
  ORDER BY cp.expires_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_pkg IS NULL THEN
    RAISE EXCEPTION 'no_active_package';
  END IF;

  v_expires := v_pkg.expires_at;

  -- Consume posts/featured
  UPDATE public.company_packages
  SET
    posts_used = posts_used + 1,
    featured_used = featured_used + CASE WHEN _want_featured THEN 1 ELSE 0 END,
    status = CASE
      WHEN (posts_used + 1) >= posts_total THEN 'depleted'
      ELSE status
    END
  WHERE id = v_pkg.id;

  v_featured := _want_featured;

  -- Flip the draft job to active and attach package
  UPDATE public.jobs
  SET
    status = 'active',
    posted_at = now(),
    company_package_id = v_pkg.id,
    expires_at = v_expires,
    featured = v_featured,
    featured_until = CASE WHEN v_featured THEN v_expires ELSE featured_until END
  WHERE id = _job_id
    AND company_id = _company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job_not_found';
  END IF;

  RETURN QUERY SELECT _job_id, v_pkg.id, v_expires, v_featured;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_post_and_publish(uuid, uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_post_and_publish(uuid, uuid, boolean) FROM anon;