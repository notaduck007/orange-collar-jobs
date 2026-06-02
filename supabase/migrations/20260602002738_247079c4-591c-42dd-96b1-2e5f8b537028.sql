
-- Audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  reason text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_log_admin_read ON public.audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY audit_log_admin_insert ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND actor_id = auth.uid());

CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

-- Reviews (company reviews by seekers)
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  author_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','flagged','removed','pending')),
  flag_count int NOT NULL DEFAULT 0,
  flag_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_public_read ON public.reviews FOR SELECT TO anon, authenticated
  USING (status = 'published' OR status = 'flagged');
CREATE POLICY reviews_author_read ON public.reviews FOR SELECT TO authenticated
  USING (author_id = auth.uid());
CREATE POLICY reviews_author_write ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY reviews_author_update ON public.reviews FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY reviews_moderation ON public.reviews FOR ALL TO authenticated
  USING (has_admin_permission(auth.uid(), 'moderation')) WITH CHECK (has_admin_permission(auth.uid(), 'moderation'));

-- Abuse reports
CREATE TABLE public.abuse_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid,
  entity_type text NOT NULL CHECK (entity_type IN ('job','company','review','user','ad')),
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected','escalated')),
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abuse_reports TO authenticated;
GRANT ALL ON public.abuse_reports TO service_role;
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY abuse_reports_insert ON public.abuse_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() OR reporter_id IS NULL);
CREATE POLICY abuse_reports_reporter_read ON public.abuse_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());
CREATE POLICY abuse_reports_moderation ON public.abuse_reports FOR ALL TO authenticated
  USING (has_admin_permission(auth.uid(), 'moderation')) WITH CHECK (has_admin_permission(auth.uid(), 'moderation'));
