import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, Bookmark, BellRing, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { JobCard, type JobSummary } from "@/components/job-card";
import seekerWelcome from "@/assets/seeker-welcome.webp";
import type { Row } from "@/lib/row-types";

export const Route = createFileRoute("/seeker/")({
  head: () => ({ meta: [{ title: "My Dashboard — WarehouseJobs.com" }] }),
  component: SeekerOverview,
});

function SeekerOverview() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: stats } = useQuery({
    queryKey: ["seeker-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [apps, saved, alerts] = await Promise.all([
        supabase
          .from("applications")
          .select("id, status", { count: "exact", head: false })
          .eq("applicant_id", user!.id),
        supabase
          .from("saved_jobs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),
        supabase
          .from("job_alerts")
          .select("id", { count: "exact", head: true })
          .eq("applicant_id", user!.id),
      ]);
      const active = (apps.data ?? []).filter(
        (a) => !["rejected", "hired"].includes(a.status as string),
      ).length;
      const hired = (apps.data ?? []).filter((a) => a.status === "hired").length;
      return {
        totalApps: apps.data?.length ?? 0,
        activeApps: active,
        hired,
        saved: saved.count ?? 0,
        alerts: alerts.count ?? 0,
      };
    },
  });

  const { data: recentApps = [] } = useQuery({
    queryKey: ["seeker-recent-apps", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, status, created_at, jobs(slug, title, location, companies(name))")
        .eq("applicant_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: recommended = [] } = useQuery({
    queryKey: ["seeker-recommended", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("recommended_jobs", {
        _user_id: user!.id,
        _limit: 6,
      });
      if (error) throw error;
      return (data ?? []).map((r: Row) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        location: r.location,
        shift: r.shift,
        employment_type: r.employment_type,
        pay_min: r.pay_min,
        pay_max: r.pay_max,
        featured: r.featured,
        category: r.category,
        companies: r.company_name ? { name: r.company_name, slug: r.company_slug } : null,
      })) as JobSummary[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5 rounded-xl border border-border bg-card p-5">
        <img
          src={seekerWelcome}
          alt="Smiling Latina warehouse worker in a hi-vis vest and beanie in a bright distribution center aisle, ready for the next shift."
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          className="hidden h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-[color:var(--primary-tint)] sm:block"
        />
        <div>
          <p className="label-caps text-primary">{t("seeker.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
            {t("seeker.welcome")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("seeker.sub")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard
          label={t("seeker.activeApps")}
          value={stats?.activeApps ?? 0}
          icon={FileText}
          to="/seeker/applications"
        />
        <StatCard
          label={t("seeker.hired")}
          value={stats?.hired ?? 0}
          icon={FileText}
          to="/seeker/applications"
        />
        <StatCard label={t("seeker.saved")} value={stats?.saved ?? 0} icon={Bookmark} to="/seeker/saved" />
        <StatCard
          label={t("seeker.alerts")}
          value={stats?.alerts ?? 0}
          icon={BellRing}
          to="/seeker/alerts"
        />
      </div>

      {recommended.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-lg font-semibold text-[color:var(--ink)]">
              <Sparkles className="h-4 w-4 text-primary" /> {t("seeker.recommended")}
            </h2>
            <Link
              to="/seeker/profile"
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t("seeker.tunePrefs")} <ArrowRight className="ml-0.5 inline h-3 w-3" />
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("seeker.recommendedSub")}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {recommended.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">{t("seeker.recentApps")}</h2>
          <Link
            to="/seeker/applications"
            className="text-xs font-semibold text-primary hover:underline"
          >
            {t("seeker.seeAll")} <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </div>
        <div className="mt-3 divide-y divide-border">
          {recentApps.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center sm:flex-row sm:gap-5 sm:py-6 sm:text-left">
              <img
                src={seekerWelcome}
                alt="Encouraging photo of a warehouse worker smiling in an aisle of pallet racks."
                width={72}
                height={72}
                loading="lazy"
                decoding="async"
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-[color:var(--primary-tint)]"
              />
              <p className="text-sm text-muted-foreground">
                {t("seeker.noApps")}{" "}
                <Link to="/jobs" className="font-semibold text-primary hover:underline">
                  {t("seeker.findJob")}
                </Link>
              </p>
            </div>
          )}
          {recentApps.map((app: Row) => (
            <Link
              key={app.id}
              to="/jobs/$slug"
              params={{ slug: app.jobs?.slug ?? "" }}
              className="flex items-center justify-between py-3 hover:bg-muted/40"
            >
              <div>
                <p className="text-sm font-semibold text-[color:var(--ink)]">{app.jobs?.title}</p>
                <p className="text-xs text-muted-foreground">
                  {app.jobs?.companies?.name} · {app.jobs?.location}
                </p>
              </div>
              <StatusBadge status={app.status} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  to,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary hover:shadow-[var(--shadow-orange)]"
    >
      <div className="flex items-center justify-between">
        <p className="label-caps text-[10px]">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      </div>
      <p className="mt-2 text-3xl font-bold text-[color:var(--ink)]">{value}</p>
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const map: Record<string, { labelKey: string; cls: string }> = {
    submitted: { labelKey: "seeker.status_submitted", cls: "bg-muted text-foreground" },
    reviewed: { labelKey: "seeker.status_reviewed", cls: "bg-blue-100 text-blue-900" },
    shortlisted: { labelKey: "seeker.status_shortlisted", cls: "bg-[color:var(--primary-tint)] text-primary" },
    hired: { labelKey: "seeker.status_hired", cls: "bg-emerald-100 text-emerald-900" },
    rejected: { labelKey: "seeker.status_rejected", cls: "bg-rose-100 text-rose-900" },
  };
  const m = map[status] ?? map.submitted;
  return (
    <span
      className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${m.cls}`}
    >
      {t(m.labelKey)}
    </span>
  );
}
