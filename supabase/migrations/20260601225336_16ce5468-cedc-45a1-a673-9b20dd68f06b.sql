-- 1) zip_codes reference table
CREATE TABLE IF NOT EXISTS public.zip_codes (
  zip text PRIMARY KEY,
  city text NOT NULL,
  state text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.zip_codes TO anon, authenticated;
GRANT ALL ON public.zip_codes TO service_role;

ALTER TABLE public.zip_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zip_codes_public_read ON public.zip_codes;
CREATE POLICY zip_codes_public_read ON public.zip_codes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS zip_codes_admin_write ON public.zip_codes;
CREATE POLICY zip_codes_admin_write ON public.zip_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_zip_codes_city_state ON public.zip_codes (lower(city), lower(state));
CREATE INDEX IF NOT EXISTS idx_zip_codes_state ON public.zip_codes (lower(state));

-- Starter seed of common US zips. For production coverage, import the full
-- GeoNames US postal codes dataset: https://download.geonames.org/export/zip/US.zip
INSERT INTO public.zip_codes (zip, city, state, lat, lng) VALUES
  ('10001','New York','NY',40.7506,-73.9972),
  ('11201','Brooklyn','NY',40.6940,-73.9903),
  ('07102','Newark','NJ',40.7357,-74.1724),
  ('08807','Bridgewater','NJ',40.5940,-74.6107),
  ('19103','Philadelphia','PA',39.9523,-75.1638),
  ('17601','Lancaster','PA',40.0617,-76.3055),
  ('15222','Pittsburgh','PA',40.4500,-79.9892),
  ('21201','Baltimore','MD',39.2908,-76.6157),
  ('20001','Washington','DC',38.9101,-77.0166),
  ('23320','Chesapeake','VA',36.7218,-76.2444),
  ('28202','Charlotte','NC',35.2271,-80.8431),
  ('30303','Atlanta','GA',33.7525,-84.3888),
  ('33101','Miami','FL',25.7782,-80.1980),
  ('32801','Orlando','FL',28.5418,-81.3784),
  ('33602','Tampa','FL',27.9518,-82.4587),
  ('35203','Birmingham','AL',33.5170,-86.8104),
  ('37201','Nashville','TN',36.1666,-86.7816),
  ('38103','Memphis','TN',35.1442,-90.0500),
  ('40202','Louisville','KY',38.2542,-85.7594),
  ('43215','Columbus','OH',39.9700,-83.0030),
  ('44113','Cleveland','OH',41.4847,-81.7064),
  ('45202','Cincinnati','OH',39.1031,-84.5120),
  ('46204','Indianapolis','IN',39.7691,-86.1580),
  ('48201','Detroit','MI',42.3475,-83.0608),
  ('53202','Milwaukee','WI',43.0413,-87.9092),
  ('55401','Minneapolis','MN',44.9847,-93.2731),
  ('60601','Chicago','IL',41.8853,-87.6216),
  ('60188','Carol Stream','IL',41.9128,-88.1346),
  ('63101','St. Louis','MO',38.6310,-90.1928),
  ('64101','Kansas City','MO',39.1018,-94.5847),
  ('70112','New Orleans','LA',29.9569,-90.0786),
  ('73102','Oklahoma City','OK',35.4716,-97.5193),
  ('75201','Dallas','TX',32.7864,-96.7970),
  ('77002','Houston','TX',29.7563,-95.3650),
  ('78205','San Antonio','TX',29.4254,-98.4925),
  ('78701','Austin','TX',30.2693,-97.7424),
  ('80202','Denver','CO',39.7491,-104.9991),
  ('84101','Salt Lake City','UT',40.7569,-111.9006),
  ('85004','Phoenix','AZ',33.4519,-112.0726),
  ('89101','Las Vegas','NV',36.1716,-115.1391),
  ('90012','Los Angeles','CA',34.0614,-118.2386),
  ('92101','San Diego','CA',32.7174,-117.1628),
  ('93721','Fresno','CA',36.7395,-119.7848),
  ('94103','San Francisco','CA',37.7726,-122.4099),
  ('95113','San Jose','CA',37.3349,-121.8929),
  ('97204','Portland','OR',45.5187,-122.6770),
  ('98101','Seattle','WA',47.6109,-122.3358)
ON CONFLICT (zip) DO NOTHING;

-- 2) Trigger to auto-populate jobs.lat/lng (and city/state when null) from zip
CREATE OR REPLACE FUNCTION public.jobs_geocode_from_zip()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  z public.zip_codes%ROWTYPE;
BEGIN
  IF NEW.zip IS NOT NULL AND length(trim(NEW.zip)) >= 5 THEN
    SELECT * INTO z FROM public.zip_codes WHERE zip = left(trim(NEW.zip), 5) LIMIT 1;
    IF FOUND THEN
      IF NEW.lat IS NULL THEN NEW.lat := z.lat; END IF;
      IF NEW.lng IS NULL THEN NEW.lng := z.lng; END IF;
      IF NEW.city IS NULL OR length(trim(NEW.city)) = 0 THEN NEW.city := z.city; END IF;
      IF NEW.state IS NULL OR length(trim(NEW.state)) = 0 THEN NEW.state := z.state; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_geocode_from_zip ON public.jobs;
CREATE TRIGGER trg_jobs_geocode_from_zip
  BEFORE INSERT OR UPDATE OF zip, lat, lng ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_geocode_from_zip();

UPDATE public.jobs j
   SET lat = z.lat, lng = z.lng
  FROM public.zip_codes z
 WHERE j.zip IS NOT NULL
   AND left(trim(j.zip), 5) = z.zip
   AND (j.lat IS NULL OR j.lng IS NULL);

-- 3) search_jobs RPC with radius filtering via haversine
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
  company_name text, company_slug text,
  rank real, distance_miles numeric, total_count bigint
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
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
       WHERE lower(z.city) = lower(loc_city)
         AND lower(z.state) = lower(loc_state);
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
      c.name AS company_name, c.slug AS company_slug,
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
    cc.company_name, cc.company_slug, cc.rank, cc.distance_miles, cc.total_count
  FROM counted cc
  ORDER BY
    cc.featured DESC,
    CASE WHEN p_sort = 'relevance' AND has_query THEN cc.rank END DESC NULLS LAST,
    CASE WHEN p_sort = 'pay_high' THEN COALESCE(cc.pay_max, cc.pay_min) END DESC NULLS LAST,
    CASE WHEN p_radius_miles IS NOT NULL AND center_lat IS NOT NULL THEN cc.distance_miles END ASC NULLS LAST,
    cc.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;