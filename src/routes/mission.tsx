import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/mission")({
  head: () => ({
    meta: [
      { title: "Our Mission — WarehouseJobs" },
      {
        name: "description",
        content: "Our mission at WarehouseJobs.",
      },
      { property: "og:title", content: "Our Mission — WarehouseJobs" },
      { property: "og:description", content: "Our mission at WarehouseJobs." },
    ],
  }),
  component: MissionPage,
});

function MissionPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="label-caps text-primary">Our mission</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--ink)]">
          Our Mission
        </h1>
      </main>
      <SiteFooter />
    </div>
  );
}
