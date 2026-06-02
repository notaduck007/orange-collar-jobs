CREATE TABLE public.ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertisement_id uuid NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('impression','click')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  ad_slot text
);

CREATE INDEX idx_ad_events_ad_type_time ON public.ad_events (advertisement_id, type, occurred_at DESC);
CREATE INDEX idx_ad_events_ad_iphash ON public.ad_events (advertisement_id, type, ip_hash, occurred_at DESC);

GRANT SELECT, INSERT ON public.ad_events TO authenticated;
GRANT ALL ON public.ad_events TO service_role;

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

-- Only admins can read; inserts come from the edge function (service role bypasses RLS).
CREATE POLICY ad_events_admin_read ON public.ad_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- No insert policy => authenticated clients cannot insert directly; the edge function uses service role.
