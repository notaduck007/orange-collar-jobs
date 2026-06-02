
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS featured_until timestamptz;

CREATE OR REPLACE FUNCTION public.consume_credit(_company_id uuid, _credit_type text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean := false;
BEGIN
  IF _credit_type NOT IN ('post','featured') THEN
    RAISE EXCEPTION 'invalid credit_type %', _credit_type;
  END IF;

  -- Caller must be a member/owner of the company (or admin)
  IF NOT (public.is_company_member(_company_id, auth.uid())
          OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.company_credits
     SET balance = balance - 1,
         updated_at = now()
   WHERE company_id = _company_id
     AND credit_type = _credit_type
     AND balance > 0
  RETURNING true INTO _ok;

  IF _ok IS NULL OR _ok = false THEN
    RETURN false;
  END IF;

  INSERT INTO public.credit_transactions (company_id, credit_type, delta, reason)
  VALUES (_company_id, _credit_type, -1, 'consume');

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_credit(uuid, text) TO authenticated;
