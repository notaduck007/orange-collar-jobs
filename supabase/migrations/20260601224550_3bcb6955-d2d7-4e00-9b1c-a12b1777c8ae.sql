-- 1) company_credits
CREATE TABLE public.company_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  credit_type text NOT NULL CHECK (credit_type IN ('post','featured')),
  balance int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, credit_type)
);

GRANT SELECT ON public.company_credits TO authenticated;
GRANT ALL ON public.company_credits TO service_role;

ALTER TABLE public.company_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_credits_owner_read ON public.company_credits
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c
            WHERE c.id = company_credits.company_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY company_credits_admin_write ON public.company_credits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) credit_transactions
CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  credit_type text NOT NULL CHECK (credit_type IN ('post','featured')),
  delta int NOT NULL,
  reason text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_tx_company ON public.credit_transactions(company_id);
CREATE INDEX idx_credit_tx_order ON public.credit_transactions(order_id);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_tx_owner_read ON public.credit_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c
            WHERE c.id = credit_transactions.company_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY credit_tx_admin_write ON public.credit_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Extend orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS package_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;

-- 4) grant_credits_for_order: idempotent fulfillment
CREATE OR REPLACE FUNCTION public.grant_credits_for_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  pkg public.packages%ROWTYPE;
  _post int := 0;
  _feat int := 0;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order % not found', _order_id; END IF;
  IF o.fulfilled_at IS NOT NULL THEN RETURN; END IF;
  IF o.status <> 'paid' THEN RAISE EXCEPTION 'order % not paid', _order_id; END IF;
  IF o.company_id IS NULL THEN RAISE EXCEPTION 'order % has no company', _order_id; END IF;

  IF o.package_id IS NOT NULL THEN
    SELECT * INTO pkg FROM public.packages WHERE id = o.package_id;
    IF FOUND THEN
      _post := COALESCE(pkg.posting_count, 0);
      _feat := COALESCE(pkg.featured_count, 0);
    END IF;
  END IF;

  _post := GREATEST(_post, COALESCE(o.posting_count_granted, 0));
  _feat := GREATEST(_feat, COALESCE(o.featured_count_granted, 0));

  IF _post > 0 THEN
    INSERT INTO public.company_credits (company_id, credit_type, balance)
    VALUES (o.company_id, 'post', _post)
    ON CONFLICT (company_id, credit_type)
    DO UPDATE SET balance = public.company_credits.balance + EXCLUDED.balance,
                  updated_at = now();
    INSERT INTO public.credit_transactions (company_id, credit_type, delta, reason, order_id)
    VALUES (o.company_id, 'post', _post, 'order_fulfillment', o.id);
  END IF;

  IF _feat > 0 THEN
    INSERT INTO public.company_credits (company_id, credit_type, balance)
    VALUES (o.company_id, 'featured', _feat)
    ON CONFLICT (company_id, credit_type)
    DO UPDATE SET balance = public.company_credits.balance + EXCLUDED.balance,
                  updated_at = now();
    INSERT INTO public.credit_transactions (company_id, credit_type, delta, reason, order_id)
    VALUES (o.company_id, 'featured', _feat, 'order_fulfillment', o.id);
  END IF;

  UPDATE public.orders SET fulfilled_at = now() WHERE id = o.id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_credits_for_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits_for_order(uuid) TO service_role;