import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, Globe, MapPin, ArrowLeft, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JobCard, type JobSummary } from "@/components/job-card";
import { ReportButton } from "@/components/report-button";
import { CompanyProfileSkeleton } from "@/components/ui/skeleton-list";

export const Route = createFileRoute("/companies/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("companies")
      .select("name, description, location, logo_url")
      .eq("slug", params.slug)
      .maybeSingle();
    return { meta: data };
  },
  head: ({ params, loaderData }) => {
    const m = loaderData?.meta as { name: string; description: string | null; location: string | null } | null | undefined;
    const title = m ? `${m.name} — Warehouse jobs | WarehouseJobs` : "Company | WarehouseJobs";
    const desc = m
      ? ((m.description ?? "").slice(0, 155).replace(/\s+/g, " ").trim() ||
        `Open warehouse roles at ${m.name}${m.location ? ` in ${m.location}` : ""}.`)
      : "View open warehouse roles by employer.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
      links: [{ rel: "canonical", href: `/companies/${params.slug}` }],
    };
  },
  component: CompanyProfile,
  errorComponent: ({ error }) => (
    <div className="p-12 text-center text-sm text-muted-foreground">Couldn't load company: {error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-lg font-semibold">Company not found</p>
      <Link to="/jobs" className="mt-2 inline-block text-primary hover:underline">Browse jobs</Link>
    </div>
  ),
});

function CompanyProfile() {
  const { slug } = Route.useParams();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, description, location, website, logo_url, hq_city, hq_state, industry, verified")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["company-jobs", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, slug, title, location, shift, employment_type, pay_min, pay_max, featured, category")
        .eq("company_id", company!.id)
        .in("status", ["active", "published"])
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });
      return (data ?? []).map((j) => ({ ...j, companies: { name: company!.name, slug, verified: company!.verified } })) as JobSummary[];
    },
  });

  if (isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!company) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <Link to="/jobs" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-start gap-5 rounded-xl border border-border bg-card p-6 sm:p-8">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
            {company.logo_url ? (
              <img src={company.logo_url} alt={`${company.name} logo`} className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-9 w-9 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="label-caps text-primary">Employer</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
              {company.name}
              {company.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-900">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified employer
                </span>
              )}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {(company.location || company.hq_city) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {company.location ?? [company.hq_city, company.hq_state].filter(Boolean).join(", ")}
                </span>
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              )}
              {company.industry && <span>{company.industry}</span>}
            </div>
            {company.description && (
              <p className="mt-4 max-w-3xl whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                {company.description}
              </p>
            )}
            <div className="mt-4">
              <ReportButton entityType="company" entityId={company.id} variant="outline" />
            </div>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">
            Open roles {jobs.length > 0 && <span className="text-muted-foreground">({jobs.length})</span>}
          </h2>
          {jobs.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No active openings right now. Check back soon.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {jobs.map((j) => <JobCard key={j.id} job={j} />)}
            </div>
          )}
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
