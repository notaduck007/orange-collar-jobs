import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Building2, Briefcase, DollarSign, Megaphone, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — WarehouseJobs" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, companies, activeJobs, pendingJobs, paidOrders, pendingAds] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ["active", "published"]),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
        supabase.from("orders").select("amount_cents").eq("status", "paid"),
        supabase.from("advertisements").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      const revenue = (paidOrders.data ?? []).reduce((sum, o) => sum + (o.amount_cents ?? 0), 0);
      return {
        users: users.count ?? 0,
        companies: companies.count ?? 0,
        activeJobs: activeJobs.count ?? 0,
        pendingJobs: pendingJobs.count ?? 0,
        revenue,
        pendingAds: pendingAds.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="label-caps">Overview</p>
        <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Admin dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Users" value={stats?.users ?? "—"} />
        <Stat icon={Building2} label="Companies" value={stats?.companies ?? "—"} />
        <Stat icon={Briefcase} label="Active jobs" value={stats?.activeJobs ?? "—"} />
        <Stat
          icon={DollarSign}
          label="Revenue (paid)"
          value={stats ? `$${(stats.revenue / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-[color:var(--ink)]">Needs review</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReviewCard
            label="Jobs awaiting moderation"
            count={stats?.pendingJobs ?? 0}
            to="/admin/jobs"
            icon={Briefcase}
          />
          <ReviewCard
            label="Ads pending approval"
            count={stats?.pendingAds ?? 0}
            to="/admin/ads"
            icon={Megaphone}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="label-caps">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 text-3xl font-bold text-[color:var(--ink)]">{value}</p>
    </div>
  );
}

function ReviewCard({ label, count, to, icon: Icon }: { label: string; count: number; to: string; icon: typeof Briefcase }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-xl border border-border bg-card p-5 hover:border-primary/60">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--primary-tint)] text-primary">
          {count > 0 ? <AlertTriangle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
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
