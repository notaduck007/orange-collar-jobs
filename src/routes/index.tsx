import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Forklift, Boxes, Truck, PackageCheck, ClipboardList, Warehouse, Search, MapPin, ArrowRight } from "lucide-react";
import heroImage from "@/assets/warehouse-hero.webp";
import crewImage from "@/assets/crew-productive.webp";
import workerMarcus from "@/assets/worker-marcus.webp";
import workerAisha from "@/assets/worker-aisha.webp";
import workerLuis from "@/assets/worker-luis.webp";
import { supabase } from "@/integrations/supabase/client";
import { JobCard, type JobSummary } from "@/components/job-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/ad-slot";
import { JobCardSkeletonList } from "@/components/ui/skeleton-list";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WarehouseJobs — Warehouse & Logistics Hiring" },
      { name: "description", content: "Forklift, picker/packer, shipping & receiving, and warehouse associate jobs across the U.S. Free for job seekers — apply in minutes on WarehouseJobs." },
      { property: "og:title", content: "WarehouseJobs — Warehouse & Logistics Hiring" },
      { property: "og:description", content: "Forklift, picker/packer, shipping & receiving, and warehouse associate jobs across the U.S." },
    ],
  }),
  component: Home,
});

const categories = [
  { name: "Forklift Operator", icon: Forklift },
  { name: "Picker / Packer", icon: Boxes },
  { name: "Shipping & Receiving", icon: Truck },
  { name: "Order Selector", icon: PackageCheck },
  { name: "Inventory Clerk", icon: ClipboardList },
  { name: "Warehouse Associate", icon: Warehouse },
];

