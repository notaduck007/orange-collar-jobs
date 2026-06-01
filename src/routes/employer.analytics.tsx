import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, Eye, Users, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/employer/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Employer" }] }),
  component: EmployerAnalytics,
});

const STAGES = ["submitted", "reviewed", "interview", "hired", "rejected"] as const;
type Stage = (typeof STAGES)[number];

function EmployerAnalytics() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [jobFilter, setJobFilter] = useState<string>("all");

  const { data: company } = useQuery({
    queryKey: ["employer-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: owned } = await supabase.from("companies").select("*").eq("owner_id", user!.id).maybeSingle();
      if (owned) return owned;
      const { data: m } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!m?.company_id) return null;
      const { data: c } = await supabase.from("companies").select("*").eq("id", m.company_id).maybeSingle();
      return c ?? null;
    },
  });

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [days]);

  const { data, isLoading } = useQuery({
    queryKey: ["employer-analytics", company?.id, days, jobFilter],
    enabled: !!company,
    queryFn: async () => {
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, title, views, created_at")
        .eq("company_id", company!.id);
      const allJobs = jobs ?? [];
      const scopedJobs = jobFilter === "all" ? allJobs : allJobs.filter((j) => j.id === jobFilter);
      const ids = scopedJobs.map((j) => j.id);

      let apps: { id: string; job_id: string; status: Stage; created_at: string }[] = [];
      if (ids.length) {
        const { data: appsData } = await supabase
          .from("applications")
          .select("id, job_id, status, created_at")
          .in("job_id", ids);
        apps = (appsData ?? []) as typeof apps;
      }

      const appsInRange = apps.filter((a) => new Date(a.created_at) >= since);
      const totalViews = scopedJobs.reduce((s, j) => s + (j.views ?? 0), 0);
      const totalApps = appsInRange.length;
      const conversion = totalViews > 0 ? (totalApps / totalViews) * 100 : 0;

      const byStage = STAGES.map((stage) => ({
        stage,
        count: appsInRange.filter((a) => a.status === stage).length,
      }));

      // Daily trend
      const trend: { date: string; applications: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        const count = appsInRange.filter((a) => a.created_at.slice(0, 10) === key).length;
        trend.push({ date: key.slice(5), applications: count });
      }

      const perJob = scopedJobs
        .map((j) => {
          const jobApps = appsInRange.filter((a) => a.job_id === j.id).length;
          return {
            id: j.id,
            title: j.title,
            views: j.views ?? 0,
            applications: jobApps,
            conversion: (j.views ?? 0) > 0 ? (jobApps / (j.views ?? 0)) * 100 : 0,
          };
        })
        .sort((a, b) => b.applications - a.applications);

      return { allJobs, totalViews, totalApps, conversion, byStage, trend, perJob };
    },
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps text-primary">Analytics</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">Hiring performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">Views, applications, and stage conversion across your jobs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Job" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All jobs</SelectItem>
              {(data?.allJobs ?? []).map((j) => (
                <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Eye} label="Job views" value={data?.totalViews ?? 0} loading={isLoading} />
        <Stat icon={Users} label="Applications" value={data?.totalApps ?? 0} sub={`Last ${days} days`} loading={isLoading} />
        <Stat icon={TrendingUp} label="Conversion" value={`${(data?.conversion ?? 0).toFixed(1)}%`} sub="views → apply" loading={isLoading} />
        <Stat icon={BarChart3} label="Active jobs" value={data?.allJobs.length ?? 0} loading={isLoading} />
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">Applications trend</h2>
          <p className="text-xs text-muted-foreground">Daily applications over the selected window.</p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.trend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="applications" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">Applications by stage</h2>
          <p className="text-xs text-muted-foreground">Pipeline distribution within range.</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.byStage ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-[color:var(--ink)]">Per-job performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Job</th>
                <th className="px-5 py-3 text-right">Views</th>
                <th className="px-5 py-3 text-right">Apps ({days}d)</th>
                <th className="px-5 py-3 text-right">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {(data?.perJob ?? []).map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium text-[color:var(--ink)]">{j.title}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{j.views}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{j.applications}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{j.conversion.toFixed(1)}%</td>
                </tr>
              ))}
              {!isLoading && (data?.perJob ?? []).length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-muted-foreground">No jobs yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub, loading }: { icon: typeof Eye; label: string; value: number | string; sub?: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="label-caps">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-[color:var(--ink)]">{loading ? "—" : value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
