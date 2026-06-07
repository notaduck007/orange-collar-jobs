import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JobCard, type JobSummary } from "@/components/job-card";
import { parseCitySlug } from "@/lib/locations";

const CATEGORY_LINKS = [
  { name: "Forklift Operator", slug: "forklift-operator" },
  { name: "Picker / Packer", slug: "picker-packer" },
  { name: "Shipping & Receiving", slug: "shipping-receiving" },
  { name: "Order Selector", slug: "order-selector" },
  { name: "Inventory Clerk", slug: "inventory-clerk" },
  { name: "Warehouse Associate", slug: "warehouse-associate" },
];

export const Route = createFileRoute("/warehouse-jobs/$citySlug")({
  loader: async ({ params }) => {
    const parsed = parseCitySlug(params.citySlug);
    const city = parsed?.city ?? "";
    const state = parsed?.state ?? "";
    let jobs: JobSummary[] = [];
    if (parsed) {
      const { data: jobsData } = await supabase
        .from("jobs")
        .select(
          "id, slug, title, location, shift, employment_type, pay_min, pay_max, featured, category, city, state, companies(name, slug, verified)",
        )
        .ilike("city", city)
        .ilike("state", state)
        .in("status", ["active", "published"])
        .order("created_at", { ascending: false })
        .limit(50);
      jobs = (jobsData ?? []) as unknown as JobSummary[];
    }
    return { city, state, jobs };
  },
  head: ({ params, loaderData }) => {
    const city = loaderData?.city || "";
    const state = loaderData?.state || "";
    const titleLoc = city && state ? `${city}, ${state}` : "Your City";
    const title = `Warehouse Jobs in ${titleLoc} — Hiring Now | WarehouseJobs`;
    const desc =
      city && state
        ? `Open warehouse jobs in ${city}, ${state} — forklift, picker/packer, shipping & receiving, and more. Apply on WarehouseJobs.`
        : "Browse open warehouse jobs by city on WarehouseJobs.";
    const url = `https://warehousejobs.com/warehouse-jobs/${params.citySlug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: LocationPage,
  errorComponent: ({ error }) => (
    <div className="p-12 text-center text-sm text-muted-foreground">
      Couldn't load location: {error.message}
    </div>
  ),
});

function LocationPage() {
  const { city, state, jobs } = Route.useLoaderData();
  const loc = city && state ? `${city}, ${state}` : "Your City";
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 max-w-3xl">
          <p className="label-caps text-primary">Browse by city</p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--ink)] sm:text-4xl">
            Warehouse Jobs in {loc}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Distribution centers and fulfillment warehouses in and around {loc} hire steadily for
            the core warehouse roles — forklift operators, pickers and packers, shipping and
            receiving clerks, order selectors, inventory clerks, and general warehouse associates.
            Shifts vary by site: many employers run 1st, 2nd, and 3rd shift plus weekend schedules,
            and overtime is common during peak season. Some roles need an OSHA forklift
            certification or prior WMS experience; many entry-level spots will train the right
            person. New openings are posted regularly as employers expand crews and replace
            turnover, so it's worth checking back. Use the list below to apply directly, or browse
            by role if you already know the kind of work you want.
          </p>
          <div className="mt-5">
            <Link to="/jobs" className="text-sm font-semibold text-primary hover:underline">
              View all jobs →
            </Link>
          </div>
        </header>

        {jobs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No openings in {loc} right now. Try{" "}
              <Link to="/jobs" className="text-primary hover:underline">
                all jobs
              </Link>
              {" "}or browse by role below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {jobs.map((j: JobSummary) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}

        <section className="mt-12 border-t border-border pt-6">
          <p className="label-caps text-muted-foreground">Browse by role</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORY_LINKS.map((c) => (
              <Link
                key={c.slug}
                to="/jobs/category/$categorySlug"
                params={{ categorySlug: c.slug }}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-[color:var(--ink)] hover:border-primary/60 hover:text-primary"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
