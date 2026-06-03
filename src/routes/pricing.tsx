import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Zap, Loader2, Gift, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";
import { useSiteSettings } from "@/lib/site-settings";
import { startCheckout } from "@/lib/checkout";
import crewImage from "@/assets/crew-productive.webp";

type Search = { checkout?: "success" | "cancelled" };

export const Route = createFileRoute("/pricing")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    checkout: s.checkout === "success" || s.checkout === "cancelled" ? s.checkout : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Posting Packages & Pricing — WarehouseJobs for Employers" },
      {
        name: "description",
        content: "Post warehouse jobs to qualified workers. Flat-rate packages, no contracts.",
      },
    ],
  }),
  component: Pricing,
});

function Pricing() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const supportEmail = settings.branding.support_email;
  const navigate = useNavigate();
  const { checkout } = Route.useSearch();
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    if (checkout === "cancelled") toast.info("Checkout cancelled. No charge was made.");
  }, [checkout]);

  const { data: packages = [] } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("active", true)
        .eq("kind", "posting")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Whether to show the "first post is free" banner: logged-out, or logged-in
  // employer whose active package still has an untouched free post.
  const { data: freeAvailable = false } = useQuery({
    queryKey: ["pricing-free-available", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_packages")
        .select("posts_total, posts_used, expires_at, status")
        .eq("status", "active")
        .eq("posts_used", 0)
        .gt("posts_total", 0)
        .gt("expires_at", new Date().toISOString())
        .limit(1);
      return (data ?? []).length > 0;
    },
  });
  const showFreeBanner = !user || freeAvailable;

  async function handleBuy(packageId: string) {
    if (!user) {
      navigate({
        to: "/auth",
        search: { mode: "signup", role: "employer", next: "/pricing" } as never,
      });
      return;
    }
    setBuyingId(packageId);

    // Check whether the user has a company before starting checkout.
    const { data: owned } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();
    let hasCompany = !!owned?.id;
    if (!hasCompany) {
      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("role", ["owner", "admin"])
        .limit(1)
        .maybeSingle();
      hasCompany = !!membership?.company_id;
    }

    if (!hasCompany) {
      toast.info("Set up your company first to purchase a package.");
      navigate({
        to: "/employer/onboarding",
        search: { pkg: packageId } as never,
      });
      setBuyingId(null);
      return;
    }

    const result = await startCheckout(packageId, "purchase");
    if (result?.error) {
      if (result.code === "no_company" || /no company/i.test(result.error)) {
        toast.info("Set up your company first to purchase a package.");
        navigate({
          to: "/employer/onboarding",
          search: { pkg: packageId } as never,
        });
      } else {
        toast.error(result.error);
      }
      setBuyingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="relative overflow-hidden bg-[color:var(--ink)] py-16 text-white sm:py-20">
        <img
          src={crewImage}
          alt="Skilled warehouse crew — four diverse workers in hi-vis vests collaborating at a conveyor pick station inside a modern fulfillment center."
          width={1600}
          height={1067}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[color:var(--ink)]/80 via-[color:var(--ink)]/85 to-[color:var(--ink)]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <p className="label-caps text-primary">For Employers</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Hire the dock, not the cubicle.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/70 sm:text-lg">
            Reach forklift operators, pickers, order selectors, and dock workers actively looking
            for work. Flat-rate packages — no contracts, no surprise fees.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {checkout === "cancelled" && (
          <div className="mb-6 rounded-md border border-border bg-muted p-4 text-sm">
            Checkout cancelled — you have not been charged. Pick a package below to try again.
          </div>
        )}

        {showFreeBanner && (
          <div className="mb-10 overflow-hidden rounded-2xl border border-primary/40 bg-[color:var(--primary-tint)]/60 p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-orange)]">
                  <Gift className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="label-caps text-primary">New here?</p>
                  <p className="mt-1 text-xl font-bold text-[color:var(--ink)] sm:text-2xl">
                    Your first job post is on us — no card required.
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Every new employer gets a free Starter post (30-day listing). Use it before you
                    buy a package.
                  </p>
                </div>
              </div>
              {user ? (
                <Link to="/employer/jobs/new" className="btn-primary inline-flex items-center gap-1.5">
                  Post your free job <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/auth"
                  search={{ mode: "signup", role: "employer", next: "/employer" } as never}
                  className="btn-primary inline-flex items-center gap-1.5"
                >
                  Get my free post <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          <p className="label-caps">Need more?</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--ink)] sm:text-3xl">
            Pick a package.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {packages.map((p, idx) => {
            const popular = idx === 1;
            const loading = buyingId === p.id;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border bg-card p-7 ${
                  popular
                    ? "border-primary shadow-[var(--shadow-orange)]"
                    : "border-border shadow-[var(--shadow-card)]"
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
                  <Feature>
                    {p.posting_count} job post{p.posting_count === 1 ? "" : "s"}
                  </Feature>
                  <Feature>{p.duration_days}-day posting period</Feature>
                  {p.featured_count > 0 && (
                    <Feature>
                      {p.featured_count} featured upgrade{p.featured_count === 1 ? "" : "s"}
                    </Feature>
                  )}
                  <Feature>Applicant management dashboard</Feature>
                  <Feature>Weekly applicant report</Feature>
                </ul>
                <button
                  type="button"
                  disabled={loading || !!buyingId}
                  onClick={() => handleBuy(p.id)}
                  className={`mt-7 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${
                    popular
                      ? "btn-primary"
                      : "border border-[color:var(--ink)] text-[color:var(--ink)] hover:bg-[color:var(--ink)] hover:text-white"
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
          <h2 className="mt-2 text-2xl font-bold text-[color:var(--ink)]">
            Talk to us about an annual plan.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Custom packages for staffing agencies and 3PLs running multi-site recruitment.
          </p>
          <Link to="/contact" className="btn-primary mt-5 inline-flex">
            Contact sales
          </Link>
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
