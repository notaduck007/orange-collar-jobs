import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Markdown } from "@/components/markdown";
import warehouseHero from "@/assets/warehouse-hero.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — WarehouseJobs.com" }] }),
  component: About,
});

function About() {
  const { data: page } = useQuery({
    queryKey: ["site-page", "about"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_pages")
        .select("title, body, meta_description")
        .eq("slug", "about")
        .eq("published", true)
        .maybeSingle();
      return data;
    },
  });
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="relative w-full overflow-hidden py-16 sm:py-20">
        <img
          src={warehouseHero}
          alt="Workers in hi-vis vests moving pallets through a bright modern warehouse aisle lined with tall racking."
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
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl">
            {page?.title ?? "About"}
          </h1>
        </div>
      </section>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="text-base leading-relaxed text-foreground">
          <Markdown>{page?.body ?? ""}</Markdown>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
