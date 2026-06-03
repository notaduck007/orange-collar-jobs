ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS applicant_name text,
  ADD COLUMN IF NOT EXISTS applicant_phone text,
  ADD COLUMN IF NOT EXISTS applicant_email text,
  ADD COLUMN IF NOT EXISTS applicant_certifications text[],
  ADD COLUMN IF NOT EXISTS applicant_desired_shift text,
  ADD COLUMN IF NOT EXISTS applicant_desired_employment_type text,
  ADD COLUMN IF NOT EXISTS applicant_willing_to_relocate boolean,
  ADD COLUMN IF NOT EXISTS applicant_headline text,
  ADD COLUMN IF NOT EXISTS applicant_skills text[];