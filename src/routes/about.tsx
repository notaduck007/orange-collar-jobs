import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Markdown } from "@/components/markdown";
import aboutHero from "@/assets/about-hero.jpg";
import { canonical } from "@/lib/seo";
import { DEFAULT_ABOUT_PAGE } from "@/lib/content/default-site-pages";

type AboutPageContent = {
  title: string;
  body: string;
  meta_description: string | null;
};

export const Route = createFileRoute("/about")({
  loader: async (): Promise<{ page: AboutPageContent }> => {
    const { data } = await supabase
      .from("site_pages")
      .select("title, body, meta_description")
      .eq("slug", "about")
      .eq("published", true)
      .maybeSingle();
    if (data?.body?.trim()) {
      return { page: data as AboutPageContent };
    }
    return { page: DEFAULT_ABOUT_PAGE };
  },
  head: () => ({
    meta: [
      { title: "About — WarehouseJobs.com" },
      {
        name: "description",
        content:
          "WarehouseJobs is a job board dedicated to warehouse and logistics work — forklift, picking, packing, shipping and receiving roles across the U.S.",
      },
    ],
    links: [{ rel: "canonical", href: canonical("/about") }],
  }),
  component: About,
});

function About() {
  const { page } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="relative w-full overflow-hidden py-24 sm:py-32 lg:py-40">
        <img
          src={aboutHero}
          alt="Sunrise at a distribution center as a warehouse worker in a hi-vis vest arrives for the morning shift."
          width={1920}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/75"
        />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6A00]">
            Our story
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl lg:text-6xl">
            {page.title}
          </h1>
        </div>
      </section>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="text-base leading-relaxed text-foreground">
          <Markdown>{page.body}</Markdown>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
