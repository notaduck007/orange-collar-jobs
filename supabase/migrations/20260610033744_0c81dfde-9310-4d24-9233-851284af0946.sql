
-- 1. language preference on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en','es'));

-- 2. job_translations cache
CREATE TABLE IF NOT EXISTS public.job_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  language text NOT NULL CHECK (language IN ('en','es')),
  title text,
  description text,
  requirements text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, language)
);

GRANT SELECT ON public.job_translations TO anon;
GRANT SELECT ON public.job_translations TO authenticated;
GRANT ALL ON public.job_translations TO service_role;

ALTER TABLE public.job_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read job translations for visible jobs"
  ON public.job_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_translations.job_id
        AND j.status IN ('active','published')
    )
  );

CREATE TRIGGER job_translations_set_updated_at
  BEFORE UPDATE ON public.job_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS job_translations_job_lang_idx
  ON public.job_translations (job_id, language);

-- 3. language preference on job_alerts (so email/SMS templates can pick variant)
ALTER TABLE public.job_alerts
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en','es'));
