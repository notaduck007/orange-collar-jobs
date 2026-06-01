-- 1. Migrate posting_packages -> packages
INSERT INTO public.packages (
  id, name, kind, price_cents, posting_count, featured_count,
  duration_days, description, sort_order, active, created_at
)
SELECT
  pp.id,
  pp.name,
  'posting'::text AS kind,
  pp.price_cents,
  COALESCE(pp.post_credits, 0),
  COALESCE(pp.featured_credits, 0),
  COALESCE(pp.duration_days, 30),
  pp.description,
  COALESCE(pp.sort_order, 0),
  COALESCE(pp.active, true),
  pp.created_at
FROM public.posting_packages pp
WHERE NOT EXISTS (SELECT 1 FROM public.packages p WHERE p.id = pp.id);

DROP TABLE public.posting_packages;

-- 2. Migrate ads -> advertisements
ALTER TABLE public.advertisements
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS owner_id uuid;

INSERT INTO public.advertisements (
  id, slot, image_url, target_url, start_date, end_date,
  status, title, owner_id, created_at
)
SELECT
  a.id,
  a.placement::text,
  COALESCE(a.image_url, ''),
  a.target_url,
  a.starts_at::date,
  a.ends_at::date,
  CASE WHEN a.active THEN 'active' ELSE 'paused' END,
  a.title,
  a.owner_id,
  a.created_at
FROM public.ads a
WHERE NOT EXISTS (SELECT 1 FROM public.advertisements ad WHERE ad.id = a.id);

DROP TABLE public.ads;