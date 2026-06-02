
-- 1) Seed the $0 Starter catalog package (idempotent, kind='bundle' to satisfy check)
INSERT INTO public.packages (name, kind, price_cents, posting_count, featured_count, duration_days, description, active, sort_order)
SELECT 'Starter', 'bundle', 0, 1, 0, 30, 'Free starter package — 1 job post, 30 days.', true, -1
WHERE NOT EXISTS (SELECT 1 FROM public.packages WHERE name = 'Starter' AND price_cents = 0);

CREATE OR REPLACE FUNCTION public.grant_starter_package(_company_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pkg public.packages%ROWTYPE;
  v_order_id uuid;
  v_cp_id uuid;
  v_expires timestamptz := now() + interval '30 days';
BEGIN
  IF NOT (
    public.is_company_member(_company_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = _company_id AND c.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.company_packages WHERE company_id = _company_id) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_pkg FROM public.packages
   WHERE name = 'Starter' AND price_cents = 0
   ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'starter_package_missing';
  END IF;

  INSERT INTO public.orders (
    company_id, package_id, amount_cents, currency, status,
    posting_count_granted, featured_count_granted,
    package_snapshot, fulfilled_at
  ) VALUES (
    _company_id, v_pkg.id, 0, 'usd', 'paid',
    v_pkg.posting_count, v_pkg.featured_count,
    jsonb_build_object('name', v_pkg.name, 'starter', true),
    now()
  ) RETURNING id INTO v_order_id;

  INSERT INTO public.company_packages (
    company_id, package_id, order_id,
    posts_total, posts_used, featured_total, featured_used,
    purchased_at, expires_at, status
  ) VALUES (
    _company_id, v_pkg.id, v_order_id,
    v_pkg.posting_count, 0, v_pkg.featured_count, 0,
    now(), v_expires, 'active'
  ) RETURNING id INTO v_cp_id;

  IF v_pkg.posting_count > 0 THEN
    INSERT INTO public.company_credits (company_id, credit_type, balance)
    VALUES (_company_id, 'post', v_pkg.posting_count)
    ON CONFLICT (company_id, credit_type)
    DO UPDATE SET balance = public.company_credits.balance + EXCLUDED.balance,
                  updated_at = now();
    INSERT INTO public.credit_transactions (company_id, credit_type, delta, reason, order_id)
    VALUES (_company_id, 'post', v_pkg.posting_count, 'starter_grant', v_order_id);
  END IF;

  RETURN v_cp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_starter_package(uuid) TO authenticated;

-- Backfill: every existing company with no company_packages gets one too.
DO $$
DECLARE
  v_pkg public.packages%ROWTYPE;
  c RECORD;
  v_order_id uuid;
BEGIN
  SELECT * INTO v_pkg FROM public.packages
   WHERE name = 'Starter' AND price_cents = 0
   ORDER BY created_at ASC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  FOR c IN
    SELECT co.id FROM public.companies co
     WHERE NOT EXISTS (SELECT 1 FROM public.company_packages cp WHERE cp.company_id = co.id)
  LOOP
    INSERT INTO public.orders (
      company_id, package_id, amount_cents, currency, status,
      posting_count_granted, featured_count_granted, package_snapshot, fulfilled_at
    ) VALUES (
      c.id, v_pkg.id, 0, 'usd', 'paid',
      v_pkg.posting_count, v_pkg.featured_count,
      jsonb_build_object('name', v_pkg.name, 'starter', true, 'backfill', true),
      now()
    ) RETURNING id INTO v_order_id;

    INSERT INTO public.company_packages (
      company_id, package_id, order_id,
      posts_total, posts_used, featured_total, featured_used,
      purchased_at, expires_at, status
    ) VALUES (
      c.id, v_pkg.id, v_order_id,
      v_pkg.posting_count, 0, v_pkg.featured_count, 0,
      now(), now() + interval '30 days', 'active'
    );
  END LOOP;
END $$;
