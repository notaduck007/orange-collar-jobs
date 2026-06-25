-- Add columns that were applied via Supabase migrations but were missing from the Prisma schema.
-- These columns already exist in the database; this migration is a no-op for existing environments.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hq_city  text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS hq_state text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS location text;
