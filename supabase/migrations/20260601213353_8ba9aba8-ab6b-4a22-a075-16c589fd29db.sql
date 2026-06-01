
-- Extend profiles with missing fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Extend companies with missing fields
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS hq_city text,
  ADD COLUMN IF NOT EXISTS hq_state text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  ADD COLUMN IF NOT EXISTS posting_credits int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_credits int NOT NULL DEFAULT 0;

-- JOB CATEGORIES
CREATE TABLE IF NOT EXISTS public.job_categories (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text
);
GRANT SELECT ON public.job_categories TO anon, authenticated;
GRANT ALL ON public.job_categories TO service_role;
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_categories_public_read" ON public.job_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "job_categories_admin_write" ON public.job_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add category_id + geo + view fields to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS category_id int REFERENCES public.job_categories(id),
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS views int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz NOT NULL DEFAULT now();

-- PACKAGES (new — distinct from posting_packages already used by pricing page)
CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('posting','featured','advertising','bundle')),
  price_cents int NOT NULL,
  posting_count int NOT NULL DEFAULT 0,
  featured_count int NOT NULL DEFAULT 0,
  ad_slot text,
  duration_days int NOT NULL DEFAULT 30,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packages TO anon, authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages_public_read" ON public.packages FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "packages_admin_write" ON public.packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  package_id uuid REFERENCES public.packages(id),
  amount_cents int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded','failed')),
  stripe_session_id text,
  stripe_payment_intent text,
  posting_count_granted int NOT NULL DEFAULT 0,
  featured_count_granted int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_company_read" ON public.orders FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = orders.company_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "orders_company_insert" ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = orders.company_id AND c.owner_id = auth.uid())
  );
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- JOB ALERTS
CREATE TABLE IF NOT EXISTS public.job_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keyword text,
  category_id int REFERENCES public.job_categories(id),
  city text,
  state text,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('instant','daily','weekly')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_alerts TO authenticated;
GRANT ALL ON public.job_alerts TO service_role;
ALTER TABLE public.job_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_alerts_own" ON public.job_alerts FOR ALL TO authenticated
  USING (applicant_id = auth.uid()) WITH CHECK (applicant_id = auth.uid());

-- ADVERTISEMENTS (new — separate from existing 'ads' table)
CREATE TABLE IF NOT EXISTS public.advertisements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  slot text NOT NULL CHECK (slot IN ('home_banner','search_inline','job_sidebar')),
  image_url text NOT NULL,
  target_url text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','ended')),
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advertisements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.advertisements TO authenticated;
GRANT ALL ON public.advertisements TO service_role;
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ads_public_read_active" ON public.advertisements FOR SELECT TO anon, authenticated
  USING (status = 'active' AND (end_date IS NULL OR end_date >= CURRENT_DATE));
CREATE POLICY "ads_company_write" ON public.advertisements FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = advertisements.company_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = advertisements.company_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Unique application per (job, applicant)
CREATE UNIQUE INDEX IF NOT EXISTS applications_job_applicant_unique
  ON public.applications (job_id, applicant_id);

-- Seed warehouse job categories
INSERT INTO public.job_categories (name, slug, icon) VALUES
 ('Forklift Operator','forklift-operator','forklift'),
 ('Picker / Packer','picker-packer','package'),
 ('Shipping & Receiving','shipping-receiving','truck'),
 ('Material Handler','material-handler','boxes'),
 ('Order Selector','order-selector','clipboard-list'),
 ('Inventory / Cycle Count','inventory','scan-barcode'),
 ('Warehouse Associate','warehouse-associate','warehouse'),
 ('Dock Worker / Loader','dock-loader','container'),
 ('Reach / Cherry Picker','reach-operator','move-vertical'),
 ('Warehouse Supervisor / Lead','supervisor','user-cog'),
 ('Quality Control','quality-control','badge-check'),
 ('Sanitation','sanitation','spray-can')
ON CONFLICT (slug) DO NOTHING;
