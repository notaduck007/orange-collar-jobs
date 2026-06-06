import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Markdown } from "@/components/markdown";
import warehouseHero from "@/assets/warehouse-hero.jpg";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: "FAQ — WarehouseJobs.com" }] }),
  component: FAQ,
});

function FAQ() {
  const { data: page } = useQuery({
    queryKey: ["site-page", "faq"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_pages")
        .select("title, body")
        .eq("slug", "faq")
        .eq("published", true)
        .maybeSingle();
      return data;
    },
  });
  const { data: faqs = [] } = useQuery({
    queryKey: ["faq-items"],
    queryFn: async () => {
      const { data } = await supabase
        .from("faq_items")
        .select("id, question, answer")
        .eq("published", true)
        .order("sort_order")
        .order("created_at");
      return data ?? [];
    },
  });
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="relative w-full overflow-hidden py-16 sm:py-20">
        <img
          src={warehouseHero}
          alt="Wide view of a modern warehouse aisle with tall racking and workers in hi-vis vests."
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
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl">
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
