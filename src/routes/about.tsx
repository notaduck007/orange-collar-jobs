import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — WarehouseJobs" }, { name: "description", content: "We built WarehouseJobs because warehouse hiring deserves better tools." }] }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="label-caps text-primary">Our story</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">Built for the dock.</h1>
        <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground">
          <p>WarehouseJobs started in a 220,000 sq ft fulfillment center outside Indianapolis. The shift supervisor was using a generic job board to hire forklift operators — and getting bartenders and software interns instead.</p>
          <p>We thought warehouse workers and the operations leaders that hire them deserved a tool that actually understood their world. Shift codes. Forklift certifications. ZIP-radius matching. Cold storage premiums. Weekend differentials. The things that matter on the floor.</p>
          <p>Today, WarehouseJobs connects thousands of warehouse workers with distribution centers, 3PLs, cold storage operators, and cross-docks across the U.S. — and we keep it free for the people doing the work.</p>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
