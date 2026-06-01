import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Building2, Briefcase, Package, Megaphone, Users, Receipt, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { mode: "login", next: pathname } as never });
    else if (role && role !== "admin") navigate({ to: "/" });
  }, [user, role, loading, navigate, pathname]);

  if (loading || !user || role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="p-12 text-center text-sm text-muted-foreground">Checking admin access…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <p className="label-caps mb-2 inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Admin</p>
          <SideLink to="/admin" icon={LayoutDashboard} label="Dashboard" exact />
          <SideLink to="/admin/companies" icon={Building2} label="Companies" />
          <SideLink to="/admin/jobs" icon={Briefcase} label="Jobs" />
          <SideLink to="/admin/ads" icon={Megaphone} label="Advertisements" />
          <SideLink to="/admin/packages" icon={Package} label="Packages" />
          <SideLink to="/admin/users" icon={Users} label="Users" />
          <SideLink to="/admin/orders" icon={Receipt} label="Orders" />
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

function SideLink({ to, icon: Icon, label, exact }: { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active ? "bg-[color:var(--primary-tint)] font-semibold text-[color:var(--ink)]" : "text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
