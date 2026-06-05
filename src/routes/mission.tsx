import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
{/* TODO: replace hero image with real service-day photo */}
import missionHero from "@/assets/mission-hero.jpg";

export const Route = createFileRoute("/mission")({
  head: () => ({
    meta: [
      { title: "Our Mission — WarehouseJobs" },
      {
        name: "description",
        content:
          "Warehouse work built this company. Giving back, changing lives, and physically serving the communities that carry us is who we are.",
      },
      { property: "og:title", content: "Our Mission — WarehouseJobs" },
      {
        property: "og:description",
        content:
          "Warehouse work built this company. Giving back, changing lives, and physically serving the communities that carry us is who we are.",
      },
    ],
  }),
  component: MissionPage,
});

function MissionPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main">
        <section
          className="relative overflow-hidden"
          aria-labelledby="mission-heading"
        >
          {/* TODO: replace hero image with real service-day photo */}
          <img
            src={missionHero}
            alt="WarehouseJobs crew volunteering together at a community service day, loading boxes of donated goods."
            width={1920}
            height={1024}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/75"
          />
          <div className="relative mx-auto max-w-5xl px-4 py-24 sm:px-6 sm:py-32 lg:py-40">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6A00]">
              Our Mission
            </p>
            <h1
              id="mission-heading"
              className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              We don't just fill shifts. We show up.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-white/85 sm:text-xl">
              Warehouse work built this company — so we put our backs into the
              communities that carry us. Giving back, changing lives, and
              physically serving the people around us isn't a program. It's who
              we are.
            </p>
            <p className="mt-6 text-sm font-bold text-[#FF6A00] sm:text-base">
              Giving back · Changing lives · Physically serving
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
