import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  Languages,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { apiClient } from "@/lib/api-client";
import { mapJobDetailToPage, mapJobSummaryToCard } from "@/lib/jobs/job-mappers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { ApplyDialog } from "@/components/apply-dialog";
import { ApplySuccessDialog } from "@/components/apply-success-dialog";
import { AdSlot } from "@/components/ad-slot";
import { JobCard, type JobSummary } from "@/components/job-card";
import { ReportButton } from "@/components/report-button";
import { useAppliedJobs, useQuickApplyReady } from "@/hooks/use-applied-jobs";

import { canonical } from "@/lib/seo";
import { jobSlugClearApplyLink, jobSlugLink } from "@/lib/routes/job-slug-link";
import { jobDetailSearchSchema } from "@/lib/routes/jobs-search-schema";

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
  validateSearch: jobDetailSearchSchema,
  loader: async ({ params }) => {
    let job;
    try {
      const dto = await apiClient.getJobBySlug(params.slug);
      job = mapJobDetailToPage(dto);
    } catch {
      throw notFound();
    }
    const statusOk = job.status === "active" || job.status === "published";
    const notExpired = !job.expires_at || new Date(job.expires_at).getTime() > Date.now();
    const expired = !(statusOk && notExpired);
    let similar: JobSummary[] = [];
    if (expired && job.category) {
      const sim = await apiClient.searchJobs({ category: job.category, pageSize: 8 });
      similar = sim.data
        .filter((d) => d.id !== job.id)
        .slice(0, 4)
        .map(mapJobSummaryToCard);
    }
    return { job, expired, similar };
  },
  head: ({ params, loaderData }) => {
    const m = loaderData?.job as
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
      ? `${m.title}${company ? ` at ${company}` : ""} — ${m.location} | WarehouseJobs.com`
      : "Warehouse Job | WarehouseJobs.com";
    const desc = m
      ? (m.description ?? "").slice(0, 155).replace(/\s+/g, " ").trim() ||
        `${m.category} role in ${m.location}. Apply on WarehouseJobs.com.`
      : "Apply to warehouse jobs near you on WarehouseJobs.com.";

    const expired = !!loaderData?.expired;
    let jsonLd: Record<string, unknown> | null = null;
    if (m && !expired) {
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
      const datePosted = m.posted_at ?? m.created_at ?? undefined;
      let validThrough = m.expires_at ?? undefined;
      if (!validThrough && datePosted) {
        const d = new Date(datePosted);
        if (!isNaN(d.getTime())) {
          d.setUTCDate(d.getUTCDate() + 60);
          validThrough = d.toISOString();
        }
      }
      const rawLogo = m.companies?.logo_url ?? undefined;
      const logo = rawLogo
        ? /^https?:\/\//i.test(rawLogo)
          ? rawLogo
          : `https://warehousejobs.com${rawLogo.startsWith("/") ? "" : "/"}${rawLogo}`
        : undefined;
      const descHtml = (m.description ?? "")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("");
      jsonLd = {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: m.title,
        description: descHtml,
        identifier: { "@type": "PropertyValue", name: "WarehouseJobs", value: params.slug },
        url: `https://warehousejobs.com/jobs/${params.slug}`,
        datePosted,
        validThrough,
        employmentType,
        hiringOrganization: company
          ? {
              "@type": "Organization",
              name: company,
              sameAs: m.companies?.website ?? undefined,
              logo,
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

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "article" },
      { property: "og:image", content: "https://warehousejobs.com/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://warehousejobs.com/og-image.png" },
    ];
    if (m && !expired) {
      meta.push({ property: "og:url", content: canonical(`/jobs/${params.slug}`) });
    }
    if (expired) {
      meta.push({ name: "robots", content: "noindex" });
    }

    const emitCanonical = !!m && !expired;
    const breadcrumbLd =
      m && !expired
        ? {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: "https://warehousejobs.com/",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Jobs",
                item: "https://warehousejobs.com/jobs",
              },
              {
                "@type": "ListItem",
                position: 3,
                name: m.title,
                item: `https://warehousejobs.com/jobs/${params.slug}`,
              },
            ],
          }
        : null;
    const scripts: Array<{ type: string; children: string }> = [];
    if (jsonLd) scripts.push({ type: "application/ld+json", children: JSON.stringify(jsonLd) });
    if (breadcrumbLd)
      scripts.push({ type: "application/ld+json", children: JSON.stringify(breadcrumbLd) });
    return {
      meta,
      links: emitCanonical
        ? [{ rel: "canonical", href: canonical(`/jobs/${params.slug}`) }]
        : undefined,
      scripts: scripts.length ? scripts : undefined,
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
  const { job, expired, similar } = Route.useLoaderData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const [applyOpen, setApplyOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const appliedIds = useAppliedJobs();
  const quickApply = useQuickApplyReady();

  // Translation state
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState<{
    title?: string | null;
    description?: string | null;
    requirements?: string | null;
  } | null>(null);

  // Auto-show translation if language is ES and we have a cached one
  useEffect(() => {
    if (!job || i18n.language !== "es") return;
    let cancelled = false;
    void supabase
      .from("job_translations")
      .select("title, description, requirements")
      .eq("job_id", job.id)
      .eq("language", "es")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setTranslated(data);
          setShowTranslation(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [job, i18n.language]);

  const handleTranslate = async () => {
    if (!job) return;
    if (translated) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke("translate-job", {
        body: { jobId: job.id, language: "es" },
      });
      if (error) throw error;
      setTranslated({
        title: data?.title,
        description: data?.description,
        requirements: data?.requirements,
      });
      setShowTranslation(true);
    } catch (e) {
      toast.error(t("jobDetail.translationFailed") as string);
      console.error(e);
    } finally {
      setTranslating(false);
    }
  };

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
    setSuccessOpen(true);
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
    if (expired) return;
    if (alreadyApplied) {
      autoAppliedRef.current = true;
      navigate({ ...jobSlugClearApplyLink(slug), replace: true });
      return;
    }
    autoAppliedRef.current = true;
    apply();
    navigate({ ...jobSlugClearApplyLink(slug), replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyParam, user?.id, job?.id, screeningKnown, alreadyApplied]);

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
          <ArrowLeft className="h-4 w-4" /> {t("jobDetail.backToSearch")}
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
                  {showTranslation && translated?.title ? translated.title : job.title}
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
                  {t("jobs.featured")}
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-3">
              <Meta icon={MapPin} label={t("jobDetail.location") as string} value={job.location} />
              <Meta
                icon={Clock}
                label={t("jobDetail.type") as string}
                value={typeLabel[job.employment_type]}
              />
              {pay && <Meta icon={DollarSign} label={t("jobDetail.pay") as string} value={pay} />}
            </div>

            {(() => {
              const j = job as typeof job & {
                certifications_required?: string[] | null;
                temperature_env?: string | null;
                weekly_pay?: boolean | null;
                overtime_available?: boolean | null;
                quick_hire?: boolean | null;
                lift_requirement_lbs?: number | null;
              };
              const certs = j.certifications_required?.filter(Boolean) ?? [];
              const tempLabel = j.temperature_env
                ? j.temperature_env.charAt(0).toUpperCase() + j.temperature_env.slice(1)
                : null;
              const badges: { key: string; label: string }[] = [];
              if (certs.length) badges.push({ key: "certs", label: `Certs: ${certs.join(", ")}` });
              if (tempLabel) badges.push({ key: "temp", label: tempLabel });
              if (j.weekly_pay) badges.push({ key: "weekly", label: "Weekly pay" });
              if (j.overtime_available) badges.push({ key: "ot", label: "OT available" });
              if (j.quick_hire) badges.push({ key: "quick", label: "Quick hire" });
              if (j.lift_requirement_lbs)
                badges.push({ key: "lift", label: `Lifts up to ${j.lift_requirement_lbs} lbs` });
              if (!badges.length) return null;
              return (
                <div className="mt-4 flex flex-wrap gap-2">
                  {badges.map((b) => (
                    <span
                      key={b.key}
                      className="inline-flex items-center rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              );
            })()}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (showTranslation) {
                    setShowTranslation(false);
                  } else if (translated) {
                    setShowTranslation(true);
                  } else {
                    void handleTranslate();
                  }
                }}
                disabled={translating}
                className="gap-1.5"
              >
                {translating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("jobDetail.translating")}
                  </>
                ) : showTranslation ? (
                  <>
                    <Languages className="h-4 w-4" /> {t("jobDetail.showOriginal")}
                  </>
                ) : (
                  <>
                    <Languages className="h-4 w-4" /> {t("jobDetail.translate")}
                  </>
                )}
              </Button>
              {showTranslation && translated && (
                <span className="text-xs text-muted-foreground">{t("jobDetail.poweredByAI")}</span>
              )}
            </div>

            <section className="mt-4 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                  {t("jobDetail.description")}
                </h2>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                  {showTranslation && translated?.description
                    ? translated.description
                    : job.description?.trim() ||
                      "This employer has not added a full job description yet. Review the role title, location, and requirements below, or apply to learn more from the hiring team."}
                </p>
              </div>
              {(showTranslation && translated?.requirements
                ? translated.requirements
                : job.requirements) && (
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                    {t("jobDetail.requirements")}
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
                    {showTranslation && translated?.requirements
                      ? translated.requirements
                      : job.requirements}
                  </p>
                </div>
              )}
            </section>

            {expired ? (
              <div className="mt-8 rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
                {t("jobDetail.expired")}
              </div>
            ) : (
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
                    <Button
                      onClick={apply}
                      disabled={quickSubmitting}
                      className="btn-primary !px-6"
                    >
                      {quickSubmitting
                        ? t("apply.sending")
                        : user && quickApply.ready && !hasScreening
                          ? t("jobDetail.quickApply")
                          : t("jobDetail.apply")}
                    </Button>
                  )}
                  <Button variant="outline" onClick={save} className="gap-1.5">
                    <Bookmark className="h-4 w-4" /> {t("jobDetail.save")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Link copied");
                    }}
                    className="gap-1.5"
                  >
                    <Share2 className="h-4 w-4" /> {t("jobDetail.share")}
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
            )}
          </div>

          {expired && similar.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-[color:var(--ink)]">
                {t("jobDetail.similarJobs")}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(similar as JobSummary[]).map((j) => (
                  <JobCard key={j.id} job={j} />
                ))}
              </div>
            </section>
          )}
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
      <ApplySuccessDialog open={successOpen} onOpenChange={setSuccessOpen} />
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
