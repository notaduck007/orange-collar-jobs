-- Reflect verification + status columns that were added via Supabase migrations.
-- All columns already exist in both the Supabase cloud DB and the local Docker Postgres;
-- this migration is a no-op for existing environments.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status              text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS verification_status text        NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by         uuid,
  ADD COLUMN IF NOT EXISTS verification_note   text,
  ADD COLUMN IF NOT EXISTS verification_evidence_url text;

-- Make owner_id nullable so seed rows with no owner don't violate the FK.
ALTER TABLE public.companies ALTER COLUMN owner_id DROP NOT NULL;
