-- 1) tsvector column + trigger + index
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.jobs_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.requirements, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_search_vector_trg ON public.jobs;
CREATE TRIGGER jobs_search_vector_trg
BEFORE INSERT OR UPDATE OF title, description, requirements, category, location
ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.jobs_search_vector_update();

-- Backfill existing rows
UPDATE public.jobs SET title = title;

CREATE INDEX IF NOT EXISTS idx_jobs_search_vector ON public.jobs USING GIN (search_vector);

-- 2) search_jobs RPC
CREATE OR REPLACE FUNCTION public.search_jobs(
  p_query text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_shift text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_pay_min numeric DEFAULT NULL,
  p_radius_miles int DEFAULT NULL,
  p_sort text DEFAULT 'relevance',
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  location text,
  shift public.job_shift,
  employment_type public.employment_type,
  pay_min numeric,
  pay_max numeric,
  pay_period text,
  category text,
  featured boolean,
  created_at timestamptz,
  company_name text,
  company_slug text,
  rank real,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  tsq tsquery;
  has_query boolean := p_query IS NOT NULL AND length(trim(p_query)) > 0;
BEGIN
  IF has_query THEN
    tsq := websearch_to_tsquery('english', p_query);
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      j.id, j.slug, j.title, j.location, j.shift, j.employment_type,
      j.pay_min, j.pay_max, j.pay_period, j.category, j.featured, j.created_at,
      c.name AS company_name, c.slug AS company_slug,
      CASE WHEN has_query THEN ts_rank(j.search_vector, tsq) ELSE 0 END AS rank
    FROM public.jobs j
    LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE j.status IN ('active','published')
      AND (NOT has_query OR j.search_vector @@ tsq)
      AND (p_location IS NULL OR j.location ILIKE '%' || p_location || '%')
      AND (p_category IS NULL OR j.category = p_category)
      AND (p_shift    IS NULL OR j.shift::text = p_shift)
      AND (p_type     IS NULL OR j.employment_type::text = p_type)
      AND (p_pay_min  IS NULL OR COALESCE(j.pay_max, j.pay_min) >= p_pay_min)
  ),
  counted AS (
    SELECT b.*, COUNT(*) OVER ()::bigint AS total_count FROM base b
  )
  SELECT
    c.id, c.slug, c.title, c.location, c.shift, c.employment_type,
    c.pay_min, c.pay_max, c.pay_period, c.category, c.featured, c.created_at,
    c.company_name, c.company_slug, c.rank, c.total_count
  FROM counted c
  ORDER BY
    c.featured DESC,
    CASE WHEN p_sort = 'relevance' AND has_query THEN c.rank END DESC NULLS LAST,
    CASE WHEN p_sort = 'pay_high' THEN COALESCE(c.pay_max, c.pay_min) END DESC NULLS LAST,
    c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_jobs(text, text, text, text, text, numeric, int, text, int, int) TO anon, authenticated;