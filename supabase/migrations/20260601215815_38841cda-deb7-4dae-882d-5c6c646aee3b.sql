-- Soft deactivation flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Admin-wide read/write on profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admin can manage all user_roles
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admin can read every order, and delete (for cleanup) — update policy already exists
CREATE POLICY "orders_admin_read" ON public.orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "orders_admin_delete" ON public.orders
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Admin can read all job alerts (for moderation stats)
CREATE POLICY "job_alerts_admin_read" ON public.job_alerts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));