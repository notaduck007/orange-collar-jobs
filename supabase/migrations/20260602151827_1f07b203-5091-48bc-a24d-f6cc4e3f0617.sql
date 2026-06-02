ALTER TABLE public.user_role_assignments
  ADD CONSTRAINT user_role_assignments_user_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;