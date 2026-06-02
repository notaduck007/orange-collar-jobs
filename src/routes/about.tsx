import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Markdown } from "@/components/markdown";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — WarehouseJobs" }] }),
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
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="label-caps text-primary">Our story</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
          {page?.title ?? "About"}
        </h1>
        <div className="mt-8 text-base leading-relaxed text-foreground">
          <Markdown>{page?.body ?? ""}</Markdown>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
