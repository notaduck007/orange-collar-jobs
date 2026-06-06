import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Row } from "@/lib/row-types";

export const Route = createFileRoute("/billing/receipt/$orderId")({
  component: ReceiptPage,
});

function money(cents: number, currency = "usd") {
  return `$${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function ReceiptPage() {
  const { orderId } = Route.useParams();
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["receipt", orderId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, packages(name, description, duration_days), companies(name)")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: cpkg } = useQuery({
    queryKey: ["receipt-pkg", orderId],
    enabled: !!data?.id,
    queryFn: async () => {
      const { data: row } = await supabase
        .from("company_packages")
        .select("*")
        .eq("order_id", orderId)
        .maybeSingle();
      return row;
    },
  });

  useEffect(() => {
    if (data?.status === "paid") {
      // small delay so styles paint
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [data?.status]);

  if (loading || isLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="p-10 text-center text-sm">
        Please{" "}
        <Link to="/auth" className="underline">
          sign in
        </Link>{" "}
        to view your receipt.
      </div>
    );
  }
  if (!data) {
    return <div className="p-10 text-center text-sm">Receipt not found.</div>;
  }

  const snap = (data.package_snapshot ?? {}) as Row;
  const posts = data.posting_count_granted ?? snap.posting_count ?? 0;
  const feats = data.featured_count_granted ?? snap.featured_count ?? 0;

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-[color:var(--ink)] print:p-0">
      <div className="mb-6 flex items-start justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Receipt</p>
          <h1 className="mt-1 text-2xl font-bold">WarehouseJobs.com</h1>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Invoice</p>
          <p className="font-mono text-sm">{data.invoice_number ?? "—"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(data.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Billed to</p>
          <p className="mt-1 font-semibold">{data.companies?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Status</p>
          <p className="mt-1 font-semibold capitalize">{data.status}</p>
        </div>
      </div>

      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border">
            <td className="py-3">
              <p className="font-semibold">
                {data.packages?.name ?? snap.name ?? "Posting package"}
              </p>
              <p className="text-xs text-muted-foreground">
                {posts} job post{posts === 1 ? "" : "s"} · {feats} featured upgrade
                {feats === 1 ? "" : "s"}
                {cpkg && ` · valid until ${new Date(cpkg.expires_at).toLocaleDateString()}`}
              </p>
            </td>
            <td className="py-3 text-right font-semibold">
              {money(data.amount_cents, data.currency)}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 text-right text-xs uppercase text-muted-foreground">Total</td>
            <td className="pt-3 text-right text-lg font-bold">
              {money(data.amount_cents, data.currency)}
            </td>
          </tr>
        </tfoot>
      </table>

      {data.fulfilled_at && (
        <p className="mb-6 text-xs text-muted-foreground">
          Paid {new Date(data.fulfilled_at).toLocaleString()}
          {data.stripe_payment_intent && ` · Ref ${data.stripe_payment_intent}`}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Thank you for your business. Questions? Contact support@warehousejobs.com.
      </p>

      <div className="mt-8 flex gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
        <Link
          to="/employer/billing"
          className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Back to billing
        </Link>
      </div>
    </div>
  );
}