function Home() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");

  const { data: featured = [], isLoading: featuredLoading } = useQuery({
    queryKey: ["featured-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, slug, title, location, shift, employment_type, pay_min, pay_max, featured, category, companies(name, slug)")
        .eq("status", "published")
        .eq("featured", true)
        .limit(4);
      if (error) throw error;
      return (data ?? []) as unknown as JobSummary[];
    },
  });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/jobs", search: { q: keyword || undefined, loc: location || undefined } as never });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main">

      {/* HERO */}
      <section className="relative overflow-hidden bg-[color:var(--ink)]" aria-labelledby="hero-heading">
        <img
          src={heroImage}
          alt="Diverse, happy warehouse crew in hi-vis vests on a loading dock at sunrise, giving a thumbs-up after a successful shift."
          width={1920}
          height={1280}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--ink)]/95 via-[color:var(--ink)]/70 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="max-w-2xl">
            <p className="label-caps text-primary">Hiring Now • Boots on the Dock</p>
            <h1 id="hero-heading" className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Warehouse jobs that pay <span className="text-primary">on time</span>, every time.
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
              Forklift, picker, packer, dock worker, order selector. Real openings from real distribution centers — search by ZIP and start working this week.
            </p>

            {/* SEARCH BAR */}
            <form onSubmit={submitSearch} role="search" aria-label="Search warehouse jobs" className="mt-8 rounded-xl bg-white p-2 shadow-2xl sm:flex sm:items-stretch sm:gap-1">
              <div className="flex flex-1 items-center gap-2 px-3 py-2.5">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="hero-keyword" className="sr-only">Job title or keyword</label>
                <input
                  id="hero-keyword"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Job title or keyword"
                  className="w-full bg-transparent text-[color:var(--ink)] placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                />
              </div>
              <div className="mt-1 flex flex-1 items-center gap-2 border-t border-border px-3 py-2.5 sm:mt-0 sm:border-l sm:border-t-0">
                <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <label htmlFor="hero-location" className="sr-only">Location (city, state, or ZIP)</label>
                <input
                  id="hero-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, state, or ZIP"
                  className="w-full bg-transparent text-[color:var(--ink)] placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                />
              </div>
              <button type="submit" className="btn-primary mt-1 w-full sm:mt-0 sm:w-auto sm:px-6">
                Search Jobs
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/70">
              <span className="label-caps text-white/60">Popular:</span>
              {["Forklift Operator", "Picker / Packer", "2nd Shift", "Order Selector"].map((t) => (
                <button key={t} onClick={() => { setKeyword(t); navigate({ to: "/jobs", search: { q: t } as never }); }} className="rounded hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOME BANNER AD */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6">
        <AdSlot slot="home_banner" />
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">

        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="label-caps">Browse by role</p>
            <h2 className="mt-1 text-2xl font-bold text-[color:var(--ink)] sm:text-3xl">What kind of work?</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map(({ name, icon: Icon }) => (
            <Link
              key={name}
              to="/jobs"
              search={{ category: name } as never}
              className="group flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[var(--shadow-card-hover)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[color:var(--primary-tint)] text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-[color:var(--ink)]">{name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* REAL PEOPLE BAND */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 max-w-2xl">
            <p className="label-caps text-primary">Real people, real shifts</p>
            <h2 className="mt-1 text-2xl font-bold text-[color:var(--ink)] sm:text-3xl">The crew behind every shipment</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pickers, packers, forklift operators, dock leads — folks getting hired through WarehouseJobs this month.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              { src: workerMarcus, name: "Marcus", role: "Forklift Operator", alt: "Marcus, a smiling Black forklift operator in an orange hi-vis vest, holding his hard hat in front of a warehouse forklift." },
              { src: workerAisha, name: "Aisha", role: "Picker / Packer", alt: "Aisha, a young Black woman picker-packer laughing while scanning a package in a warehouse pick aisle." },
              { src: workerLuis, name: "Luis", role: "Shipping & Receiving Lead", alt: "Luis, a Latino shipping and receiving lead in a hard hat and orange vest, holding a clipboard at an open loading dock." },
            ].map((p) => (
              <figure key={p.name} className="group overflow-hidden rounded-xl border border-border bg-background">
                <div className="aspect-[4/5] overflow-hidden">
                  <img
                    src={p.src}
                    alt={p.alt}
                    width={800}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <figcaption className="border-t border-border px-4 py-3">
                  <p className="text-sm font-semibold text-[color:var(--ink)]">{p.name} — <span className="font-normal text-muted-foreground">{p.role}</span></p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED */}
      <section className="bg-[color:var(--primary-tint)]/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="label-caps text-primary">Featured Listings</p>
              <h2 className="mt-1 text-2xl font-bold text-[color:var(--ink)] sm:text-3xl">Jobs hiring this week</h2>
            </div>
            <Link to="/jobs" className="hidden items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {featuredLoading ? (
            <JobCardSkeletonList count={4} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {featured.map((job) => <JobCard key={job.id} job={job} />)}
              {featured.length === 0 && <p className="text-sm text-muted-foreground">No featured jobs right now.</p>}
            </div>
          )}
        </div>
      </section>

      {/* EMPLOYER CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-[color:var(--charcoal)] text-white">
          <div className="hazard-stripes absolute left-0 top-0 z-10 h-2 w-full" />
          <div className="grid items-stretch md:grid-cols-2">
            <div className="relative min-h-[280px] md:min-h-full">
              <img
                src={crewImage}
                alt="Productive warehouse crew of four diverse workers collaborating at a pick station inside a modern fulfillment center."
                width={1600}
                height={1067}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[color:var(--charcoal)]/60 md:to-[color:var(--charcoal)]" />
            </div>
            <div className="p-8 sm:p-12">
              <p className="label-caps text-[color:var(--hazard)]">For Employers</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
                Stop wasting weeks on the wrong applicants.
              </h2>
              <p className="mt-3 max-w-md text-white/70">
                WarehouseJobs reaches qualified warehouse workers — forklift-certified, ready to start, in your ZIP. Post in 4 minutes.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/pricing">
                  <Button className="btn-primary">See Pricing</Button>
                </Link>
                <Link to="/contact">
                  <Button variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    Talk to Sales
                  </Button>
                </Link>
              </div>
              <ul className="mt-8 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["4 min", "Avg. time to post"],
                  ["18k+", "Active warehouse workers"],
                  ["48 hrs", "Avg. first qualified applicant"],
                  ["$99", "Single post — flat rate"],
                ].map(([num, label]) => (
                  <li key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                    <p className="text-xl font-bold text-primary">{num}</p>
                    <p className="mt-0.5 text-[11px] uppercase tracking-wider text-white/60">{label}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      </main>
      <SiteFooter />
    </div>
  );
}
