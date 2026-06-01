import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Forklift, Boxes, Truck, PackageCheck, ClipboardList, Warehouse, Search, MapPin, ArrowRight } from "lucide-react";
import heroImage from "@/assets/warehouse-hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { JobCard, type JobSummary } from "@/components/job-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/ad-slot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DockHire — Warehouse Jobs Hiring Now Near You" },
      { name: "description", content: "Forklift, picker/packer, shipping & receiving, and warehouse associate jobs across the U.S. Free for job seekers — apply in minutes." },
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

  const { data: featured = [] } = useQuery({
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

      {/* HERO */}
      <section className="relative overflow-hidden bg-[color:var(--ink)]">
        <img
          src={heroImage}
          alt="Forklift operator working in a modern distribution warehouse"
          width={1920}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--ink)]/95 via-[color:var(--ink)]/70 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="max-w-2xl">
            <p className="label-caps text-primary">Hiring Now • Boots on the Dock</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Warehouse jobs that pay <span className="text-primary">on time</span>, every time.
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
              Forklift, picker, packer, dock worker, order selector. Real openings from real distribution centers — search by ZIP and start working this week.
            </p>

            {/* SEARCH BAR */}
            <form onSubmit={submitSearch} className="mt-8 rounded-xl bg-white p-2 shadow-2xl sm:flex sm:items-stretch sm:gap-1">
              <div className="flex flex-1 items-center gap-2 px-3 py-2.5">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Job title or keyword"
                  className="w-full bg-transparent text-[color:var(--ink)] placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div className="mt-1 flex flex-1 items-center gap-2 border-t border-border px-3 py-2.5 sm:mt-0 sm:border-l sm:border-t-0">
                <MapPin className="h-5 w-5 shrink-0 text-muted-foreground" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, state, or ZIP"
                  className="w-full bg-transparent text-[color:var(--ink)] placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <button type="submit" className="btn-primary mt-1 w-full sm:mt-0 sm:w-auto sm:px-6">
                Search Jobs
              </button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/60">
              <span className="label-caps text-white/40">Popular:</span>
              {["Forklift Operator", "Picker / Packer", "2nd Shift", "Order Selector"].map((t) => (
                <button key={t} onClick={() => { setKeyword(t); navigate({ to: "/jobs", search: { q: t } as never }); }} className="hover:text-primary">
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
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
          <div className="grid gap-4 md:grid-cols-2">
            {featured.map((job) => <JobCard key={job.id} job={job} />)}
            {featured.length === 0 && <p className="text-sm text-muted-foreground">Loading featured jobs…</p>}
          </div>
        </div>
      </section>

      {/* EMPLOYER CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-[color:var(--charcoal)] p-8 text-white sm:p-12">
          <div className="hazard-stripes absolute left-0 top-0 h-2 w-full" />
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="label-caps text-[color:var(--hazard)]">For Employers</p>
              <h2 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
                Stop wasting weeks on the wrong applicants.
              </h2>
              <p className="mt-3 max-w-md text-white/70">
                DockHire reaches qualified warehouse workers — forklift-certified, ready to start, in your ZIP. Post in 4 minutes.
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
            </div>
            <ul className="grid grid-cols-2 gap-4 text-sm">
              {[
                ["4 min", "Avg. time to post"],
                ["18k+", "Active warehouse workers"],
                ["48 hrs", "Avg. first qualified applicant"],
                ["$99", "Single post — flat rate"],
              ].map(([num, label]) => (
                <li key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-2xl font-bold text-primary">{num}</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-white/60">{label}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
