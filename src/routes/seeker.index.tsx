import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Bookmark, BellRing, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { JobCard, type JobSummary } from "@/components/job-card";

export const Route = createFileRoute("/seeker/")({
  head: () => ({ meta: [{ title: "My Dashboard — WarehouseJobs" }] }),
  component: SeekerOverview,
});

function SeekerOverview() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["seeker-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [apps, saved, alerts] = await Promise.all([
        supabase.from("applications").select("id, status", { count: "exact", head: false }).eq("applicant_id", user!.id),
        supabase.from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("job_alerts").select("id", { count: "exact", head: true }).eq("applicant_id", user!.id),
      ]);
      const active = (apps.data ?? []).filter((a) => !["rejected", "hired"].includes(a.status as string)).length;
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
      const { data, error } = await supabase.rpc("recommended_jobs", { _user_id: user!.id, _limit: 6 });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
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
      <div>
        <p className="label-caps text-primary">My dashboard</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your warehouse job search in one place.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Active applications" value={stats?.activeApps ?? 0} icon={FileText} to="/seeker/applications" />
        <StatCard label="Hired" value={stats?.hired ?? 0} icon={FileText} to="/seeker/applications" />
        <StatCard label="Saved jobs" value={stats?.saved ?? 0} icon={Bookmark} to="/seeker/saved" />
        <StatCard label="Active alerts" value={stats?.alerts ?? 0} icon={BellRing} to="/seeker/alerts" />
      </div>

      {recommended.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-lg font-semibold text-[color:var(--ink)]">
              <Sparkles className="h-4 w-4 text-primary" /> Recommended for you
            </h2>
            <Link to="/seeker/profile" className="text-xs font-semibold text-primary hover:underline">
              Tune preferences <ArrowRight className="ml-0.5 inline h-3 w-3" />
            </Link>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on your shift, employment type, skills and location.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {recommended.map((job) => <JobCard key={job.id} job={job} />)}
          </div>
        </div>
      )}



      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Recent applications</h2>
          <Link to="/seeker/applications" className="text-xs font-semibold text-primary hover:underline">
            See all <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </div>
        <div className="mt-3 divide-y divide-border">
          {recentApps.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No applications yet.{" "}
              <Link to="/jobs" className="font-semibold text-primary hover:underline">
                Find a warehouse job
              </Link>{" "}
              to get started.
            </p>
          )}
          {recentApps.map((app: any) => (
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
  const map: Record<string, { label: string; cls: string }> = {
    submitted: { label: "Submitted", cls: "bg-muted text-foreground" },
    reviewed: { label: "Reviewed", cls: "bg-blue-100 text-blue-900" },
    shortlisted: { label: "Shortlisted", cls: "bg-[color:var(--primary-tint)] text-primary" },
    hired: { label: "Hired", cls: "bg-emerald-100 text-emerald-900" },
    rejected: { label: "Not selected", cls: "bg-rose-100 text-rose-900" },
  };
  const m = map[status] ?? map.submitted;
  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}
