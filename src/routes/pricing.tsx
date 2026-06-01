import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Posting Packages & Pricing — WarehouseJobs for Employers" },
      { name: "description", content: "Post warehouse jobs to qualified workers. Flat-rate packages, no contracts." },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const { data: packages = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posting_packages")
        .select("*")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

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
        <div className="grid gap-6 md:grid-cols-3">
          {packages.map((p, idx) => {
            const popular = idx === 1;
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
                  <Feature>{p.post_credits} job post{p.post_credits === 1 ? "" : "s"}</Feature>
                  <Feature>{p.duration_days}-day posting period</Feature>
                  {p.featured_credits > 0 && <Feature>{p.featured_credits} featured upgrade{p.featured_credits === 1 ? "" : "s"}</Feature>}
                  <Feature>Applicant management dashboard</Feature>
                  <Feature>Weekly applicant report</Feature>
                </ul>
                <Link
                  to="/auth"
                  search={{ mode: "signup", role: "employer" } as never}
                  className={`mt-7 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold ${
                    popular ? "btn-primary" : "border border-[color:var(--ink)] text-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-white"
                  }`}
                >
                  Get started
                </Link>
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
