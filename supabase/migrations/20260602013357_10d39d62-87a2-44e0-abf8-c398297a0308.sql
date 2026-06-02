
-- Company verification: extra columns, evidence storage, search_jobs RPC update
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified','pending','verified','rejected')),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verification_evidence_url text,
  ADD COLUMN IF NOT EXISTS verification_note text;

-- Backfill so already-verified companies have a consistent status
UPDATE public.companies
   SET verification_status = 'verified',
       verified_at = COALESCE(verified_at, now())
 WHERE verified = true AND verification_status = 'unverified';

-- Private storage bucket for verification evidence
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-verification', 'company-verification', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: company owners upload/read their own; moderation admins read all
DROP POLICY IF EXISTS "company_verif_owner_insert" ON storage.objects;
CREATE POLICY "company_verif_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-verification'
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_verif_read" ON storage.objects;
CREATE POLICY "company_verif_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-verification'
    AND (
      EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id::text = (storage.foldername(name))[1]
          AND c.owner_id = auth.uid()
      )
      OR public.has_admin_permission(auth.uid(), 'moderation')
    )
  );

-- Recreate search_jobs to surface company_verified for badges on JobCards
DROP FUNCTION IF EXISTS public.search_jobs(text, text, text, text, text, numeric, integer, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_jobs(
  p_query text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_shift text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_pay_min numeric DEFAULT NULL,
  p_radius_miles integer DEFAULT NULL,
  p_sort text DEFAULT 'relevance',
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, slug text, title text, location text,
  shift job_shift, employment_type employment_type,
  pay_min numeric, pay_max numeric, pay_period text,
  category text, featured boolean, created_at timestamptz,
  company_name text, company_slug text, company_verified boolean,
  rank real, distance_miles numeric, total_count bigint
)
LANGUAGE plpgsql STABLE SET search_path = public
AS $function$
DECLARE
  tsq tsquery;
  has_query boolean := p_query IS NOT NULL AND length(trim(p_query)) > 0;
  center_lat numeric;
  center_lng numeric;
  loc_trim text;
  loc_city text;
  loc_state text;
BEGIN
  IF has_query THEN
    tsq := websearch_to_tsquery('english', p_query);
  END IF;

  IF p_location IS NOT NULL AND length(trim(p_location)) > 0
     AND p_radius_miles IS NOT NULL AND p_radius_miles > 0 THEN
    loc_trim := trim(p_location);
    IF loc_trim ~ '^\d{5}' THEN
      SELECT z.lat, z.lng INTO center_lat, center_lng
        FROM public.zip_codes z WHERE z.zip = left(loc_trim, 5) LIMIT 1;
    END IF;
    IF center_lat IS NULL AND position(',' in loc_trim) > 0 THEN
      loc_city  := trim(split_part(loc_trim, ',', 1));
      loc_state := upper(trim(split_part(loc_trim, ',', 2)));
      SELECT AVG(z.lat), AVG(z.lng) INTO center_lat, center_lng
        FROM public.zip_codes z
       WHERE lower(z.city) = lower(loc_city) AND lower(z.state) = lower(loc_state);
    END IF;
    IF center_lat IS NULL THEN
      SELECT AVG(z.lat), AVG(z.lng) INTO center_lat, center_lng
        FROM public.zip_codes z
       WHERE lower(z.city) = lower(loc_trim);
    END IF;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      j.id, j.slug, j.title, j.location, j.shift, j.employment_type,
      j.pay_min, j.pay_max, j.pay_period, j.category, j.featured, j.created_at,
      c.name AS company_name, c.slug AS company_slug, c.verified AS company_verified,
      CASE WHEN has_query THEN ts_rank(j.search_vector, tsq) ELSE 0 END AS rank,
      CASE
        WHEN center_lat IS NOT NULL AND j.lat IS NOT NULL AND j.lng IS NOT NULL THEN
          3958.8 * 2 * asin(sqrt(
            power(sin(radians((j.lat - center_lat) / 2)), 2) +
            cos(radians(center_lat)) * cos(radians(j.lat)) *
            power(sin(radians((j.lng - center_lng) / 2)), 2)
          ))
        ELSE NULL
      END::numeric AS distance_miles
    FROM public.jobs j
    LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE j.status IN ('active','published')
      AND (NOT has_query OR j.search_vector @@ tsq)
      AND (p_location IS NULL
           OR j.location ILIKE '%' || p_location || '%'
           OR (center_lat IS NOT NULL AND j.lat IS NOT NULL AND j.lng IS NOT NULL))
      AND (p_category IS NULL OR j.category = p_category)
      AND (p_shift    IS NULL OR j.shift::text = p_shift)
      AND (p_type     IS NULL OR j.employment_type::text = p_type)
      AND (p_pay_min  IS NULL OR COALESCE(j.pay_max, j.pay_min) >= p_pay_min)
  ),
  filtered AS (
    SELECT b.* FROM base b
    WHERE p_radius_miles IS NULL
       OR center_lat IS NULL
       OR b.distance_miles IS NULL
       OR b.distance_miles <= p_radius_miles
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER ()::bigint AS total_count FROM filtered f
  )
  SELECT
    cc.id, cc.slug, cc.title, cc.location, cc.shift, cc.employment_type,
    cc.pay_min, cc.pay_max, cc.pay_period, cc.category, cc.featured, cc.created_at,
    cc.company_name, cc.company_slug, cc.company_verified,
    cc.rank, cc.distance_miles, cc.total_count
  FROM counted cc
  ORDER BY
    cc.featured DESC,
    CASE WHEN p_sort = 'relevance' AND has_query THEN cc.rank END DESC NULLS LAST,
    CASE WHEN p_sort = 'pay_high' THEN COALESCE(cc.pay_max, cc.pay_min) END DESC NULLS LAST,
    CASE WHEN p_radius_miles IS NOT NULL AND center_lat IS NOT NULL THEN cc.distance_miles END ASC NULLS LAST,
    cc.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;
