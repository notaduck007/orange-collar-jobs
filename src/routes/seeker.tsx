import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, FileText, Bookmark, BellRing, User, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/seeker")({
  component: SeekerLayout,
});

function SeekerLayout() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login", next: "/seeker" } as never });
      return;
    }
    if (role && role !== "job_seeker" && role !== "admin") {
      navigate({ to: "/employer" });
    }
  }, [user, role, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <div className="p-12 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <p className="label-caps mb-2">{t("common.jobSeeker")}</p>
          <SideLink to="/seeker" icon={LayoutDashboard} label={t("seeker.overview")} exact />
          <SideLink to="/seeker/applications" icon={FileText} label={t("seeker.myApplications")} />
          <SideLink to="/seeker/saved" icon={Bookmark} label={t("seeker.savedJobs")} />
          <SideLink to="/seeker/alerts" icon={BellRing} label={t("seeker.jobAlerts")} />
          <SideLink to="/seeker/profile" icon={User} label={t("seeker.profileResume")} />
          <SideLink to="/seeker/privacy" icon={ShieldCheck} label={t("seeker.privacy")} />
          <Link
            to="/jobs"
            className="mt-6 block rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-[var(--shadow-orange)]"
          >
            {t("seeker.searchJobsBtn")}
          </Link>
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

function SideLink({
  to,
  icon: Icon,
  label,
  exact,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  exact?: boolean;
}) {
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
