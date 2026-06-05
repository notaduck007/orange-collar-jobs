import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
// TODO: replace hero image with real service-day photo
import missionHero from "@/assets/mission-hero.jpg";
import pillarGivingBack from "@/assets/mission-giving-back.jpg";
import pillarChangingLives from "@/assets/mission-changing-lives.jpg";
import pillarPhysicallyServing from "@/assets/mission-physically-serving.jpg";

const pillars = [
  {
    title: "Giving Back",
    body:
      "Every shipment we help move is a paycheck for a family. We reinvest in the neighborhoods our workers come from — food drives, back-to-school supplies, and a hand for folks getting back on their feet.",
    image: pillarGivingBack,
    alt: "Volunteers handing out boxes of food at a community drive.",
  },
  {
    title: "Changing Lives",
    body:
      "A steady job changes everything. We help people find honest work, build skills on the dock, and walk through doors they didn't know were open. One shift at a time, lives turn around.",
    image: pillarChangingLives,
    alt: "Close-up portrait of a warehouse worker smiling with pride on the job.",
  },
  {
    title: "Physically Serving",
    body:
      "We don't just write checks. We show up — boots on, sleeves rolled — building, hauling, cleaning, and serving meals right alongside the people we're here for. Real work for real neighbors.",
    image: pillarPhysicallyServing,
    alt: "A warehouse crew in work gloves building and lifting together at a service event.",
  },
];

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
          </div>
        </section>

        {/* THREE PILLARS */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6A00]">
              What this looks like
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
              Three ways we give back
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {pillars.map((p) => (
              <article
                key={p.title}
                className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[var(--shadow-card-hover)]"
              >
                {/* TODO: replace with real photo */}
                <img
                  src={p.image}
                  alt={p.alt}
                  width={800}
                  height={600}
                  loading="lazy"
                  className="h-48 w-full object-cover sm:h-56"
                />
                <div className="flex flex-1 flex-col border-t-2 border-primary p-6">
                  <h3 className="text-xl font-bold text-[color:var(--ink)]">
                    {p.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {p.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
