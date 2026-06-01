-- Ad creatives storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-creatives', 'ad-creatives', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ad_creatives_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'ad-creatives');

CREATE POLICY "ad_creatives_auth_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ad-creatives' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ad_creatives_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ad-creatives' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "ad_creatives_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ad-creatives' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Counter RPCs (security definer so anon/auth can increment)
CREATE OR REPLACE FUNCTION public.ad_increment_impression(_ad_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.advertisements SET impressions = impressions + 1 WHERE id = _ad_id;
$$;

CREATE OR REPLACE FUNCTION public.ad_increment_click(_ad_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.advertisements SET clicks = clicks + 1 WHERE id = _ad_id;
$$;

GRANT EXECUTE ON FUNCTION public.ad_increment_impression(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ad_increment_click(uuid) TO anon, authenticated;

-- Admin approval policy for advertisements
CREATE POLICY "ads_admin_all"
ON public.advertisements FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));