import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { LayoutDashboard, Briefcase, Building2, CreditCard } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/employer")({
  component: EmployerLayout,
});

function EmployerLayout() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login", next: "/employer" } as never });
      return;
    }
    if (role && role !== "employer" && role !== "admin") {
      navigate({ to: "/" });
    }
  }, [user, role, loading, navigate]);

  // Find the employer's company; if missing, route them to onboarding
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["employer-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user || companyLoading) return;
    if (!company && pathname !== "/employer/onboarding") {
      navigate({ to: "/employer/onboarding" });
    }
  }, [user, company, companyLoading, pathname, navigate]);

  if (loading || (!!user && companyLoading)) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  // Onboarding renders without the sidebar chrome
  if (pathname === "/employer/onboarding") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <Outlet />
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <p className="label-caps mb-2">Employer</p>
          <SideLink to="/employer" icon={LayoutDashboard} label="Dashboard" exact />
          <SideLink to="/employer/jobs/new" icon={Briefcase} label="Post a Job" />
          <SideLink to="/employer/onboarding" icon={Building2} label="Company Profile" />
          <Link to="/pricing" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted">
            <CreditCard className="h-4 w-4" /> Buy Credits
          </Link>
          {company && (
            <div className="mt-6 rounded-lg border border-border bg-card p-3 text-xs">
              <p className="label-caps text-[10px]">Signed in as</p>
              <p className="mt-1 truncate font-semibold text-[color:var(--ink)]">{company.name}</p>
            </div>
          )}
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
        active
          ? "bg-[color:var(--primary-tint)] font-semibold text-[color:var(--ink)]"
          : "text-foreground hover:bg-muted"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}
