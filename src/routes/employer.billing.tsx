import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, Package as PackageIcon, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Row } from "@/lib/row-types";

type Search = { checkout?: "success" | "cancelled"; session_id?: string };

export const Route = createFileRoute("/employer/billing")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    checkout: s.checkout === "success" || s.checkout === "cancelled" ? s.checkout : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: BillingPage,
});

function money(cents: number, currency = "usd") {
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function BillingPage() {
  const { user } = useAuth();
  const { checkout, session_id } = Route.useSearch();

  useEffect(() => {
    if (checkout === "cancelled") toast.info("Checkout cancelled.");
  }, [checkout]);

  const { data: company } = useQuery({
    queryKey: ["billing-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: owned } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (owned) return owned;
      const { data: mem } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!mem?.company_id) return null;
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("id", mem.company_id)
        .maybeSingle();
      return data;
    },
  });

  // Active + past packages
  const { data: packages = [] } = useQuery({
    queryKey: ["company-packages-all", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_packages")
        .select("*, packages(name)")
        .eq("company_id", company!.id)
        .order("purchased_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: checkout === "success" ? 3000 : false,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["company-orders", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, packages(name)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    refetchInterval: checkout === "success" ? 3000 : false,
  });

  // Confirmation: find the matching order by session id (after redirect)
  const confirmOrder = session_id
    ? (orders.find((o) => o.stripe_session_id === session_id) ?? null)
    : null;
  const confirmPkg = confirmOrder
    ? (packages.find((p) => p.order_id === confirmOrder.id) ?? null)
    : null;

  const now = Date.now();
  const activePackages = packages.filter(
    (p) =>
      p.status === "active" &&
      new Date(p.expires_at).getTime() > now &&
      p.posts_used < p.posts_total,
  );
  const inactivePackages = packages.filter((p) => !activePackages.includes(p));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--ink)]">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your purchases, active packages, and downloadable receipts.
        </p>
      </div>

      {checkout === "success" && confirmOrder && (
        <div className="rounded-xl border border-[color:var(--success)] bg-[color:var(--success)]/5 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-[color:var(--success)]" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-[color:var(--ink)]">
                You're all set 🎉 — let's post your job.
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Invoice{" "}
                <span className="font-mono">{confirmOrder.invoice_number ?? "pending"}</span> ·{" "}
                {new Date(confirmOrder.created_at).toLocaleString()}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link to="/employer/jobs/new" className="btn-primary text-base px-6 py-3">
                  Post a job
                </Link>
                <a
                  href={`/billing/receipt/${confirmOrder.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  <Download className="h-4 w-4" /> Download receipt
                </a>
                {confirmOrder.receipt_url && (
                  <a
                    href={confirmOrder.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    Stripe receipt
                  </a>
                )}
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <SummaryCell label="Package" value={confirmOrder.packages?.name ?? "—"} />
                <SummaryCell
                  label="Amount"
                  value={money(confirmOrder.amount_cents, confirmOrder.currency)}
                />
                <SummaryCell
                  label="Posts included"
                  value={String(confirmOrder.posting_count_granted ?? 0)}
                />
                <SummaryCell
                  label="Featured upgrades"
                  value={String(confirmOrder.featured_count_granted ?? 0)}
                />
                <SummaryCell
                  label="Valid until"
                  value={confirmPkg ? new Date(confirmPkg.expires_at).toLocaleDateString() : "…"}
                />
                <SummaryCell
                  label="Posts remaining"
                  value={
                    confirmPkg
                      ? `${Math.max(confirmPkg.posts_total - confirmPkg.posts_used, 0)} / ${confirmPkg.posts_total}`
                      : "…"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {checkout === "cancelled" && (
        <div className="rounded-md border border-border bg-muted p-4 text-sm">
          Checkout was cancelled.{" "}
          <Link to="/pricing" className="font-semibold underline">
            Try again
          </Link>
          .
        </div>
      )}

      {/* Active packages */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Active packages</h2>
          <Link to="/pricing" className="btn-primary text-sm">
            Buy a package
          </Link>
        </div>
        {activePackages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            No active package.{" "}
            <Link to="/pricing" className="font-semibold underline">
              Browse packages
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activePackages.map((p) => (
              <PackageCard key={p.id} pkg={p} />
            ))}
          </div>
        )}
      </section>

      {inactivePackages.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[color:var(--ink)]">Past packages</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {inactivePackages.map((p) => (
              <PackageCard key={p.id} pkg={p} dim />
            ))}
          </div>
        </section>
      )}

      {/* Orders */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-[color:var(--ink)]">Order history</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Package</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No orders yet.
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{o.invoice_number ?? "—"}</td>
                  <td className="px-4 py-2">{o.packages?.name ?? "—"}</td>
                  <td className="px-4 py-2 font-semibold">{money(o.amount_cents, o.currency)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold capitalize ${
                        o.status === "paid"
                          ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                          : o.status === "refunded"
                            ? "bg-muted text-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {o.status === "paid" ? (
                      <div className="flex items-center gap-3 text-xs">
                        <a
                          href={`/billing/receipt/${o.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Download className="h-3 w-3" /> Receipt
                        </a>
                        {o.receipt_url && (
                          <a
                            href={o.receipt_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:underline"
                          >
                            Stripe
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/60 px-3 py-2">
      <p className="label-caps text-[10px]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-[color:var(--ink)]">{value}</p>
    </div>
  );
}

function PackageCard({ pkg, dim }: { pkg: Row; dim?: boolean }) {
  const postsRemaining = Math.max(pkg.posts_total - pkg.posts_used, 0);
  const featRemaining = Math.max(pkg.featured_total - pkg.featured_used, 0);
  const expires = new Date(pkg.expires_at);
  const expired = expires.getTime() < Date.now();
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${dim ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-caps flex items-center gap-1.5">
            <PackageIcon className="h-3.5 w-3.5" /> {pkg.packages?.name ?? "Package"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Purchased {new Date(pkg.purchased_at).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            expired
              ? "bg-muted text-muted-foreground"
              : pkg.status === "depleted"
                ? "bg-muted text-foreground"
                : "bg-[color:var(--success)]/15 text-[color:var(--success)]"
          }`}
        >
          {expired ? "Expired" : pkg.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-[color:var(--ink)]">
            {postsRemaining}
            <span className="text-xs text-muted-foreground">/{pkg.posts_total}</span>
          </p>
          <p className="label-caps text-[10px]">Posts left</p>
        </div>
        <div>
          <p className="text-lg font-bold text-[color:var(--ink)]">
            {featRemaining}
            <span className="text-xs text-muted-foreground">/{pkg.featured_total}</span>
          </p>
          <p className="label-caps text-[10px]">Featured</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">
            {expires.toLocaleDateString()}
          </p>
          <p className="label-caps text-[10px]">{expired ? "Expired" : "Valid until"}</p>
        </div>
      </div>
      {pkg.order_id && (
        <a
          href={`/billing/receipt/${pkg.order_id}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Receipt className="h-3 w-3" /> View receipt
        </a>
      )}
    </div>
  );
}
