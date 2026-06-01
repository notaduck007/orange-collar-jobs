CREATE OR REPLACE FUNCTION public.recommended_jobs(_user_id uuid, _limit int DEFAULT 10)
RETURNS TABLE(
  id uuid, slug text, title text, location text, shift job_shift, employment_type employment_type,
  pay_min numeric, pay_max numeric, category text, featured boolean, created_at timestamptz,
  company_name text, company_slug text, score int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sp public.seeker_profiles%ROWTYPE;
  prof public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO sp FROM public.seeker_profiles WHERE user_id = _user_id;
  SELECT * INTO prof FROM public.profiles WHERE id = _user_id;

  RETURN QUERY
  SELECT j.id, j.slug, j.title, j.location, j.shift, j.employment_type,
         j.pay_min, j.pay_max, j.category, j.featured, j.created_at,
         c.name, c.slug,
         (
           (CASE WHEN sp.desired_shift IS NOT NULL AND j.shift = sp.desired_shift THEN 3 ELSE 0 END) +
           (CASE WHEN sp.desired_employment_type IS NOT NULL AND j.employment_type = sp.desired_employment_type THEN 3 ELSE 0 END) +
           (CASE WHEN sp.desired_pay_min IS NOT NULL AND COALESCE(j.pay_max, j.pay_min) >= sp.desired_pay_min THEN 2 ELSE 0 END) +
           (CASE WHEN prof.location IS NOT NULL AND length(trim(prof.location)) > 0
                  AND j.location ILIKE '%' || prof.location || '%' THEN 3 ELSE 0 END) +
           (CASE WHEN sp.skills IS NOT NULL AND array_length(sp.skills, 1) > 0
                  AND EXISTS (
                    SELECT 1 FROM unnest(sp.skills) s
                    WHERE j.search_vector @@ plainto_tsquery('english', s)
                  ) THEN 2 ELSE 0 END) +
           (CASE WHEN sp.certifications IS NOT NULL AND array_length(sp.certifications, 1) > 0
                  AND EXISTS (
                    SELECT 1 FROM unnest(sp.certifications) ct
                    WHERE j.search_vector @@ plainto_tsquery('english', ct)
                  ) THEN 2 ELSE 0 END) +
           (CASE WHEN j.featured THEN 1 ELSE 0 END)
         )::int AS score
  FROM public.jobs j
  LEFT JOIN public.companies c ON c.id = j.company_id
  WHERE j.status IN ('active','published')
    AND NOT EXISTS (SELECT 1 FROM public.applications a WHERE a.job_id = j.id AND a.applicant_id = _user_id)
    AND NOT EXISTS (SELECT 1 FROM public.saved_jobs s WHERE s.job_id = j.id AND s.user_id = _user_id)
  ORDER BY score DESC, j.featured DESC, j.created_at DESC
  LIMIT _limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recommended_jobs(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recommended_jobs(uuid, int) TO authenticated;
