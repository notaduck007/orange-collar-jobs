import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, subDays, eachDayOfInterval, startOfDay } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { DollarSign, Download, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Row } from "@/lib/row-types";
import { errMsg } from "@/lib/row-types";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({ meta: [{ title: "Billing — WarehouseJobs Admin" }] }),
  component: AdminBilling,
});

type OrderRow = {
  id: string;
  created_at: string;
  status: string;
  amount_cents: number | null;
  currency: string | null;
  company_id: string | null;
  package_id: string | null;
  stripe_payment_intent: string | null;
  stripe_session_id: string | null;
  receipt_url: string | null;
  posting_count_granted: number | null;
  featured_count_granted: number | null;
  companies: { name: string | null } | null;
  packages: { name: string | null } | null;
};

const PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-900",
  pending: "bg-amber-100 text-amber-900",
  failed: "bg-red-100 text-red-900",
  refunded: "bg-slate-200 text-slate-900",
};

function AdminBilling() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const [status, setStatus] = useState<string>("all");
  const [packageId, setPackageId] = useState<string>("all");
  const [companyQuery, setCompanyQuery] = useState("");
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  const from = useMemo(() => startOfDay(subDays(new Date(), days - 1)), [days]);
  const to = useMemo(() => new Date(), []);

  const { data: packages = [] } = useQuery({
    queryKey: ["billing-packages"],
    queryFn: async () => {
      const { data } = await supabase.from("packages").select("id, name").order("name");
      return data ?? [];
    },
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-billing-orders", days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, status, amount_cents, currency, company_id, package_id, stripe_payment_intent, stripe_session_id, receipt_url, posting_count_granted, featured_count_granted, companies(name), packages(name)",
        )
        .gte("created_at", from.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (packageId !== "all" && o.package_id !== packageId) return false;
      if (q && !(o.companies?.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orders, status, packageId, companyQuery]);

  const totals = useMemo(() => {
    const paid = filtered.filter((o) => o.status === "paid");
    const refunded = filtered.filter((o) => o.status === "refunded");
    const paidCents = paid.reduce((s, o) => s + (o.amount_cents ?? 0), 0);
    const refundedCents = refunded.reduce((s, o) => s + (o.amount_cents ?? 0), 0);
    return {
      paidCents,
      refundedCents,
      netCents: paidCents - refundedCents,
      paidCount: paid.length,
      refundCount: refunded.length,
      totalCount: filtered.length,
    };
  }, [filtered]);

  const trend = useMemo(() => {
    const buckets = new Map<
      string,
      { date: string; revenue: number; orders: number; refunds: number }
    >();
    eachDayOfInterval({ start: from, end: to }).forEach((d) => {
      const k = format(d, "yyyy-MM-dd");
      buckets.set(k, { date: format(d, "MMM d"), revenue: 0, orders: 0, refunds: 0 });
    });
    for (const o of filtered) {
      const k = format(new Date(o.created_at), "yyyy-MM-dd");
      const b = buckets.get(k);
      if (!b) continue;
      if (o.status === "paid") {
        b.revenue += (o.amount_cents ?? 0) / 100;
        b.orders += 1;
      } else if (o.status === "refunded") {
        b.refunds += (o.amount_cents ?? 0) / 100;
      }
    }
    return Array.from(buckets.values());
  }, [filtered, from, to]);

  const byPackage = useMemo(() => {
    const m = new Map<string, { name: string; revenue: number; count: number }>();
    for (const o of filtered) {
      if (o.status !== "paid") continue;
      const name = o.packages?.name ?? "—";
      const cur = m.get(name) ?? { name, revenue: 0, count: 0 };
      cur.revenue += (o.amount_cents ?? 0) / 100;
      cur.count += 1;
      m.set(name, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  function exportCsv() {
    const headers = [
      "id",
      "created_at",
      "status",
      "amount",
      "currency",
      "company",
      "package",
      "stripe_payment_intent",
      "stripe_session_id",
      "posting_granted",
      "featured_granted",
    ];
    const rows = filtered.map((o) =>
      [
        o.id,
        o.created_at,
        o.status,
        ((o.amount_cents ?? 0) / 100).toFixed(2),
        (o.currency ?? "usd").toUpperCase(),
        (o.companies?.name ?? "").replace(/"/g, '""'),
        (o.packages?.name ?? "").replace(/"/g, '""'),
        o.stripe_payment_intent ?? "",
        o.stripe_session_id ?? "",
        o.posting_count_granted ?? 0,
        o.featured_count_granted ?? 0,
      ]
        .map((v) => `"${String(v)}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} orders`);
  }

  async function submitRefund() {
    if (!refundTarget) return;
    if (refundReason.trim().length < 5) {
      toast.error("Please provide a reason (5+ chars)");
      return;
    }
    setRefunding(true);
    try {
      const { data, error } = await supabase.functions.invoke("refund-order", {
        body: { order_id: refundTarget.id, reason: refundReason.trim() },
      });
      if (error || (data as Row)?.error) {
        throw new Error((data as Row)?.error ?? error?.message ?? "Refund failed");
      }
      toast.success("Refund issued, credits reversed");
      setRefundTarget(null);
      setRefundReason("");
      qc.invalidateQueries({ queryKey: ["admin-billing-orders"] });
    } catch (e: unknown) {
      toast.error(errMsg(e, "Refund failed"));
    } finally {
      setRefunding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Finance</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Billing console</h1>
          <p className="text-sm text-muted-foreground">
            Orders, revenue, refunds across all companies.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant={days === p.days ? "default" : "outline"}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Net revenue" value={fmt(totals.netCents)} accent />
        <Kpi label="Paid orders" value={`${totals.paidCount}`} sub={fmt(totals.paidCents)} />
        <Kpi label="Refunded" value={`${totals.refundCount}`} sub={fmt(totals.refundedCents)} />
        <Kpi label="Total orders (filtered)" value={`${totals.totalCount}`} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Revenue trend">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                fill="url(#rev)"
              />
              <Area
                type="monotone"
                dataKey="refunds"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive))"
                fillOpacity={0.15}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Revenue by package">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byPackage}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <Input
          placeholder="Search company…"
          value={companyQuery}
          onChange={(e) => setCompanyQuery(e.target.value)}
          className="h-9 w-56"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={packageId} onValueChange={setPackageId}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Package" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All packages</SelectItem>
            {packages.map((p: Row) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {isLoading ? "Loading…" : `${filtered.length} orders`}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-left">Package</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Stripe</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const intent = o.stripe_payment_intent;
              const stripeUrl = intent
                ? `https://dashboard.stripe.com/test/payments/${intent}`
                : o.stripe_session_id
                  ? `https://dashboard.stripe.com/test/checkout/sessions/${o.stripe_session_id}`
                  : null;
              return (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(o.created_at), "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="px-3 py-2 font-medium text-[color:var(--ink)]">
                    {o.companies?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2">{o.packages?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    ${((o.amount_cents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      className={`${STATUS_COLORS[o.status] ?? "bg-gray-100"} border-0 capitalize`}
                    >
                      {o.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {stripeUrl ? (
                      <a
                        href={stripeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {o.status === "paid" ? (
                      <Button size="sm" variant="outline" onClick={() => setRefundTarget(o)}>
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refund
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No orders match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Refund dialog */}
      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund order</DialogTitle>
            <DialogDescription>
              This will refund the Stripe charge, reverse granted credits, mark the order as
              refunded, audit the action, and notify the company.
            </DialogDescription>
          </DialogHeader>
          {refundTarget && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div>
                  <span className="text-muted-foreground">Company:</span>{" "}
                  <span className="font-medium">{refundTarget.companies?.name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Package:</span>{" "}
                  {refundTarget.packages?.name ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>{" "}
                  <span className="font-semibold">
                    ${((refundTarget.amount_cents ?? 0) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Credits to reverse: {refundTarget.posting_count_granted ?? 0} post,{" "}
                  {refundTarget.featured_count_granted ?? 0} featured
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Reason (required)
                </label>
                <Textarea
                  rows={3}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Why is this order being refunded?"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundTarget(null)} disabled={refunding}>
              Cancel
            </Button>
            <Button onClick={submitRefund} disabled={refunding}>
              {refunding ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="mr-1.5 h-4 w-4" />
              )}
              Issue refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Kpi({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${accent ? "border-primary/30 bg-[color:var(--primary-tint)]" : "border-border bg-card"}`}
    >
      <p className="label-caps">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold ${accent ? "text-primary" : "text-[color:var(--ink)]"}`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold text-[color:var(--ink)]">{title}</h3>
      {children}
    </div>
  );
}
