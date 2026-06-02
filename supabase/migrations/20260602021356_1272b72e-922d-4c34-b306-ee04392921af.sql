-- Add warehouse-specific attributes to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS lift_requirement_lbs integer,
  ADD COLUMN IF NOT EXISTS certifications_required text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS temperature_env text,
  ADD COLUMN IF NOT EXISTS overtime_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_pay boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quick_hire boolean NOT NULL DEFAULT false;

-- Validate enum-like values via CHECK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_temperature_env_check') THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_temperature_env_check
      CHECK (temperature_env IS NULL OR temperature_env IN ('ambient','cooler','freezer'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_temperature_env ON public.jobs(temperature_env) WHERE temperature_env IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_certifications_required ON public.jobs USING GIN (certifications_required);
CREATE INDEX IF NOT EXISTS idx_jobs_weekly_pay ON public.jobs(weekly_pay) WHERE weekly_pay = true;
CREATE INDEX IF NOT EXISTS idx_jobs_quick_hire ON public.jobs(quick_hire) WHERE quick_hire = true;
CREATE INDEX IF NOT EXISTS idx_jobs_overtime_available ON public.jobs(overtime_available) WHERE overtime_available = true;

-- Extend search_jobs with new filter params + return the new columns
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
  p_offset integer DEFAULT 0,
  p_temperature_env text DEFAULT NULL,
  p_certifications text[] DEFAULT NULL,
  p_weekly_pay boolean DEFAULT NULL,
  p_quick_hire boolean DEFAULT NULL,
  p_overtime boolean DEFAULT NULL,
  p_max_lift integer DEFAULT NULL
)
RETURNS TABLE(
  id uuid, slug text, title text, location text,
  shift public.job_shift, employment_type public.employment_type,
  pay_min numeric, pay_max numeric, pay_period text, category text, featured boolean,
  created_at timestamptz, company_name text, company_slug text, company_verified boolean,
  rank real, distance_miles numeric,
  temperature_env text, certifications_required text[],
  weekly_pay boolean, quick_hire boolean, overtime_available boolean, lift_requirement_lbs integer,
  total_count bigint
)
LANGUAGE plpgsql STABLE SET search_path TO 'public'
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
      END::numeric AS distance_miles,
      j.temperature_env, j.certifications_required,
      j.weekly_pay, j.quick_hire, j.overtime_available, j.lift_requirement_lbs
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
      AND (p_temperature_env IS NULL OR j.temperature_env = p_temperature_env)
      AND (p_certifications IS NULL OR array_length(p_certifications,1) IS NULL
           OR j.certifications_required @> p_certifications)
      AND (p_weekly_pay IS NULL OR j.weekly_pay = p_weekly_pay)
      AND (p_quick_hire IS NULL OR j.quick_hire = p_quick_hire)
      AND (p_overtime IS NULL OR j.overtime_available = p_overtime)
      AND (p_max_lift IS NULL OR j.lift_requirement_lbs IS NULL OR j.lift_requirement_lbs <= p_max_lift)
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
    cc.rank, cc.distance_miles,
    cc.temperature_env, cc.certifications_required,
    cc.weekly_pay, cc.quick_hire, cc.overtime_available, cc.lift_requirement_lbs,
    cc.total_count
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