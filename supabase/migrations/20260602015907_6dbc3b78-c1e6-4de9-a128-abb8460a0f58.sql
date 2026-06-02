
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start)
);

GRANT SELECT ON public.rate_limits TO authenticated;
GRANT ALL ON public.rate_limits TO service_role;

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_limits_admin_read ON public.rate_limits;
CREATE POLICY rate_limits_admin_read ON public.rate_limits
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key text,
  _window_seconds integer,
  _max integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  _bucket timestamptz;
  _count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;
  IF _window_seconds <= 0 OR _max <= 0 THEN
    RAISE EXCEPTION 'invalid args';
  END IF;

  _bucket := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);

  INSERT INTO public.rate_limits (key, window_start, count, updated_at)
  VALUES (_key, _bucket, 1, now())
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1, updated_at = now()
  RETURNING count INTO _count;

  DELETE FROM public.rate_limits
   WHERE key = _key AND window_start < now() - interval '1 day';

  RETURN _count <= _max;
END;
$func$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS spam_score integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.jobs_compute_spam_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $func$
DECLARE
  _text text;
  _title text;
  _score int := 0;
  _len int;
  _upper_count int;
  _link_hits int;
  _blocklist text[] := ARRAY[
    'work from home','make money fast','crypto','investment opportunity',
    'mlm','pyramid','telegram','whatsapp only','click here','wire transfer',
    'send bitcoin','100 percent guaranteed','earn cash fast','quick cash'
  ];
  _kw text;
BEGIN
  _title := coalesce(NEW.title,'');
  _text := lower(_title || ' ' || coalesce(NEW.description,'') || ' ' || coalesce(NEW.requirements,''));

  _link_hits := (length(_text) - length(replace(_text, 'http', ''))) / 4;
  IF _link_hits > 0 THEN
    _score := _score + LEAST(40, _link_hits * 15);
  END IF;

  IF _text ~ '(\+?\d[\s\-\.]?){7,}' THEN
    _score := _score + 15;
  END IF;

  _len := length(_title);
  IF _len >= 8 THEN
    _upper_count := length(regexp_replace(_title, '[^A-Z]', '', 'g'));
    IF _upper_count::numeric / _len > 0.7 THEN
      _score := _score + 20;
    END IF;
  END IF;

  IF (length(_text) - length(replace(_text, '!', ''))) >= 5 THEN
    _score := _score + 10;
  END IF;

  FOREACH _kw IN ARRAY _blocklist LOOP
    IF position(_kw IN _text) > 0 THEN
      _score := _score + 25;
    END IF;
  END LOOP;

  NEW.spam_score := LEAST(_score, 200);

  IF NEW.spam_score >= 50 AND NEW.status IN ('active','published') THEN
    NEW.status := 'pending_review'::job_status;
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS jobs_spam_score_trigger ON public.jobs;
CREATE TRIGGER jobs_spam_score_trigger
BEFORE INSERT OR UPDATE OF title, description, requirements, status
ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.jobs_compute_spam_score();
