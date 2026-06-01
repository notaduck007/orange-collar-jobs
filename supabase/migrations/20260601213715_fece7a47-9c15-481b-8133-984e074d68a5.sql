
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read logos
CREATE POLICY "company_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

-- Owners can upload to their own folder ({user_id}/...)
CREATE POLICY "company_logos_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "company_logos_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "company_logos_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
