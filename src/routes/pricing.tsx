import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";

type Search = { checkout?: "success" | "cancelled" };

export const Route = createFileRoute("/pricing")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    checkout: s.checkout === "success" || s.checkout === "cancelled" ? s.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Posting Packages & Pricing — WarehouseJobs for Employers" },
      { name: "description", content: "Post warehouse jobs to qualified workers. Flat-rate packages, no contracts." },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { checkout } = Route.useSearch();
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    if (checkout === "cancelled") toast.info("Checkout cancelled. No charge was made.");
    if (checkout === "success") toast.success("Payment received! Credits will appear shortly.");
  }, [checkout]);

  const { data: packages = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages").select("*").eq("active", true).eq("kind", "posting").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleBuy(packageId: string) {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", role: "employer", next: "/pricing" } as never });
      return;
    }
    setBuyingId(packageId);
    const result = await startCheckout(packageId, "purchase");
    if (result?.error) {
      toast.error(result.error);
      setBuyingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="bg-[color:var(--ink)] py-16 text-white sm:py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="label-caps text-primary">For Employers</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Hire the dock, not the cubicle.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/70 sm:text-lg">
            Reach forklift operators, pickers, order selectors, and dock workers actively looking for work. Flat-rate packages — no contracts, no surprise fees.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {checkout === "cancelled" && (
          <div className="mb-6 rounded-md border border-border bg-muted p-4 text-sm">
            Checkout cancelled — you have not been charged. Pick a package below to try again.
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-3">
          {packages.map((p, idx) => {
            const popular = idx === 1;
            const loading = buyingId === p.id;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-7 ${
                  popular ? "border-primary shadow-[var(--shadow-orange)]" : "border-border shadow-[var(--shadow-card)]"
                }`}
              >
                {popular && (
                  <span className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-md bg-[color:var(--hazard)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink)]">
                    <Zap className="h-3 w-3" fill="currentColor" /> Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-[color:var(--ink)]">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <p className="mt-5 text-4xl font-bold text-[color:var(--ink)]">
                  ${(p.price_cents / 100).toFixed(0)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">one-time</span>
                </p>
                <ul className="mt-6 space-y-2.5 text-sm">
                  <Feature>{p.posting_count} job post{p.posting_count === 1 ? "" : "s"}</Feature>
                  <Feature>{p.duration_days}-day posting period</Feature>
                  {p.featured_count > 0 && <Feature>{p.featured_count} featured upgrade{p.featured_count === 1 ? "" : "s"}</Feature>}
                  <Feature>Applicant management dashboard</Feature>
                  <Feature>Weekly applicant report</Feature>
                </ul>
                <button
                  type="button"
                  disabled={loading || !!buyingId}
                  onClick={() => handleBuy(p.id)}
                  className={`mt-7 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
                    popular ? "btn-primary" : "border border-[color:var(--ink)] text-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-white"
                  }`}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Redirecting…" : user ? "Buy now" : "Get started"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-16 max-w-2xl text-center">
          <p className="label-caps">Volume hiring?</p>
          <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">Talk to us about an annual plan.</h2>
          <p className="mt-2 text-sm text-muted-foreground">Custom packages for staffing agencies and 3PLs running multi-site recruitment.</p>
          <Link to="/contact" className="btn-primary mt-5 inline-flex">Contact sales</Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-foreground">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success)]" strokeWidth={3} />
      <span>{children}</span>
    </li>
  );
}
