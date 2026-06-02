import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders — WarehouseJobs Admin" }] }),
  component: AdminOrders,
});

function AdminOrders() {
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, companies(name), packages(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const paidTotal = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + (o.amount_cents ?? 0), 0);

  const colors: Record<string, string> = {
    paid: "bg-green-100 text-green-900",
    pending: "bg-yellow-100 text-yellow-900",
    failed: "bg-red-100 text-red-900",
    refunded: "bg-gray-100 text-gray-900",
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Payments</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Order log</h1>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm">
          <span className="label-caps">Paid total</span>{" "}
          <span className="font-bold text-primary">
            ${(paidTotal / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Company</th>
              <th className="px-3 py-2 text-left">Package</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Receipt</th>
              <th className="px-3 py-2 text-left">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const intent = o.stripe_payment_intent;
              const refundUrl = intent
                ? `https://dashboard.stripe.com/payments/${intent}`
                : o.stripe_session_id
                ? `https://dashboard.stripe.com/checkout/sessions/${o.stripe_session_id}`
                : null;
              return (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-medium text-[color:var(--ink)]">
                    {o.companies?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2">{o.packages?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    ${((o.amount_cents ?? 0) / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge className={`${colors[o.status] ?? "bg-gray-100"} border-0 capitalize`}>
                      {o.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {o.receipt_url ? (
                      <a href={o.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {refundUrl ? (
                      <a
                        href={refundUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {o.status === "paid" ? "Refund" : "View"} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
