import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Clock,
  DollarSign,
  Building2,
  ArrowLeft,
  Bookmark,
  Share2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { ApplyDialog } from "@/components/apply-dialog";
import { AdSlot } from "@/components/ad-slot";
import { ReportButton } from "@/components/report-button";
import { useAppliedJobs, useQuickApplyReady } from "@/hooks/use-applied-jobs";
import { JobDetailSkeleton } from "@/components/ui/skeleton-list";

const EMPLOYMENT_TYPE_SCHEMA: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  temp: "TEMPORARY",
  temp_to_hire: "TEMPORARY",
  seasonal: "TEMPORARY",
  contract: "CONTRACTOR",
};

const PAY_UNIT_SCHEMA: Record<string, string> = {
  hour: "HOUR",
  day: "DAY",
  week: "WEEK",
  month: "MONTH",
  year: "YEAR",
};

export const Route = createFileRoute("/jobs/$slug")({
  validateSearch: (s: Record<string, unknown>) => ({
    apply: s.apply === "1" || s.apply === 1 || s.apply === true ? (1 as const) : undefined,
  }),
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("jobs")
      .select(
        "title, description, location, category, city, state, zip, employment_type, pay_min, pay_max, pay_period, posted_at, created_at, expires_at, companies(name, website, logo_url)",
      )
      .eq("slug", params.slug)
      .maybeSingle();
    return { meta: data };
  },
  head: ({ params, loaderData }) => {
    const m = loaderData?.meta as
      | {
          title: string;
          description: string;
          location: string;
          category: string;
          city: string | null;
          state: string | null;
          zip: string | null;
          employment_type: string;
          pay_min: number | null;
          pay_max: number | null;
          pay_period: string | null;
          posted_at: string | null;
          created_at: string | null;
          expires_at: string | null;
          companies: { name?: string; website?: string | null; logo_url?: string | null } | null;
        }
      | null
      | undefined;
    const company = m?.companies?.name;
    const title = m
      ? `${m.title}${company ? ` at ${company}` : ""} — ${m.location} | WarehouseJobs`
      : "Warehouse Job | WarehouseJobs";
    const desc = m
      ? (m.description ?? "").slice(0, 155).replace(/\s+/g, " ").trim() ||
        `${m.category} role in ${m.location}. Apply on WarehouseJobs.`
      : "Apply to warehouse jobs near you on WarehouseJobs.";

    let jsonLd: Record<string, unknown> | null = null;
    if (m) {
      const employmentType = EMPLOYMENT_TYPE_SCHEMA[m.employment_type] ?? "FULL_TIME";
      const baseSalary =
        m.pay_min != null || m.pay_max != null
          ? {
              "@type": "MonetaryAmount",
              currency: "USD",
              value: {
                "@type": "QuantitativeValue",
                minValue: m.pay_min ?? undefined,
                maxValue: m.pay_max ?? m.pay_min ?? undefined,
                unitText: PAY_UNIT_SCHEMA[m.pay_period ?? "hour"] ?? "HOUR",
              },
            }
          : undefined;
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: m.title,
        description: m.description,
        datePosted: m.posted_at ?? m.created_at ?? undefined,
        validThrough: m.expires_at ?? undefined,
        employmentType,
        hiringOrganization: company
          ? {
              "@type": "Organization",
              name: company,
              sameAs: m.companies?.website ?? undefined,
              logo: m.companies?.logo_url ?? undefined,
            }
          : undefined,
        jobLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            streetAddress: undefined,
            addressLocality: m.city ?? m.location,
            addressRegion: m.state ?? undefined,
            postalCode: m.zip ?? undefined,
            addressCountry: "US",
          },
        },
        baseSalary,
        directApply: true,
      };
    }

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
      scripts: jsonLd
        ? [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }]
        : undefined,
    };
  },
  component: JobDetail,
  errorComponent: ({ error }) => (
    <div className="p-12 text-center text-sm text-muted-foreground">
      Couldn't load job: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-lg font-semibold">Job not found</p>
      <Link to="/jobs" className="mt-2 inline-block text-primary hover:underline">
        Back to search
      </Link>
    </div>
  ),
});

