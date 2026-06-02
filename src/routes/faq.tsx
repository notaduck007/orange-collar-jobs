import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Markdown } from "@/components/markdown";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: "FAQ — WarehouseJobs" }] }),
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
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="label-caps text-primary">Frequently asked</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--ink)]">
          {page?.title ?? "Questions, answered."}
        </h1>
        {page?.body && (
          <div className="mt-4 text-base text-muted-foreground">
            <Markdown>{page.body}</Markdown>
          </div>
        )}
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((f) => (
            <AccordionItem key={f.id} value={f.id}>
              <AccordionTrigger className="text-left text-base font-semibold text-[color:var(--ink)]">{f.question}</AccordionTrigger>
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
