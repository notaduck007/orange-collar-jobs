
-- 1. Extend job_categories with active flag and sort order
ALTER TABLE public.job_categories
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- 2. site_pages table (about, faq, contact, etc.)
CREATE TABLE IF NOT EXISTS public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  meta_description text,
  published boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_pages_public_read" ON public.site_pages
  FOR SELECT TO anon, authenticated
  USING (published = true OR public.has_admin_permission(auth.uid(), 'settings'));

CREATE POLICY "site_pages_settings_write" ON public.site_pages
  FOR ALL TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'settings'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'settings'));

CREATE TRIGGER site_pages_updated_at
  BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. faq_items table
CREATE TABLE IF NOT EXISTS public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.faq_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_items TO authenticated;
GRANT ALL ON public.faq_items TO service_role;

ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faq_items_public_read" ON public.faq_items
  FOR SELECT TO anon, authenticated
  USING (published = true OR public.has_admin_permission(auth.uid(), 'settings'));

CREATE POLICY "faq_items_settings_write" ON public.faq_items
  FOR ALL TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'settings'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'settings'));

CREATE TRIGGER faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Seed default site_pages (only if missing)
INSERT INTO public.site_pages (slug, title, body, meta_description, published) VALUES
  ('about', 'About WarehouseJobs',
$$## Built for the dock.

WarehouseJobs started in a 220,000 sq ft fulfillment center outside Indianapolis. The shift supervisor was using a generic job board to hire forklift operators — and getting bartenders and software interns instead.

We thought warehouse workers and the operations leaders that hire them deserved a tool that actually understood their world. Shift codes. Forklift certifications. ZIP-radius matching. Cold storage premiums. Weekend differentials. The things that matter on the floor.

Today, WarehouseJobs connects thousands of warehouse workers with distribution centers, 3PLs, cold storage operators, and cross-docks across the U.S. — and we keep it free for the people doing the work.$$,
   'We built WarehouseJobs because warehouse hiring deserves better tools.', true),
  ('faq', 'Frequently Asked Questions',
$$Browse the most common questions about hiring and applying through WarehouseJobs. Don''t see your question? [Get in touch](/contact).$$,
   'Answers to common questions about WarehouseJobs.', true),
  ('contact', 'Contact Us',
$$## Talk to a human.

Reach the team at **support@warehousejobs.com** or use the form below. We typically respond within one business day.$$,
   'Get in touch with the WarehouseJobs team.', true)
ON CONFLICT (slug) DO NOTHING;

-- 5. Seed default FAQ items
INSERT INTO public.faq_items (question, answer, sort_order, published)
SELECT q, a, ord, true FROM (VALUES
  ('Is WarehouseJobs really free for job seekers?', 'Yes. Searching, saving, and applying to jobs is 100% free, with no resume paywalls or premium tiers.', 10),
  ('Do I need a resume to apply?', 'No — many of our employers accept a quick application without a resume. You can also upload a PDF in your profile if you have one.', 20),
  ('How quickly will I hear back?', 'Most employers reach out within 48 hours on featured listings. Standard listings average 3–5 business days.', 30),
  ('What does it cost to post a job?', 'Single posts start at $99 for 30 days. The 5-Pack ($399) drops the per-post rate and includes a featured upgrade. See the Pricing page for details.', 40),
  ('Can I edit a job after it''s posted?', 'Yes — employers can update any field on a live posting from their dashboard. Featured upgrades stay active for the full term.', 50),
  ('Do you screen applicants?', 'We don''t gate applications, but our application form captures shift availability, forklift certifications, and right-to-work confirmation so you''re never reviewing blind.', 60),
  ('Do you support staffing agencies and 3PLs?', 'Absolutely. Many of our largest customers run multi-site recruitment through WarehouseJobs. Contact sales for a custom plan.', 70)
) AS s(q, a, ord)
WHERE NOT EXISTS (SELECT 1 FROM public.faq_items);
