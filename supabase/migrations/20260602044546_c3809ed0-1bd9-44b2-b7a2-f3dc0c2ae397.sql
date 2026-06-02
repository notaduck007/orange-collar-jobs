INSERT INTO public.admin_permissions (user_id, level)
VALUES ('9d3ebecd-4a29-4ccd-a767-c11b2646b2fc', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET level = 'super_admin';

INSERT INTO public.user_roles (user_id, role)
VALUES ('9d3ebecd-4a29-4ccd-a767-c11b2646b2fc', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;