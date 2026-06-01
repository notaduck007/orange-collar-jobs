import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Clock, DollarSign, Building2, ArrowLeft, Bookmark, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ApplyDialog } from "@/components/apply-dialog";
import { AdSlot } from "@/components/ad-slot";

export const Route = createFileRoute("/jobs/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("jobs")
      .select("title, description, location, category, companies(name)")
      .eq("slug", params.slug)
      .maybeSingle();
    return { meta: data };
  },
  head: ({ params, loaderData }) => {
    const m = loaderData?.meta as
      | { title: string; description: string; location: string; category: string; companies: { name?: string } | null }
      | null
      | undefined;
    const company = m?.companies?.name;
    const title = m
      ? `${m.title}${company ? ` at ${company}` : ""} — ${m.location} | DockHire`
      : "Warehouse Job | DockHire";
    const desc = m
      ? ((m.description ?? "").slice(0, 155).replace(/\s+/g, " ").trim() ||
        `${m.category} role in ${m.location}. Apply on DockHire.`)
      : "Apply to warehouse jobs near you on DockHire.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/jobs/${params.slug}` },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `/jobs/${params.slug}` }],
      scripts: m
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "JobPosting",
                title: m.title,
                description: m.description,
                jobLocation: { "@type": "Place", address: m.location },
                hiringOrganization: company ? { "@type": "Organization", name: company } : undefined,
              }),
            },
          ]
        : undefined,
    };
  },
  component: JobDetail,
  errorComponent: ({ error }) => (
    <div className="p-12 text-center text-sm text-muted-foreground">Couldn't load job: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-lg font-semibold">Job not found</p>
      <Link to="/jobs" className="mt-2 inline-block text-primary hover:underline">Back to search</Link>
    </div>
  ),
});

const shiftLabel: Record<string, string> = { first: "1st Shift", second: "2nd Shift", third: "3rd Shift", weekend: "Weekend", flexible: "Flexible" };
const typeLabel: Record<string, string> = { full_time: "Full-time", part_time: "Part-time", temp: "Temp", temp_to_hire: "Temp-to-Hire", seasonal: "Seasonal", contract: "Contract" };

function JobDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ["job", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, companies(id, name, slug, description, location, website)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const apply = () => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login", next: `/jobs/${slug}` } as never });
      return;
    }
    setApplyOpen(true);
  };

  const save = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login", next: `/jobs/${slug}` } as never });
      return;
    }
    const { error } = await supabase.from("saved_jobs").insert({ user_id: user.id, job_id: job!.id });
    if (error && error.code !== "23505") toast.error(error.message);
    else toast.success("Saved to your list.");
  };

  if (isLoading) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!job) return null;
  const pay = job.pay_min && job.pay_max ? `$${job.pay_min}–$${job.pay_max} / ${job.pay_period ?? "hour"}` : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
        <main>
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label-caps text-primary">{job.category} • {shiftLabel[job.shift]}</p>
                <h1 className="mt-2 text-3xl font-bold leading-tight text-[color:var(--ink)] sm:text-4xl">{job.title}</h1>
                {job.companies && (
                  <Link to="/jobs" search={{ q: job.companies.name } as never} className="mt-2 inline-flex items-center gap-1.5 text-base font-medium text-foreground hover:text-primary">
                    <Building2 className="h-4 w-4" /> {job.companies.name}
                  </Link>
                )}
              </div>
              {job.featured && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--hazard)] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[color:var(--ink)]">
                  Featured
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-3">
              <Meta icon={MapPin} label="Location" value={job.location} />
              <Meta icon={Clock} label="Type" value={typeLabel[job.employment_type]} />
              {pay && <Meta icon={DollarSign} label="Pay" value={pay} />}
            </div>

            <section className="mt-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--ink)]">Job description</h2>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{job.description}</p>
              </div>
              {job.requirements && (
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--ink)]">Requirements</h2>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">{job.requirements}</p>
                </div>
              )}
            </section>

            <div className="mt-8 flex flex-wrap gap-2">
              <Button onClick={apply} className="btn-primary !px-6">Apply now</Button>
              <Button variant="outline" onClick={save} className="gap-1.5"><Bookmark className="h-4 w-4" /> Save</Button>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }} className="gap-1.5">
                <Share2 className="h-4 w-4" /> Share
              </Button>
            </div>
          </div>
        </main>

        <aside className="space-y-4">
          {job.companies && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="label-caps">About the employer</p>
              <p className="mt-2 text-base font-semibold text-[color:var(--ink)]">{job.companies.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{job.companies.location}</p>
              {job.companies.description && (
                <p className="mt-3 text-sm leading-relaxed text-foreground">{job.companies.description}</p>
              )}
            </div>
          )}

          <AdSlot slot="job_sidebar" />

          <Link to="/pricing" className="block overflow-hidden rounded-xl border border-border bg-card p-5">
            <div className="hazard-stripes mb-3 h-1.5 w-12 rounded-sm" />
            <p className="text-sm font-semibold leading-snug text-[color:var(--ink)]">Hiring? Get this same placement for your jobs.</p>
            <p className="mt-1 text-xs text-muted-foreground">Featured upgrades start at $39 per post.</p>
            <p className="mt-3 text-xs font-semibold text-primary">See packages →</p>
          </Link>
        </aside>
      </div>

      <SiteFooter />

      {job && (
        <ApplyDialog
          jobId={job.id}
          jobTitle={job.title}
          open={applyOpen}
          onOpenChange={setApplyOpen}
        />
      )}
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div>
      <p className="label-caps flex items-center gap-1 text-[10px]"><Icon className="h-3 w-3" /> {label}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">{value}</p>
    </div>
  );
}
