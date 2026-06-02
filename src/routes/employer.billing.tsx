import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Search = { checkout?: "success" | "cancelled"; session_id?: string };

export const Route = createFileRoute("/employer/billing")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    checkout: s.checkout === "success" || s.checkout === "cancelled" ? s.checkout : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
  component: BillingPage,
});

function BillingPage() {
  const { user } = useAuth();
  const { checkout } = Route.useSearch();

  useEffect(() => {
    if (checkout === "success") toast.success("Payment received! Credits added to your account.");
    if (checkout === "cancelled") toast.info("Checkout cancelled.");
  }, [checkout]);

  const { data: company } = useQuery({
    queryKey: ["billing-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: owned } = await supabase.from("companies").select("*").eq("owner_id", user!.id).maybeSingle();
      if (owned) return owned;
      const { data: mem } = await supabase
        .from("company_members").select("company_id").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle();
      if (!mem?.company_id) return null;
      const { data } = await supabase.from("companies").select("*").eq("id", mem.company_id).maybeSingle();
      return data;
    },
  });

  const { data: credits = [] } = useQuery({
    queryKey: ["company-credits", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("company_credits").select("*").eq("company_id", company!.id);
      return data ?? [];
    },
    refetchInterval: checkout === "success" ? 3000 : false,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["company-orders", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders").select("*, packages(name)").eq("company_id", company!.id).order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
    refetchInterval: checkout === "success" ? 3000 : false,
  });

  const postBalance = credits.find((c) => c.credit_type === "post")?.balance ?? 0;
  const featBalance = credits.find((c) => c.credit_type === "featured")?.balance ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--ink)]">Billing & Credits</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your posting credits and review past purchases.</p>
      </div>

      {checkout === "success" && (
        <div className="rounded-md border border-[color:var(--success)] bg-[color:var(--success)]/10 p-4 text-sm">
          Payment received — credits will appear here within a few seconds.
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="rounded-md border border-border bg-muted p-4 text-sm">
          Checkout was cancelled. <Link to="/pricing" className="font-semibold underline">Try again</Link>.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="label-caps">Job post credits</p>
          <p className="mt-2 text-3xl font-bold text-[color:var(--ink)]">{postBalance}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="label-caps">Featured upgrades</p>
          <p className="mt-2 text-3xl font-bold text-[color:var(--ink)]">{featBalance}</p>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Recent orders</h2>
          <Link to="/pricing" className="btn-primary text-sm">Buy more credits</Link>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Package</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No orders yet.</td></tr>
              )}
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{o.packages?.name ?? "—"}</td>
                  <td className="px-4 py-2">${(o.amount_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      o.status === "paid" ? "bg-[color:var(--success)]/15 text-[color:var(--success)]" : "bg-muted text-muted-foreground"
                    }`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    {o.receipt_url ? <a href={o.receipt_url} target="_blank" rel="noreferrer" className="underline">View</a> : <span className="text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
