
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'employer', 'job_seeker');
CREATE TYPE public.job_shift AS ENUM ('first', 'second', 'third', 'weekend', 'flexible');
CREATE TYPE public.employment_type AS ENUM ('full_time', 'part_time', 'temp', 'temp_to_hire', 'seasonal', 'contract');
CREATE TYPE public.job_status AS ENUM ('draft', 'published', 'closed', 'expired');
CREATE TYPE public.application_status AS ENUM ('submitted', 'reviewed', 'interview', 'hired', 'rejected');
CREATE TYPE public.ad_placement AS ENUM ('home_banner', 'search_inline', 'job_sidebar');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger: create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'job_seeker');
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  website TEXT,
  description TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies_public_read" ON public.companies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "companies_owner_write" ON public.companies FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  shift public.job_shift NOT NULL DEFAULT 'first',
  employment_type public.employment_type NOT NULL DEFAULT 'full_time',
  pay_min NUMERIC(10,2),
  pay_max NUMERIC(10,2),
  pay_period TEXT DEFAULT 'hour',
  location TEXT NOT NULL,
  zip TEXT,
  description TEXT NOT NULL,
  requirements TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  status public.job_status NOT NULL DEFAULT 'published',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX jobs_status_idx ON public.jobs(status);
CREATE INDEX jobs_category_idx ON public.jobs(category);
CREATE INDEX jobs_featured_idx ON public.jobs(featured);

GRANT SELECT ON public.jobs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_public_read_published" ON public.jobs FOR SELECT TO anon, authenticated
  USING (status = 'published' OR posted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "jobs_owner_write" ON public.jobs FOR ALL TO authenticated
  USING (posted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (posted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ APPLICATIONS ============
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_url TEXT,
  cover_letter TEXT,
  status public.application_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, applicant_id)
);
GRANT SELECT, INSERT, UPDATE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_select_own_or_employer" ON public.applications FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = applications.job_id AND j.posted_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
CREATE POLICY "applications_insert_own" ON public.applications FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());
CREATE POLICY "applications_update_employer" ON public.applications FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = applications.job_id AND j.posted_by = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============ SAVED JOBS ============
CREATE TABLE public.saved_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT, INSERT, DELETE ON public.saved_jobs TO authenticated;
GRANT ALL ON public.saved_jobs TO service_role;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_jobs_own" ON public.saved_jobs FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ POSTING PACKAGES ============
CREATE TABLE public.posting_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  post_credits INTEGER NOT NULL DEFAULT 1,
  featured_credits INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posting_packages TO anon, authenticated;
