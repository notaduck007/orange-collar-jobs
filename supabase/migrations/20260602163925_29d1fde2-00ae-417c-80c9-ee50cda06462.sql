CREATE UNIQUE INDEX IF NOT EXISTS company_packages_order_id_unique
  ON public.company_packages (order_id)
  WHERE order_id IS NOT NULL;