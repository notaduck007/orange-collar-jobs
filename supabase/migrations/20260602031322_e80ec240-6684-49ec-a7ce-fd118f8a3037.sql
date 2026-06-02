
-- STEP B: company_packages = purchased-package balance
CREATE TABLE public.company_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  order_id   uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  posts_total int NOT NULL DEFAULT 0,
  posts_used  int NOT NULL DEFAULT 0,
  featured_total int NOT NULL DEFAULT 0,
  featured_used  int NOT NULL DEFAULT 0,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','depleted','expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_packages_company_active
  ON public.company_packages (company_id, status, expires_at);

GRANT SELECT ON public.company_packages TO authenticated;
GRANT ALL ON public.company_packages TO service_role;

ALTER TABLE public.company_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_packages_owner_read ON public.company_packages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_packages.company_id AND c.owner_id = auth.uid())
    OR public.is_company_member(company_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY company_packages_admin_write ON public.company_packages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- STEP C: attribute jobs to a purchased package
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS company_package_id uuid REFERENCES public.company_packages(id) ON DELETE SET NULL;

-- STEP D: helper RPC
CREATE OR REPLACE FUNCTION public.get_active_package(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  package_id uuid,
  package_name text,
  posts_total int,
  posts_used int,
  posts_remaining int,
  featured_total int,
  featured_used int,
  featured_remaining int,
  expires_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cp.id,
         cp.package_id,
         p.name AS package_name,
         cp.posts_total,
         cp.posts_used,
         GREATEST(cp.posts_total - cp.posts_used, 0) AS posts_remaining,
         cp.featured_total,
         cp.featured_used,
         GREATEST(cp.featured_total - cp.featured_used, 0) AS featured_remaining,
         cp.expires_at
    FROM public.company_packages cp
    LEFT JOIN public.packages p ON p.id = cp.package_id
   WHERE cp.company_id = p_company_id
     AND cp.status = 'active'
     AND cp.expires_at > now()
     AND cp.posts_used < cp.posts_total
   ORDER BY cp.expires_at ASC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_package(uuid) TO authenticated, anon;

-- STEP E: migrate existing balances from companies.{posting_credits, featured_credits}
INSERT INTO public.company_packages (company_id, package_id, posts_total, featured_total, expires_at, status)
SELECT c.id, NULL,
       COALESCE(c.posting_credits, 0),
       COALESCE(c.featured_credits, 0),
       now() + interval '60 days',
       'active'
  FROM public.companies c
 WHERE COALESCE(c.posting_credits, 0) > 0 OR COALESCE(c.featured_credits, 0) > 0;

COMMENT ON COLUMN public.companies.posting_credits  IS 'DEPRECATED — use public.company_packages. Do not read or write.';
COMMENT ON COLUMN public.companies.featured_credits IS 'DEPRECATED — use public.company_packages. Do not read or write.';
