import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Markdown } from "@/components/markdown";
import { canonical } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  loader: async () => {
    const { data } = await supabase
      .from("site_pages")
      .select("title, body, meta_description")
      .eq("slug", "privacy")
      .eq("published", true)
      .maybeSingle();
    return { page: data ?? null };
  },
  head: () => ({
    meta: [
      { title: "Privacy Policy — WarehouseJobs.com" },
      {
        name: "description",
        content: "How WarehouseJobs collects, uses, and protects your information.",
      },
    ],
    links: [{ rel: "canonical", href: canonical("/privacy") }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { page } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="label-caps text-primary">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
          {page?.title ?? "Privacy Policy"}
        </h1>
        <div className="mt-8 text-base leading-relaxed text-foreground">
          <Markdown>{page?.body ?? ""}</Markdown>
        </div>
      </article>
      <SiteFooter />
    </div>
  );
}
