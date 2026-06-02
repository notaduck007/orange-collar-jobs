
-- Add invoice number to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_number text UNIQUE;

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
$$;

CREATE OR REPLACE FUNCTION public.orders_assign_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND NEW.invoice_number IS NULL THEN
    NEW.invoice_number := public.generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_assign_invoice_number ON public.orders;
CREATE TRIGGER trg_orders_assign_invoice_number
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_assign_invoice_number();

-- Backfill existing paid orders
UPDATE public.orders SET invoice_number = public.generate_invoice_number()
 WHERE status = 'paid' AND invoice_number IS NULL;
