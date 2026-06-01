
CREATE TABLE public.screening_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  type text NOT NULL CHECK (type IN ('yes_no','single','multi','number','text')),
  options jsonb,
  required boolean NOT NULL DEFAULT false,
  knockout_answer jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_screening_questions_job ON public.screening_questions(job_id, sort_order);

GRANT SELECT ON public.screening_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.screening_questions TO authenticated;
GRANT ALL ON public.screening_questions TO service_role;

ALTER TABLE public.screening_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sq_public_read ON public.screening_questions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = screening_questions.job_id AND j.status IN ('active','published')));

CREATE POLICY sq_company_manage ON public.screening_questions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs j LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = screening_questions.job_id AND (j.posted_by = auth.uid() OR c.owner_id = auth.uid())
  ) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jobs j LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE j.id = screening_questions.job_id AND (j.posted_by = auth.uid() OR c.owner_id = auth.uid())
  ) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.application_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.screening_questions(id) ON DELETE CASCADE,
  answer jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(application_id, question_id)
);
CREATE INDEX idx_application_answers_app ON public.application_answers(application_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.application_answers TO authenticated;
GRANT ALL ON public.application_answers TO service_role;

ALTER TABLE public.application_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY aa_applicant_write ON public.application_answers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_answers.application_id AND a.applicant_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.applications a WHERE a.id = application_answers.application_id AND a.applicant_id = auth.uid()));

CREATE POLICY aa_employer_read ON public.application_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    LEFT JOIN public.companies c ON c.id = j.company_id
    WHERE a.id = application_answers.application_id
      AND (j.posted_by = auth.uid() OR c.owner_id = auth.uid())
  ) OR public.has_role(auth.uid(),'admin'));
