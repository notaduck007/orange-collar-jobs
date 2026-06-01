
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='job_status' AND e.enumlabel='paused') THEN
    ALTER TYPE public.job_status ADD VALUE 'paused';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='job_status' AND e.enumlabel='pending_review') THEN
    ALTER TYPE public.job_status ADD VALUE 'pending_review';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 WHERE t.typname='application_status' AND e.enumlabel='shortlisted') THEN
    ALTER TYPE public.application_status ADD VALUE 'shortlisted';
  END IF;
END $$;
