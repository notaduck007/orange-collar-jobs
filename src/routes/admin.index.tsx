import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Users,
  Building2,
  Briefcase,
  DollarSign,
  Megaphone,
  AlertTriangle,
  CalendarIcon,
  TrendingUp,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ScrollText,
  BadgeCheck,
  ListChecks,
  Receipt,
  Package,
  CreditCard,
  FileText,
  BarChart3,
  Download,
  LifeBuoy,
  Lock,
  Settings as SettingsIcon,
  LayoutDashboard,
} from "lucide-react";
import { format, subDays, eachDayOfInterval, startOfDay, isAfter, addDays } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Analytics — WarehouseJobs" }] }),
  component: AdminDashboard,
});

type Range = { from: Date; to: Date };

const PRESETS: { label: string; days: number }[] = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const COLORS = ["hsl(var(--primary))", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

function AdminDashboard() {
  const [range, setRange] = useState<Range>({ from: subDays(new Date(), 30), to: new Date() });

  const fromISO = useMemo(() => startOfDay(range.from).toISOString(), [range.from]);
  const toISO = useMemo(() => range.to.toISOString(), [range.to]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics", fromISO, toISO],
    queryFn: async () => {
      const soon = addDays(new Date(), 7).toISOString();
      const [
        profilesAll,
        profilesNew,
        roles,
        jobsAll,
        jobsNew,
        jobsExpiring,
        companiesAll,
        companiesNew,
        applicationsNew,
        applicationsAll,
        ordersPaid,
        packages,
        pendingJobs,
        pendingAds,
        openReports,
        openTickets,
      ] = await Promise.all([
        supabase.from("profiles").select("id, created_at"),
        supabase.from("profiles").select("id, created_at").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("user_roles").select("role, user_id"),
        supabase.from("jobs").select("id, status, category, created_at, views, featured, expires_at"),
        supabase.from("jobs").select("id, created_at").gte("created_at", fromISO).lte("created_at", toISO),
        supabase
          .from("jobs")
          .select("id, title, expires_at, company_id, companies(name)")
          .not("expires_at", "is", null)
          .gte("expires_at", new Date().toISOString())
          .lte("expires_at", soon)
          .in("status", ["active", "published"])
          .order("expires_at", { ascending: true })
          .limit(10),
        supabase.from("companies").select("id, name, verified, created_at"),
        supabase.from("companies").select("id, created_at").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("applications").select("id, job_id, created_at, status").gte("created_at", fromISO).lte("created_at", toISO),
        supabase.from("applications").select("id", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("id, amount_cents, created_at, package_id, packages(name, kind)")
          .eq("status", "paid")
          .gte("created_at", fromISO)
          .lte("created_at", toISO),
        supabase.from("packages").select("id, name, kind"),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
        supabase.from("advertisements").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);

      return {
        profilesAll: profilesAll.data ?? [],
        profilesNew: profilesNew.data ?? [],
        roles: roles.data ?? [],
        jobsAll: jobsAll.data ?? [],
        jobsNew: jobsNew.data ?? [],
        jobsExpiring: jobsExpiring.data ?? [],
        companiesAll: companiesAll.data ?? [],
        companiesNew: companiesNew.data ?? [],
        applicationsNew: applicationsNew.data ?? [],
        applicationsTotal: applicationsAll.count ?? 0,
        ordersPaid: ordersPaid.data ?? [],
        packages: packages.data ?? [],
        pendingJobs: pendingJobs.count ?? 0,
        pendingAds: pendingAds.count ?? 0,
        openReports: openReports.count ?? 0,
        openTickets: openTickets.count ?? 0,
      };
    },
  });

  const metrics = useMemo(() => {
    if (!data) return null;

    // Trend buckets: one per day in range
    const days = eachDayOfInterval({ start: range.from, end: range.to });
    const dayKey = (d: Date | string) => format(new Date(d), "yyyy-MM-dd");

    const bucket = <T extends { created_at: string }>(rows: T[]) => {
      const map = new Map<string, number>();
      days.forEach((d) => map.set(dayKey(d), 0));
      rows.forEach((r) => {
        const k = dayKey(r.created_at);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
      });
      return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
    };

    const usersTrend = bucket(data.profilesNew);
    const jobsTrend = bucket(data.jobsNew);
    const appsTrend = bucket(data.applicationsNew);
    const revenueTrend = (() => {
      const map = new Map<string, number>();
      days.forEach((d) => map.set(dayKey(d), 0));
      data.ordersPaid.forEach((o: any) => {
        const k = dayKey(o.created_at);
        if (map.has(k)) map.set(k, (map.get(k) ?? 0) + (o.amount_cents ?? 0) / 100);
      });
      return Array.from(map.entries()).map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }));
    })();

    // Roles distribution
    const roleCounts = data.roles.reduce<Record<string, number>>((acc, r: any) => {
      acc[r.role] = (acc[r.role] ?? 0) + 1;
      return acc;
    }, {});
    const rolesData = Object.entries(roleCounts).map(([name, value]) => ({ name, value }));

    // DAU/WAU approximation: distinct users with applications in period
    const appUsersByDay = new Map<string, Set<string>>();
    data.applicationsNew.forEach((a: any) => {
      const k = dayKey(a.created_at);
      if (!appUsersByDay.has(k)) appUsersByDay.set(k, new Set());
      appUsersByDay.get(k)!.add(a.job_id);
    });
    const dau = appUsersByDay.size
      ? Math.round(Array.from(appUsersByDay.values()).reduce((s, x) => s + x.size, 0) / appUsersByDay.size)
      : 0;

    // Jobs by status
    const statusCounts = data.jobsAll.reduce<Record<string, number>>((acc, j: any) => {
      acc[j.status] = (acc[j.status] ?? 0) + 1;
      return acc;
    }, {});
    const jobsByStatus = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // Top categories (by job count)
    const catCounts = data.jobsAll.reduce<Record<string, number>>((acc, j: any) => {
      const c = j.category || "Uncategorized";
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {});
    const topCategories = Object.entries(catCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Companies verified vs not
    const verified = data.companiesAll.filter((c: any) => c.verified).length;
    const unverified = data.companiesAll.length - verified;

    // Applications conversion: applications / views (in period new jobs aggregate)
    const totalViews = data.jobsAll.reduce((s: number, j: any) => s + (j.views ?? 0), 0);
    const conversion = totalViews > 0 ? (data.applicationsNew.length / totalViews) * 100 : 0;

    // Revenue
    const revenueCents = data.ordersPaid.reduce((s: number, o: any) => s + (o.amount_cents ?? 0), 0);
    const adPkgIds = new Set(data.packages.filter((p: any) => p.kind === "ad_slot" || p.ad_slot).map((p: any) => p.id));
    const adRevenueCents = data.ordersPaid
      .filter((o: any) => o.package_id && adPkgIds.has(o.package_id))
      .reduce((s: number, o: any) => s + (o.amount_cents ?? 0), 0);

    // By package
    const pkgRevenue = data.ordersPaid.reduce<Record<string, number>>((acc, o: any) => {
      const name = o.packages?.name ?? "Other";
      acc[name] = (acc[name] ?? 0) + (o.amount_cents ?? 0) / 100;
      return acc;
    }, {});
    const revenueByPackage = Object.entries(pkgRevenue)
      .map(([name, value]) => ({ name, value: Number((value as number).toFixed(2)) }))
      .sort((a, b) => b.value - a.value);

    // Top employers by jobs posted in period
    const topEmployersMap = new Map<string, number>();
    // We need company names — fall back to id
    const companyName = new Map<string, string>();
    data.companiesAll.forEach((c: any) => companyName.set(c.id, c.name));
    data.jobsNew.forEach((j: any) => {
      const id = (j as any).company_id;
      if (!id) return;
      topEmployersMap.set(id, (topEmployersMap.get(id) ?? 0) + 1);
    });
    const topEmployers = Array.from(topEmployersMap.entries())
      .map(([id, count]) => ({ id, name: companyName.get(id) ?? id.slice(0, 8), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      usersTrend,
      jobsTrend,
      appsTrend,
      revenueTrend,
      rolesData,
      dau,
      jobsByStatus,
      topCategories,
      verified,
      unverified,
      conversion,
      totalViews,
      revenueCents,
      adRevenueCents,
      revenueByPackage,
      topEmployers,
    };
  }, [data, range]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Overview</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Admin analytics</h1>
        </div>
        <DateRangeControl range={range} onChange={setRange} />
      </div>

      {/* Needs review */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-[color:var(--ink)]">Needs review</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReviewCard label="Jobs pending" count={data?.pendingJobs ?? 0} to="/admin/jobs" icon={Briefcase} />
          <ReviewCard label="Ads pending" count={data?.pendingAds ?? 0} to="/admin/ads" icon={Megaphone} />
          <ReviewCard label="Open reports" count={data?.openReports ?? 0} to="/admin/support" icon={AlertTriangle} />
          <ReviewCard label="Open tickets" count={data?.openTickets ?? 0} to="/admin/support" icon={AlertTriangle} />
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Users}
          label="Users (total)"
          value={data?.profilesAll.length ?? "—"}
          sub={data ? `+${data.profilesNew.length} this period` : ""}
        />
        <Stat
          icon={Briefcase}
          label="Active jobs"
          value={
            data ? data.jobsAll.filter((j: any) => ["active", "published"].includes(j.status)).length : "—"
          }
          sub={data ? `+${data.jobsNew.length} posted` : ""}
        />
        <Stat
          icon={Building2}
          label="Companies"
          value={data?.companiesAll.length ?? "—"}
          sub={data ? `+${data.companiesNew.length} new · ${metrics?.verified ?? 0} verified` : ""}
        />
        <Stat
          icon={DollarSign}
          label="Revenue"
          value={metrics ? `$${(metrics.revenueCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
          sub={metrics ? `Ad revenue $${(metrics.adRevenueCents / 100).toLocaleString()}` : ""}
        />
      </div>

      {/* Trend charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="New users" icon={Users}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={metrics?.usersTrend ?? []}>
              <defs>
                <linearGradient id="gUsers" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => format(new Date(d), "MMM d")} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#gUsers)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Jobs posted" icon={Briefcase}>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={metrics?.jobsTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => format(new Date(d), "MMM d")} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Applications" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={metrics?.appsTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => format(new Date(d), "MMM d")} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue ($)" icon={DollarSign}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={metrics?.revenueTrend ?? []}>
              <defs>
                <linearGradient id="gRev" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => format(new Date(d), "MMM d")} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Area type="monotone" dataKey="amount" stroke="#f59e0b" fill="url(#gRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Distribution + funnel */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Users by role">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={metrics?.rolesData ?? []}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                label
              >
                {(metrics?.rolesData ?? []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Jobs by status">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={metrics?.jobsByStatus ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Funnel">
          <div className="space-y-3 p-2">
            <FunnelRow label="Job views" value={metrics?.totalViews ?? 0} max={metrics?.totalViews ?? 1} />
            <FunnelRow
              label="Applications"
              value={data?.applicationsNew.length ?? 0}
              max={metrics?.totalViews ?? 1}
            />
            <FunnelRow
              label="Hired"
              value={data?.applicationsNew.filter((a: any) => a.status === "hired").length ?? 0}
              max={metrics?.totalViews ?? 1}
            />
            <div className="mt-4 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              View → Apply conversion:{" "}
              <span className="font-semibold text-[color:var(--ink)]">
                {metrics ? metrics.conversion.toFixed(2) : "0.00"}%
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Approx. DAU (active seekers/day): <span className="font-semibold text-[color:var(--ink)]">{metrics?.dau ?? 0}</span>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TableCard title="Top categories">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Category</th>
                <th className="pb-2 text-right">Jobs</th>
              </tr>
            </thead>
            <tbody>
              {(metrics?.topCategories ?? []).map((c) => (
                <tr key={c.name} className="border-t border-border">
                  <td className="py-2">{c.name}</td>
                  <td className="py-2 text-right font-semibold">{c.value}</td>
                </tr>
              ))}
              {!metrics?.topCategories.length && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-muted-foreground">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Top employers (by jobs posted)">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Company</th>
                <th className="pb-2 text-right">Jobs posted</th>
              </tr>
            </thead>
            <tbody>
              {(metrics?.topEmployers ?? []).map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-2">{e.name}</td>
                  <td className="py-2 text-right font-semibold">{e.count}</td>
                </tr>
              ))}
              {!metrics?.topEmployers.length && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-muted-foreground">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Revenue by package">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Package</th>
                <th className="pb-2 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(metrics?.revenueByPackage ?? []).map((r) => (
                <tr key={r.name} className="border-t border-border">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-right font-semibold">${r.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {!metrics?.revenueByPackage.length && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-muted-foreground">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Expiring soon (next 7 days)">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Job</th>
                <th className="pb-2 text-right">Expires</th>
              </tr>
            </thead>
            <tbody>
              {(data?.jobsExpiring ?? []).map((j: any) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="py-2">
                    <p className="font-medium">{j.title}</p>
                    <p className="text-xs text-muted-foreground">{j.companies?.name ?? ""}</p>
                  </td>
                  <td className="py-2 text-right text-xs">
                    {j.expires_at ? format(new Date(j.expires_at), "MMM d, yyyy") : "—"}
                  </td>
                </tr>
              ))}
              {!data?.jobsExpiring.length && (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-muted-foreground">
                    Nothing expiring soon
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Companies: verified vs unverified">
          <div className="flex h-[200px] items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Verified", value: metrics?.verified ?? 0 },
                    { name: "Unverified", value: metrics?.unverified ?? 0 },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  <Cell fill="#10b981" />
                  <Cell fill="hsl(var(--muted))" />
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </TableCard>
      </div>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Loading analytics…</p>}
    </div>
  );
}

function DateRangeControl({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.label}
          variant="outline"
          size="sm"
          onClick={() => onChange({ from: subDays(new Date(), p.days), to: new Date() })}
        >
          {p.label}
        </Button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("min-w-[220px] justify-start text-left font-normal")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {format(range.from, "MMM d, yyyy")} – {format(range.to, "MMM d, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            defaultMonth={range.from}
            selected={{ from: range.from, to: range.to }}
            onSelect={(r: any) => {
              if (r?.from && r?.to && isAfter(r.to, r.from)) onChange({ from: r.from, to: r.to });
            }}
            numberOfMonths={2}
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="label-caps">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 text-3xl font-bold text-[color:var(--ink)]">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function ReviewCard({
  label,
  count,
  to,
  icon: Icon,
}: {
  label: string;
  count: number;
  to: string;
  icon: typeof Briefcase;
}) {
  const active = count > 0;
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center justify-between rounded-xl border bg-card p-5 transition",
        active ? "border-amber-500/60 hover:border-amber-500" : "border-border hover:border-primary/60",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md",
            active ? "bg-amber-500/10 text-amber-600" : "bg-[color:var(--primary-tint)] text-primary",
          )}
        >
          {active ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          <Icon className="hidden" />
          <Clock className="hidden" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">{label}</p>
          <p className="text-xs text-muted-foreground">Open queue →</p>
        </div>
      </div>
      <p className="text-2xl font-bold text-[color:var(--ink)]">{count}</p>
    </Link>
  );
}

function ChartCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Users;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-[color:var(--ink)]">{title}</h3>
      {children}
    </div>
  );
}

function FunnelRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-[color:var(--ink)]">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
