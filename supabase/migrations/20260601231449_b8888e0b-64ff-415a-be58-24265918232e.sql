-- Columns on applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS rating int CHECK (rating IS NULL OR (rating BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Application notes table
CREATE TABLE IF NOT EXISTS public.application_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_application_notes_application ON public.application_notes(application_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_notes TO authenticated;
GRANT ALL ON public.application_notes TO service_role;

ALTER TABLE public.application_notes ENABLE ROW LEVEL SECURITY;

-- A user is considered a "company member" for an application if they posted the job
-- or own the company that owns the job, or are an admin.
CREATE POLICY application_notes_company_read ON public.application_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      LEFT JOIN public.companies c ON c.id = j.company_id
      WHERE a.id = application_notes.application_id
        AND (j.posted_by = auth.uid() OR c.owner_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY application_notes_company_insert ON public.application_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.applications a
        JOIN public.jobs j ON j.id = a.job_id
        LEFT JOIN public.companies c ON c.id = j.company_id
        WHERE a.id = application_notes.application_id
          AND (j.posted_by = auth.uid() OR c.owner_id = auth.uid())
      )
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY application_notes_author_delete ON public.application_notes
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY application_notes_author_update ON public.application_notes
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
