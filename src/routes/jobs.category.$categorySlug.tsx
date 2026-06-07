import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JobCard, type JobSummary } from "@/components/job-card";
import { canonical } from "@/lib/seo";
import { fetchActiveCities, type CityEntry } from "@/lib/locations";

type CategoryInfo = {
  slug: string;
  name: string;
  description: string;
  intro: string;
};

const CATEGORIES: Record<string, CategoryInfo> = {
  "forklift-operator": {
    slug: "forklift-operator",
    name: "Forklift Operator",
    description:
      "Hiring forklift operators now. Browse open sit-down, reach, and stand-up forklift jobs across U.S. warehouses on WarehouseJobs.",
    intro:
      "Forklift operators keep the warehouse moving — loading and unloading trucks, staging pallets at the dock, and putting product away in racking. Day to day you'll be running a sit-down, stand-up, reach, or cherry picker truck, checking your equipment before each shift, and working closely with shipping, receiving, and inventory teams. Employers typically want a current OSHA forklift certification or are willing to certify the right person, plus a track record of working safely around foot traffic and tight aisles. Pay generally moves up with experience, equipment type, and shift — overnight and weekend shifts often pay a premium. Most postings are full-time with overtime available, though seasonal and temp-to-hire spots show up too. If you're certified and reliable, openings tend to fill quickly.",
  },
  "picker-packer": {
    slug: "picker-packer",
    name: "Picker / Packer",
    description:
      "Picker and packer jobs hiring now. Browse open warehouse pick-pack roles across the U.S. on WarehouseJobs.",
    intro:
      "Pickers and packers are the people who actually get orders out the door. You'll pull items from bins or racks using a scanner, paper pick list, or voice-pick headset, then pack them into boxes or totes, label, and stage for shipping. The work is steady and on your feet — expect to be walking miles per shift and lifting up to about 50 pounds. Most employers will train you on their warehouse management system, so prior experience helps but isn't always required. Pay is usually hourly with shift differentials for evenings, overnights, and weekends, and many sites offer weekly pay, attendance bonuses, or quick-hire programs. Roles range from short-term peak-season help to full-time with benefits.",
  },
  "shipping-receiving": {
    slug: "shipping-receiving",
    name: "Shipping & Receiving",
    description:
      "Shipping and receiving jobs hiring now. Browse open dock, loader, and inbound/outbound roles on WarehouseJobs.",
    intro:
      "Shipping and receiving clerks own the dock. On the inbound side you'll check trucks in, verify what arrived against the BOL or PO, inspect for damage, and route product to put-away. On the outbound side you'll stage outbound loads, build pallets, generate BOLs and labels, and work with carriers to get trucks out on time. Comfort with a handheld scanner, basic computer entry, and a WMS like SAP, Manhattan, or NetSuite is a plus. Many roles ask for a forklift or pallet jack certification — employers will often certify the right candidate. Pay is hourly and tends to be steady year-round; shift premiums apply for nights and weekends. Strong attention to detail and clear communication with drivers and the floor team go a long way here.",
  },
  "order-selector": {
    slug: "order-selector",
    name: "Order Selector",
    description:
      "Order selector jobs hiring now. Browse open grocery, retail, and distribution selector roles on WarehouseJobs.",
    intro:
      "Order selectors build store and customer orders in high-volume distribution centers — common in grocery, retail, foodservice, and e-commerce. You'll work from a voice-pick headset or RF scanner, pulling cases onto a pallet on an electric pallet jack, then shrink-wrapping and staging for shipping. It's physical work with real production standards: expect frequent lifting up to 50–60 pounds and steady movement throughout the shift. Many sites run in cooler or freezer environments and provide the gear. Employers typically train you on their pallet jack and pick system, and pay often includes an incentive or bonus tied to hitting rate and accuracy targets. Night and weekend shifts are common and usually pay a differential. Strong endurance and consistency get rewarded here.",
  },
  "inventory-clerk": {
    slug: "inventory-clerk",
    name: "Inventory Clerk",
    description:
      "Inventory clerk jobs hiring now. Browse open cycle count, inventory control, and audit roles on WarehouseJobs.",
    intro:
      "Inventory clerks keep the numbers honest. Day to day you'll run cycle counts, research variances, adjust quantities in the warehouse management system, and investigate why something shows in stock but isn't on the shelf. You'll work closely with receiving, shipping, and the floor leads to track damaged or misplaced product and keep locations accurate. Comfort with Excel and a WMS — SAP, Oracle, Manhattan, NetSuite, or similar — is usually expected, along with a careful, detail-oriented approach. Most roles are full-time on day or swing shifts and tend to be quieter than pick-pack or loading work, with steady year-round demand. Some employers prefer prior inventory or audit experience; others will train motivated candidates who have warehouse fundamentals down.",
  },
  "warehouse-associate": {
    slug: "warehouse-associate",
    name: "Warehouse Associate",
    description:
      "Warehouse associate jobs hiring now. Browse open general warehouse, material handler, and entry-level roles on WarehouseJobs.",
    intro:
      "Warehouse associate is the broad, get-it-done role at most distribution centers — a mix of receiving, put-away, picking, packing, loading, and general housekeeping. It's a strong entry point into warehouse work: many employers will train you on equipment like pallet jacks, scanners, and even forklift certification once you've shown up consistently. Expect to be on your feet the full shift, lifting up to 50 pounds, and rotating between tasks as the floor needs. Pay is hourly with shift differentials for nights and weekends, and many sites offer weekly pay, referral bonuses, and a clear path to lead and equipment-operator roles. Reliable attendance and a willingness to learn matter more than a long résumé here.",
  },
};

