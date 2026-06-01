
-- Default resume URL on profile (for one-click apply)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_resume_url text;

-- Resumes storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: each user owns a folder named after their auth.uid
DROP POLICY IF EXISTS "resumes_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "resumes_owner_write" ON storage.objects;
DROP POLICY IF EXISTS "resumes_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "resumes_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "resumes_employer_read" ON storage.objects;

CREATE POLICY "resumes_owner_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "resumes_owner_write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "resumes_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "resumes_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Employers can read resumes attached to applications on jobs they posted
CREATE POLICY "resumes_employer_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND EXISTS (
    SELECT 1
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    WHERE j.posted_by = auth.uid()
      AND a.resume_url LIKE '%' || storage.objects.name
  )
);