GRANT ALL ON public.posting_packages TO service_role;
ALTER TABLE public.posting_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packages_public_read" ON public.posting_packages FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "packages_admin_write" ON public.posting_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ ADS ============
CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  image_url TEXT,
  target_url TEXT NOT NULL,
  placement public.ad_placement NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ads_public_read_active" ON public.ads FOR SELECT TO anon, authenticated
  USING (active = true AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "ads_owner_write" ON public.ads FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ SEED DATA ============
INSERT INTO public.companies (id, name, slug, description, location, website) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Midwest Logistics Co.', 'midwest-logistics', 'Regional 3PL operating 12 distribution centers across the Midwest.', 'Columbus, OH', 'https://example.com'),
  ('11111111-1111-1111-1111-111111111102', 'Apex Fulfillment Services', 'apex-fulfillment', 'E-commerce fulfillment partner shipping over 2M parcels per month.', 'Indianapolis, IN', 'https://example.com'),
  ('11111111-1111-1111-1111-111111111103', 'Northpoint Cold Storage', 'northpoint-cold-storage', 'Temperature-controlled warehousing for food and pharma clients.', 'Memphis, TN', 'https://example.com'),
  ('11111111-1111-1111-1111-111111111104', 'Ironside Industrial', 'ironside-industrial', 'Heavy industrial parts distribution and kitting.', 'Cleveland, OH', 'https://example.com'),
  ('11111111-1111-1111-1111-111111111105', 'Cargo Hub Distribution', 'cargo-hub', 'Cross-dock and LTL consolidation hub near I-80.', 'Joliet, IL', 'https://example.com'),
  ('11111111-1111-1111-1111-111111111106', 'Pallet Pro Warehousing', 'pallet-pro', 'Bulk storage and pallet handling for CPG brands.', 'Dallas, TX', 'https://example.com'),
  ('11111111-1111-1111-1111-111111111107', 'Riverbend Distribution', 'riverbend-distribution', 'Family-owned distribution warehouse since 1978.', 'Louisville, KY', 'https://example.com'),
  ('11111111-1111-1111-1111-111111111108', 'Beacon Supply Chain', 'beacon-supply-chain', 'Tech-enabled 3PL with same-day fulfillment.', 'Phoenix, AZ', 'https://example.com');

INSERT INTO public.jobs (company_id, title, slug, category, shift, employment_type, pay_min, pay_max, location, zip, description, requirements, featured, status) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Forklift Operator - Sit Down', 'forklift-operator-sit-down-columbus', 'Forklift Operator', 'second', 'full_time', 20.50, 24.00, 'Columbus, OH', '43219',
    'Operate sit-down counterbalance forklifts to move pallets between receiving, storage, and shipping lanes. Load and unload trailers, stage outbound orders, and maintain accurate inventory locations using RF scanners. Average 80-120 pallet moves per shift in a fast-paced cross-dock environment.',
    'Valid forklift certification (or willingness to certify on day 1). 1+ year of sit-down experience. Able to lift up to 50 lbs occasionally. Steel-toe boots required.', true, 'published'),
  ('11111111-1111-1111-1111-111111111102', 'Picker / Packer - E-commerce', 'picker-packer-ecommerce-indianapolis', 'Picker / Packer', 'first', 'full_time', 17.00, 19.50, 'Indianapolis, IN', '46241',
    'Pick customer orders from pick modules using RF scanner, pack into shipping cartons, apply labels, and place on outbound conveyor. Target rate of 90 units per hour after ramp-up. Climate-controlled facility with 401k and weekly pay.',
    'Comfort standing and walking 8-10 hours. Basic reading and counting. No experience required - paid training provided.', false, 'published'),
  ('11111111-1111-1111-1111-111111111102', 'Picker / Packer - Weekend Shift', 'picker-packer-weekend-indianapolis', 'Picker / Packer', 'weekend', 'part_time', 18.50, 20.00, 'Indianapolis, IN', '46241',
    'Fri/Sat/Sun 6am-6pm. Pick and pack e-commerce orders during our heaviest volume days. $2/hr weekend differential included in posted rate.',
    'Reliable transportation. Able to lift 35 lbs repeatedly. Prior pick/pack experience a plus.', true, 'published'),
  ('11111111-1111-1111-1111-111111111103', 'Cold Storage Order Selector', 'cold-storage-order-selector-memphis', 'Order Selector', 'third', 'full_time', 22.00, 26.00, 'Memphis, TN', '38118',
    'Build pallets of frozen and refrigerated product (-10°F to 35°F) for outbound truck routes using voice-pick technology and electric pallet jack. Insulated freezer gear provided.',
    'Must pass physical lift test (up to 75 lbs). 6 months warehouse experience preferred. Comfort working in freezer environments.', false, 'published'),
  ('11111111-1111-1111-1111-111111111104', 'Material Handler', 'material-handler-cleveland', 'Material Handler', 'first', 'full_time', 18.00, 21.00, 'Cleveland, OH', '44103',
    'Move raw materials and finished industrial parts between staging, kitting cells, and shipping. Operate hand jacks and walkie riders. Some forklift work for trained operators.',
    'High school diploma or GED. Able to stand and lift throughout the shift. Forklift cert a plus.', false, 'published'),
  ('11111111-1111-1111-1111-111111111104', 'Shipping & Receiving Clerk', 'shipping-receiving-clerk-cleveland', 'Shipping & Receiving', 'first', 'full_time', 21.00, 25.00, 'Cleveland, OH', '44103',
    'Verify inbound shipments against POs, route inbound product to proper storage, build outbound BOLs, and coordinate with carriers at the dock. Heavy WMS work in our SAP-based system.',
    '2+ years shipping/receiving experience. Comfortable with WMS/ERP systems. Strong attention to detail.', true, 'published'),
  ('11111111-1111-1111-1111-111111111105', 'Dock Worker - Cross Dock', 'dock-worker-joliet', 'Dock Worker', 'third', 'full_time', 19.50, 22.50, 'Joliet, IL', '60431',
    'Unload inbound LTL trailers, sort freight to outbound doors, and reload trailers for next-day delivery. High-volume cross-dock operation moving 800+ shipments per night.',
    'Able to lift up to 75 lbs. Comfortable working overnight. 6 months freight handling preferred.', false, 'published'),
  ('11111111-1111-1111-1111-111111111105', 'Reach Truck Operator', 'reach-truck-operator-joliet', 'Forklift Operator', 'second', 'full_time', 23.00, 27.00, 'Joliet, IL', '60431',
    'Stand-up reach truck operation putting away and replenishing pallets in 32 ft high-bay racking. Average 100+ moves per shift in our cross-dock.',
    'Valid reach truck certification. 1+ year stand-up reach experience required. Strong depth perception for high-bay work.', true, 'published'),
  ('11111111-1111-1111-1111-111111111106', 'Inventory Control Clerk', 'inventory-clerk-dallas', 'Inventory Clerk', 'first', 'full_time', 19.00, 22.00, 'Dallas, TX', '75229',
    'Conduct cycle counts, research and reconcile inventory variances, manage location accuracy, and support quarterly physical inventories.',
    'Strong math and Excel skills. Prior cycle count experience preferred. WMS exposure a plus.', false, 'published'),
  ('11111111-1111-1111-1111-111111111106', 'Warehouse Associate - Seasonal', 'warehouse-associate-seasonal-dallas', 'Warehouse Associate', 'first', 'seasonal', 16.50, 18.00, 'Dallas, TX', '75229',
    'Seasonal opportunity (Oct - Jan) supporting peak retail volume. Pick, pack, label, and load outbound trailers. Strong performers offered permanent positions.',
    'No experience required. Must commit through January 15. Climate-controlled facility.', false, 'published'),
  ('11111111-1111-1111-1111-111111111107', 'Warehouse Associate - Temp-to-Hire', 'warehouse-associate-louisville', 'Warehouse Associate', 'second', 'temp_to_hire', 17.50, 19.00, 'Louisville, KY', '40213',
    'Temp-to-hire role with conversion eligibility at 90 days. Picking, packing, light loading, and general warehouse duties. Drug screen and background check required.',
    'Reliable attendance. Able to lift 50 lbs. Steel toe boots required.', false, 'published'),
  ('11111111-1111-1111-1111-111111111107', 'Forklift Operator - Stand Up', 'forklift-stand-up-louisville', 'Forklift Operator', 'second', 'full_time', 21.00, 24.00, 'Louisville, KY', '40213',
    'Stand-up reach operation in our 250,000 sq ft distribution warehouse. Putaway, replenishment, and loading trailers.',
    'Stand-up reach truck experience required. Forklift cert required at start.', false, 'published'),
  ('11111111-1111-1111-1111-111111111108', 'Order Selector - Voice Pick', 'order-selector-voice-pick-phoenix', 'Order Selector', 'first', 'full_time', 19.00, 22.50, 'Phoenix, AZ', '85043',
    'Select customer orders using voice-directed picking on electric pallet jacks. Build full pallets of mixed product for outbound staging.',
    'Able to lift 50+ lbs repeatedly. Comfortable wearing voice headset. Prior selector experience a plus.', false, 'published'),
  ('11111111-1111-1111-1111-111111111108', 'Material Handler - Contract', 'material-handler-contract-phoenix', 'Material Handler', 'first', 'contract', 20.00, 23.00, 'Phoenix, AZ', '85043',
    '6-month contract supporting a major customer onboarding. General warehouse work, kitting, and assembly support.',
    'Warehouse experience preferred. Able to lift 50 lbs. Contract role with possibility of extension.', false, 'published'),
  ('11111111-1111-1111-1111-111111111101', 'Shipping Clerk - 2nd Shift', 'shipping-clerk-2nd-columbus', 'Shipping & Receiving', 'second', 'full_time', 20.00, 23.50, 'Columbus, OH', '43219',
    'Build BOLs, schedule outbound carriers, verify load accuracy, and close trailers. Heavy data entry in our WMS.',
    'Strong attention to detail. 1+ year shipping office experience. Computer literate.', false, 'published'),
  ('11111111-1111-1111-1111-111111111103', 'Warehouse Associate - Cooler', 'warehouse-associate-cooler-memphis', 'Warehouse Associate', 'first', 'full_time', 18.50, 21.00, 'Memphis, TN', '38118',
    'General warehouse duties in our 35°F cooler. Pick orders, build pallets, light forklift work for certified operators.',
    'Comfort in cold environments. Steel toe boots required. Lift up to 50 lbs.', false, 'published');

INSERT INTO public.posting_packages (name, description, price_cents, post_credits, featured_credits, duration_days, sort_order) VALUES
  ('Single Post', 'One standard 30-day job posting. Great for trying us out.', 9900, 1, 0, 30, 1),
  ('5-Pack', 'Five job posts plus one featured upgrade. Best for steady hiring.', 39900, 5, 1, 30, 2),
  ('Always-On', 'Twenty posts and five featured upgrades over 90 days. Built for high-volume hiring.', 129900, 20, 5, 90, 3);

INSERT INTO public.ads (title, target_url, placement, image_url) VALUES
  ('Get certified — OSHA Forklift Training', 'https://example.com/osha', 'home_banner', null),
  ('Hire faster with our 5-Pack', '/pricing', 'search_inline', null);
