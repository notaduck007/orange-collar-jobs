
-- Reports table (in-app entity reports)
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid,
  entity_type text NOT NULL CHECK (entity_type IN ('job','review','company','user')),
  entity_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  assigned_to uuid,
  resolution_note text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT INSERT ON public.reports TO anon;
GRANT ALL ON public.reports TO service_role;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_insert_any ON public.reports FOR INSERT TO anon, authenticated
  WITH CHECK (reporter_id IS NULL OR reporter_id = auth.uid());

CREATE POLICY reports_reporter_read ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY reports_support_all ON public.reports FOR ALL TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'support') OR public.has_admin_permission(auth.uid(), 'moderation'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'support') OR public.has_admin_permission(auth.uid(), 'moderation'));

CREATE INDEX idx_reports_status ON public.reports (status, created_at DESC);
CREATE INDEX idx_reports_entity ON public.reports (entity_type, entity_id);

-- Support tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT INSERT ON public.support_tickets TO anon;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY support_tickets_insert_any ON public.support_tickets FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY support_tickets_owner_read ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY support_tickets_support_all ON public.support_tickets FOR ALL TO authenticated
  USING (public.has_admin_permission(auth.uid(), 'support'))
  WITH CHECK (public.has_admin_permission(auth.uid(), 'support'));

CREATE INDEX idx_support_tickets_status ON public.support_tickets (status, created_at DESC);

CREATE TRIGGER support_tickets_set_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
