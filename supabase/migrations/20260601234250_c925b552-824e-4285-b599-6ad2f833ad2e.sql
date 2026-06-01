-- Add discoverable flag to seeker_profiles
ALTER TABLE public.seeker_profiles
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_seeker_profiles_discoverable
  ON public.seeker_profiles (discoverable) WHERE discoverable = true;

-- Allow authenticated users to read discoverable seeker_profiles
DROP POLICY IF EXISTS seeker_profiles_discoverable_read ON public.seeker_profiles;
CREATE POLICY seeker_profiles_discoverable_read
  ON public.seeker_profiles FOR SELECT
  TO authenticated
  USING (discoverable = true);

-- Allow employer-side read of profile basics for discoverable seekers
DROP POLICY IF EXISTS profiles_discoverable_read ON public.profiles;
CREATE POLICY profiles_discoverable_read
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seeker_profiles sp
      WHERE sp.user_id = profiles.id AND sp.discoverable = true
    )
  );

-- Allow employer-side read of work_history for discoverable seekers
DROP POLICY IF EXISTS work_history_discoverable_read ON public.work_history;
CREATE POLICY work_history_discoverable_read
  ON public.work_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seeker_profiles sp
      WHERE sp.user_id = work_history.user_id AND sp.discoverable = true
    )
  );

-- Notifications table for candidate invites and other in-app messages
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sender_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_recipient_read
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY notifications_recipient_update
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_sender_insert
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY notifications_recipient_delete
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
