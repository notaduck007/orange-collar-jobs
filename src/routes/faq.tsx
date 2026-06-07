import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Markdown } from "@/components/markdown";
import faqHero from "@/assets/faq-hero.jpg";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { canonical } from "@/lib/seo";

export const Route = createFileRoute("/faq")({
  loader: async () => {
    const [pageRes, faqsRes] = await Promise.all([
      supabase
        .from("site_pages")
        .select("title, body")
        .eq("slug", "faq")
        .eq("published", true)
        .maybeSingle(),
      supabase
        .from("faq_items")
        .select("id, question, answer")
        .eq("published", true)
        .order("sort_order")
        .order("created_at"),
    ]);
    return { page: pageRes.data ?? null, faqs: faqsRes.data ?? [] };
  },
  head: () => ({
    meta: [
      { title: "FAQ — WarehouseJobs.com" },
      {
        name: "description",
        content:
          "Answers to common questions about finding warehouse jobs, applying, job alerts, and posting jobs on WarehouseJobs.",
      },
    ],
    links: [{ rel: "canonical", href: canonical("/faq") }],
  }),
  component: FAQ,
});

function FAQ() {
  const { page, faqs } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="relative w-full overflow-hidden py-24 sm:py-32 lg:py-40">
        <img
          src={faqHero}
          alt="A shift supervisor answers a new warehouse worker's questions in a bright break area."
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
            Frequently asked
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl lg:text-6xl">
            {page?.title ?? "Questions, answered."}
          </h1>
          {page?.body && (
            <div className="mx-auto mt-4 max-w-2xl text-base text-white/90 sm:text-lg">
              <Markdown>{page.body}</Markdown>
            </div>
          )}
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Accordion type="single" collapsible>
          {faqs.map((f) => (
            <AccordionItem key={f.id} value={f.id}>
              <AccordionTrigger className="text-left text-base font-semibold text-[color:var(--ink)]">
                {f.question}
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-foreground">
                <Markdown>{f.answer}</Markdown>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {faqs.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">No FAQ items published yet.</p>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
