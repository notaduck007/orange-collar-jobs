
-- Interview slots for quick-hire jobs
CREATE TABLE public.interview_slots (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  starts_at timestamptz not null,
  capacity int not null default 1 check (capacity > 0),
  booked_count int not null default 0,
  created_at timestamptz not null default now()
);
CREATE INDEX idx_interview_slots_job ON public.interview_slots(job_id, starts_at);

GRANT SELECT ON public.interview_slots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.interview_slots TO authenticated;
GRANT ALL ON public.interview_slots TO service_role;

ALTER TABLE public.interview_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY interview_slots_public_read ON public.interview_slots
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY interview_slots_company_write ON public.interview_slots
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = interview_slots.job_id
      AND (j.posted_by = auth.uid()
        OR public.is_company_member(j.company_id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = interview_slots.job_id
      AND (j.posted_by = auth.uid()
        OR public.is_company_member(j.company_id, auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

-- Interview bookings (one per application)
CREATE TABLE public.interview_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.interview_slots(id) on delete cascade,
  application_id uuid not null unique,
  applicant_id uuid not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);
CREATE INDEX idx_interview_bookings_slot ON public.interview_bookings(slot_id);
CREATE INDEX idx_interview_bookings_applicant ON public.interview_bookings(applicant_id);

GRANT SELECT, INSERT, UPDATE ON public.interview_bookings TO authenticated;
GRANT ALL ON public.interview_bookings TO service_role;

ALTER TABLE public.interview_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY interview_bookings_applicant_insert ON public.interview_bookings
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid());

CREATE POLICY interview_bookings_read ON public.interview_bookings
  FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = interview_bookings.application_id
        AND (j.posted_by = auth.uid() OR public.is_company_member(j.company_id, auth.uid()))
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY interview_bookings_update ON public.interview_bookings
  FOR UPDATE TO authenticated
  USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = interview_bookings.application_id
        AND (j.posted_by = auth.uid() OR public.is_company_member(j.company_id, auth.uid()))
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id
      WHERE a.id = interview_bookings.application_id
        AND (j.posted_by = auth.uid() OR public.is_company_member(j.company_id, auth.uid()))
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Trigger: enforce capacity, increment counter, notify both parties
CREATE OR REPLACE FUNCTION public.handle_interview_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot public.interview_slots%ROWTYPE;
  v_job public.jobs%ROWTYPE;
  v_seeker_name text;
  v_when text;
BEGIN
  SELECT * INTO v_slot FROM public.interview_slots WHERE id = NEW.slot_id FOR UPDATE;
  IF v_slot.booked_count >= v_slot.capacity THEN
    RAISE EXCEPTION 'Interview slot is full';
  END IF;
  UPDATE public.interview_slots SET booked_count = booked_count + 1 WHERE id = NEW.slot_id;

  SELECT j.* INTO v_job
    FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
   WHERE a.id = NEW.application_id;

  SELECT COALESCE(display_name, full_name, 'A candidate') INTO v_seeker_name
    FROM public.profiles WHERE id = NEW.applicant_id;

  v_when := to_char(v_slot.starts_at AT TIME ZONE 'UTC', 'Mon DD, YYYY HH24:MI') || ' UTC';

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (
    NEW.applicant_id,
    'interview_scheduled',
    'Interview scheduled',
    'Your phone screen for ' || v_job.title || ' is set for ' || v_when || '.',
    '/jobs/' || v_job.slug
  );

  IF v_job.posted_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      v_job.posted_by,
      'interview_booked',
      'New phone screen booked',
      COALESCE(v_seeker_name, 'A candidate') || ' booked a phone screen for ' || v_job.title || ' at ' || v_when || '.',
      '/employer/jobs'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_interview_booking_after_insert
  AFTER INSERT ON public.interview_bookings
  FOR EACH ROW EXECUTE FUNCTION public.handle_interview_booking();
