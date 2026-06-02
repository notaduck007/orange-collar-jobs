import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Building2, Briefcase, Package, Megaphone, Users, Receipt, ShieldCheck, Gavel, DollarSign } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";
import { useAdminPermissions, type AdminCapability } from "@/lib/admin-permissions";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

type NavItem = { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean; cap?: AdminCapability };

const NAV: NavItem[] = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/admin/moderation", icon: Gavel, label: "Moderation", cap: "moderation" },
  { to: "/admin/companies", icon: Building2, label: "Companies", cap: "moderation" },
  { to: "/admin/jobs", icon: Briefcase, label: "Jobs", cap: "moderation" },
  { to: "/admin/ads", icon: Megaphone, label: "Advertisements", cap: "ads" },
  { to: "/admin/packages", icon: Package, label: "Packages", cap: "settings" },
  { to: "/admin/users", icon: Users, label: "Users", cap: "users" },
  { to: "/admin/orders", icon: Receipt, label: "Orders", cap: "billing" },
];

// Route → required capability (for runtime guard)
const ROUTE_CAPS: { prefix: string; cap: AdminCapability }[] = [
  { prefix: "/admin/moderation", cap: "moderation" },
  { prefix: "/admin/companies", cap: "moderation" },
  { prefix: "/admin/jobs", cap: "moderation" },
  { prefix: "/admin/ads", cap: "ads" },
  { prefix: "/admin/packages", cap: "settings" },
  { prefix: "/admin/users", cap: "users" },
  { prefix: "/admin/orders", cap: "billing" },
];


function AdminLayout() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { loading: permsLoading, level, can } = useAdminPermissions();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", search: { mode: "login", next: pathname } as never });
    else if (role && role !== "admin") navigate({ to: "/" });
  }, [user, role, loading, navigate, pathname]);

  if (loading || permsLoading || !user || role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="p-12 text-center text-sm text-muted-foreground">Checking admin access…</div>
      </div>
    );
  }

  const requiredCap = ROUTE_CAPS.find((r) => pathname.startsWith(r.prefix))?.cap;
  const blocked = requiredCap && !can(requiredCap);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <p className="label-caps mb-2 inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Admin
          </p>
          {level && (
            <p className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Level: <span className="font-semibold text-foreground">{level.replace("_", " ")}</span>
            </p>
          )}
          {NAV.filter((n) => !n.cap || can(n.cap)).map((n) => (
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
                Requires the <span className="font-semibold">{requiredCap}</span> capability.
                Ask a super admin to update your permissions.
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
