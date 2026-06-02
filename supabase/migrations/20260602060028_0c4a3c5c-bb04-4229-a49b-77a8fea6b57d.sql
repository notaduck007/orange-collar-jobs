
-- Migrate any existing abuse_reports rows into reports (avoid duplicates by id)
INSERT INTO public.reports (id, reporter_id, entity_type, entity_id, reason, details, status, resolved_by, resolved_at, resolution_note, created_at)
SELECT ar.id, ar.reporter_id, ar.entity_type, ar.entity_id, ar.reason, ar.details, ar.status, ar.resolved_by, ar.resolved_at, ar.resolution_note, ar.created_at
FROM public.abuse_reports ar
WHERE NOT EXISTS (SELECT 1 FROM public.reports r WHERE r.id = ar.id);

-- Drop policies & table
DROP POLICY IF EXISTS abuse_reports_admin_all ON public.abuse_reports;
DROP POLICY IF EXISTS abuse_reports_insert ON public.abuse_reports;
DROP POLICY IF EXISTS abuse_reports_moderation ON public.abuse_reports;
DROP POLICY IF EXISTS abuse_reports_reporter_read ON public.abuse_reports;
DROP TABLE IF EXISTS public.abuse_reports;