export const Route = createFileRoute("/jobs/category/$categorySlug")({
  loader: async ({ params }) => {
    const info = CATEGORIES[params.categorySlug];
    if (!info) throw notFound();
    const { data: jobsData } = await supabase
      .from("jobs")
      .select(
        "id, slug, title, location, shift, employment_type, pay_min, pay_max, featured, category, companies(name, slug, verified)",
      )
      .eq("category", info.name)
      .in("status", ["active", "published"])
      .order("created_at", { ascending: false })
      .limit(50);
    const jobs = (jobsData ?? []) as unknown as JobSummary[];
    const cities = (await fetchActiveCities(8)).slice(0, 8);
    return { info, jobs, cities };
  },
  head: ({ params, loaderData }) => {
    const info = loaderData?.info ?? CATEGORIES[params.categorySlug];
    const title = info
      ? `${info.name} Jobs — Hiring Now | WarehouseJobs`
      : "Warehouse Jobs | WarehouseJobs";
    const desc = info?.description ?? "Browse open warehouse jobs on WarehouseJobs.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        {
          property: "og:url",
          content: `https://warehousejobs.com/jobs/category/${params.categorySlug}`,
        },
      ],
      links: [
        {
          rel: "canonical",
          href: `https://warehousejobs.com/jobs/category/${params.categorySlug}`,
        },
      ],
    };
  },
  component: CategoryPage,
  errorComponent: ({ error }) => (
    <div className="p-12 text-center text-sm text-muted-foreground">
      Couldn't load category: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="p-12 text-center">
        <p className="text-lg font-semibold">Category not found</p>
        <Link to="/jobs" className="mt-2 inline-block text-primary hover:underline">
          Browse all jobs
        </Link>
      </div>
      <SiteFooter />
    </div>
  ),
});

function CategoryPage() {
  const { info, jobs } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 max-w-3xl">
          <p className="label-caps text-primary">Browse by role</p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--ink)] sm:text-4xl">
            {info.name} Jobs
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{info.intro}</p>
          <div className="mt-5">
            <Link
              to="/jobs"
              search={{ category: info.name } as never}
              className="text-sm font-semibold text-primary hover:underline"
            >
              View all jobs →
            </Link>
          </div>
        </header>

        {jobs.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No {info.name} openings right now — check back soon or{" "}
              <Link to="/jobs" className="text-primary hover:underline">
                browse all jobs
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {jobs.map((j: JobSummary) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
