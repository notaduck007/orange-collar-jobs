import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const Route = createFileRoute("/faq")({
  head: () => ({ meta: [{ title: "FAQ — WarehouseJobs" }] }),
  component: FAQ,
});

const faqs = [
  { q: "Is WarehouseJobs really free for job seekers?", a: "Yes. Searching, saving, and applying to jobs is 100% free, with no resume paywalls or premium tiers." },
  { q: "Do I need a resume to apply?", a: "No — many of our employers accept a quick application without a resume. You can also upload a PDF in your profile if you have one." },
  { q: "How quickly will I hear back?", a: "Most employers reach out within 48 hours on featured listings. Standard listings average 3–5 business days." },
  { q: "What does it cost to post a job?", a: "Single posts start at $99 for 30 days. The 5-Pack ($399) drops the per-post rate and includes a featured upgrade. See the Pricing page for details." },
  { q: "Can I edit a job after it's posted?", a: "Yes — employers can update any field on a live posting from their dashboard. Featured upgrades stay active for the full term." },
  { q: "Do you screen applicants?", a: "We don't gate applications, but our application form captures shift availability, forklift certifications, and right-to-work confirmation so you're never reviewing blind." },
  { q: "Do you support staffing agencies and 3PLs?", a: "Absolutely. Many of our largest customers run multi-site recruitment through WarehouseJobs. Contact sales for a custom plan." },
];

function FAQ() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <p className="label-caps text-primary">Frequently asked</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--ink)]">Questions, answered.</h1>
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold text-[color:var(--ink)]">{f.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      <SiteFooter />
    </div>
  );
}
