import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Building2, Briefcase, Package, Megaphone, Users, Receipt, ShieldCheck, Flag, FileText, Settings, KeyRound } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";
import { useHasAnyAdminAccess, type PermissionKey } from "@/lib/permissions";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean; perm?: PermissionKey };

const NAV: NavItem[] = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/admin/users", icon: Users, label: "Users", perm: "users.view_all" },
  { to: "/admin/companies", icon: Building2, label: "Companies", perm: "companies.view_all" },
  { to: "/admin/jobs", icon: Briefcase, label: "Jobs", perm: "jobs.moderate" },
  { to: "/admin/moderation", icon: Flag, label: "Moderation", perm: "moderation.manage" },
  { to: "/admin/ads", icon: Megaphone, label: "Advertisements", perm: "ads.manage" },
  { to: "/admin/packages", icon: Package, label: "Packages", perm: "packages.manage" },
  { to: "/admin/orders", icon: Receipt, label: "Orders", perm: "orders.view_all" },
  { to: "/admin/content", icon: FileText, label: "Content", perm: "settings.manage" },
  { to: "/admin/settings", icon: Settings, label: "Settings", perm: "settings.manage" },
];

// Route → required permission (for runtime guard). Admin role bypasses all.
const ROUTE_PERMS: { prefix: string; perm: PermissionKey }[] = [
  { prefix: "/admin/moderation", perm: "moderation.manage" },
  { prefix: "/admin/companies", perm: "companies.view_all" },
  { prefix: "/admin/jobs", perm: "jobs.moderate" },
  { prefix: "/admin/ads", perm: "ads.manage" },
  { prefix: "/admin/packages", perm: "packages.manage" },
  { prefix: "/admin/categories", perm: "settings.manage" },
  { prefix: "/admin/content", perm: "settings.manage" },
  { prefix: "/admin/users", perm: "users.view_all" },
  { prefix: "/admin/support", perm: "moderation.manage" },
  { prefix: "/admin/orders", perm: "orders.view_all" },
  { prefix: "/admin/billing", perm: "orders.view_all" },
  { prefix: "/admin/settings", perm: "settings.manage" },
];

function AdminLayout() {
  const { user, role, permissions, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hasAnyAccess = useHasAnyAdminAccess();
  const isAdmin = role === "admin";

  const can = (perm?: PermissionKey) => !perm || isAdmin || permissions.includes(perm);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { mode: "login", next: pathname } as never });
    else if (!hasAnyAccess) navigate({ to: "/" });
  }, [user, hasAnyAccess, loading, navigate, pathname]);

  if (loading || !user || !hasAnyAccess) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="p-12 text-center text-sm text-muted-foreground">Checking admin access…</div>
      </div>
    );
  }

  const requiredPerm = ROUTE_PERMS.find((r) => pathname.startsWith(r.prefix))?.perm;
  const blocked = requiredPerm && !can(requiredPerm);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <p className="label-caps mb-2 inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Admin
          </p>
          <p className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            {isAdmin ? <>Role: <span className="font-semibold text-foreground">Administrator</span></> : <>{permissions.length} permission{permissions.length === 1 ? "" : "s"}</>}
          </p>
          {NAV.filter((n) => can(n.perm)).map((n) => (
            <SideLink key={n.to} to={n.to} icon={n.icon} label={n.label} exact={n.exact} />
          ))}
        </aside>
        <main className="min-w-0">
          {blocked ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-semibold text-[color:var(--ink)]">
                You don't have access to this section
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Requires the <span className="font-semibold">{requiredPerm}</span> permission.
                Ask an administrator to grant it.
              </p>
            </div>
          ) : (
            <Outlet />
          )}
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