const shiftLabel: Record<string, string> = {
  first: "1st Shift",
  second: "2nd Shift",
  third: "3rd Shift",
  weekend: "Weekend",
  flexible: "Flexible",
};
const typeLabel: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  temp: "Temp",
  temp_to_hire: "Temp-to-Hire",
  seasonal: "Seasonal",
  contract: "Contract",
};

function JobDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const appliedIds = useAppliedJobs();
  const quickApply = useQuickApplyReady();

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

  const alreadyApplied = !!job && appliedIds.has(job.id);

  const { data: screeningCount = 0, isFetched: screeningFetched } = useQuery({
    queryKey: ["screening-questions-count", job?.id],
    enabled: !!job?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("screening_questions")
        .select("*", { count: "exact", head: true })
        .eq("job_id", job!.id);
      return count ?? 0;
    },
  });
  const hasScreening = screeningCount > 0;
  const screeningKnown = !!job?.id && screeningFetched;

  const handleQuickApply = async () => {
    if (!user || !job) return;
    setQuickSubmitting(true);
    const [{ data: prof }, { data: seeker }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, display_name, phone")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("seeker_profiles")
        .select(
          "headline, skills, certifications, desired_shift, desired_employment_type, willing_to_relocate",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const { error } = await supabase.from("applications").insert({
      job_id: job.id,
      applicant_id: user.id,
      resume_url: quickApply.resumeUrl ?? null,
      cover_letter: coverNote.trim() || null,
      applicant_email: user.email ?? null,
      applicant_name: prof?.full_name || prof?.display_name || null,
      applicant_phone: prof?.phone ?? null,
      applicant_headline: seeker?.headline ?? null,
      applicant_skills: seeker?.skills ?? null,
      applicant_certifications: seeker?.certifications ?? null,
      applicant_desired_shift: seeker?.desired_shift ?? null,
      applicant_desired_employment_type: seeker?.desired_employment_type ?? null,
      applicant_willing_to_relocate: seeker?.willing_to_relocate ?? null,
    });
    setQuickSubmitting(false);
    if (error) {
      if (error.code === "23505") toast.error("You've already applied to this job.");
      else toast.error(error.message);
      return;
    }
    toast.success("Application sent!");
    setCoverNote("");
    setCoverOpen(false);
    qc.invalidateQueries({ queryKey: ["seeker-apps", user.id] });
    qc.invalidateQueries({ queryKey: ["seeker-applied-ids", user.id] });
    qc.invalidateQueries({ queryKey: ["seeker-stats", user.id] });
  };

  const apply = () => {
    if (!user) {
      navigate({
        to: "/auth",
        search: {
          mode: "signup",
          role: "job_seeker",
          next: `/jobs/${slug}?apply=1`,
        } as never,
      });
      return;
    }
    if (quickApply.ready && screeningKnown && !hasScreening) {
      handleQuickApply();
      return;
    }
    setApplyOpen(true);
  };

  const save = async () => {
    if (!user) {
      navigate({
        to: "/auth",
        search: {
          mode: "signup",
          role: "job_seeker",
          next: `/jobs/${slug}?apply=1`,
        } as never,
      });
      return;
    }
    const { error } = await supabase
      .from("saved_jobs")
      .insert({ user_id: user.id, job_id: job!.id });
    if (error && error.code !== "23505") toast.error(error.message);
    else toast.success("Saved to your list.");
  };

  const { apply: applyParam } = Route.useSearch();
  const autoAppliedRef = useRef(false);
  useEffect(() => {
    if (autoAppliedRef.current) return;
    if (applyParam !== 1) return;
    if (!user || !job || !screeningKnown) return;
    if (alreadyApplied) {
      autoAppliedRef.current = true;
      navigate({ to: "/jobs/$slug", params: { slug }, search: {}, replace: true });
      return;
    }
    autoAppliedRef.current = true;
    apply();
    navigate({ to: "/jobs/$slug", params: { slug }, search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyParam, user?.id, job?.id, screeningKnown, alreadyApplied]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <JobDetailSkeleton />
        <SiteFooter />
      </div>
    );
  }
  if (!job) return null;
  const pay =
    job.pay_min && job.pay_max
      ? `$${job.pay_min}–$${job.pay_max} / ${job.pay_period ?? "hour"}`
      : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6">
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to search
        </Link>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
        <main>
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label-caps text-primary">
                  {job.category} • {shiftLabel[job.shift]}
                </p>
                <h1 className="mt-2 text-3xl font-bold leading-tight text-[color:var(--ink)] sm:text-4xl">
                  {job.title}
                </h1>
                {job.companies && (
                  <Link
                    to="/companies/$slug"
                    params={{ slug: job.companies.slug }}
                    className="mt-2 inline-flex items-center gap-1.5 text-base font-medium text-foreground hover:text-primary hover:underline"
                  >
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
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                  {job.description}
                </p>
              </div>
              {job.requirements && (
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--ink)]">Requirements</h2>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                    {job.requirements}
                  </p>
                </div>
              )}
            </section>

            <div className="mt-8 space-y-3">
              {user && quickApply.ready && !hasScreening && !alreadyApplied && (
                <div className="rounded-lg border border-dashed border-border bg-background p-3">
                  <button
                    type="button"
                    onClick={() => setCoverOpen((v) => !v)}
                    className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-primary"
                  >
                    <span>Add a cover note (optional)</span>
                    {coverOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {coverOpen && (
                    <Textarea
                      className="mt-3"
                      rows={4}
                      maxLength={2000}
                      placeholder="A quick note to the hiring manager…"
                      value={coverNote}
                      onChange={(e) => setCoverNote(e.target.value)}
                    />
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {alreadyApplied ? (
                  <Button disabled className="btn-primary !px-6 gap-1.5 opacity-90">
                    <CheckCircle2 className="h-4 w-4" /> Applied
                  </Button>
                ) : (
                  <Button onClick={apply} disabled={quickSubmitting} className="btn-primary !px-6">
                    {quickSubmitting
                      ? "Sending…"
                      : user && quickApply.ready && !hasScreening
                        ? "Quick apply"
                        : "Apply now"}
                  </Button>
                )}
                <Button variant="outline" onClick={save} className="gap-1.5">
                  <Bookmark className="h-4 w-4" /> Save
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied");
                  }}
                  className="gap-1.5"
                >
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                {job && <ReportButton entityType="job" entityId={job.id} variant="outline" />}
              </div>
              {user && !quickApply.ready && !alreadyApplied && (
                <p className="text-xs text-muted-foreground">
                  Tip:{" "}
                  <Link to="/seeker/profile" className="text-primary hover:underline">
                    complete your profile
                  </Link>{" "}
                  to enable one-click quick apply.
                </p>
              )}
            </div>
          </div>
        </main>

        <aside className="space-y-4">
          {job.companies && (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="label-caps">About the employer</p>
              <Link
                to="/companies/$slug"
                params={{ slug: job.companies.slug }}
                className="mt-2 inline-block text-base font-semibold text-[color:var(--ink)] hover:text-primary hover:underline"
              >
                {job.companies.name}
              </Link>
              <p className="mt-0.5 text-sm text-muted-foreground">{job.companies.location}</p>
              {job.companies.description && (
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  {job.companies.description}
                </p>
              )}
              <Link
                to="/companies/$slug"
                params={{ slug: job.companies.slug }}
                className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
              >
                View all roles →
              </Link>
            </div>
          )}

          <AdSlot slot="job_sidebar" />

          <Link
            to="/pricing"
            className="block overflow-hidden rounded-xl border border-border bg-card p-5"
          >
            <div className="hazard-stripes mb-3 h-1.5 w-12 rounded-sm" />
            <p className="text-sm font-semibold leading-snug text-[color:var(--ink)]">
              Hiring? Get this same placement for your jobs.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Featured upgrades start at $39 per post.
            </p>
            <p className="mt-3 text-xs font-semibold text-primary">See packages →</p>
          </Link>
        </aside>
      </div>

      <SiteFooter />

      {job && (
        <ApplyDialog
          jobId={job.id}
          jobTitle={job.title}
          quickHire={!!(job as { quick_hire?: boolean }).quick_hire}
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
      <p className="label-caps flex items-center gap-1 text-[10px]">
        <Icon className="h-3 w-3" /> {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">{value}</p>
    </div>
  );
}
