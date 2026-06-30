import type { JobSummary } from "@/components/job-card";
import type {
  JobDetail,
  JobSearchQuery,
  JobSummary as ApiJobSummary,
} from "@/lib/api/contracts/jobs";
import type { JobsUrlSearch } from "@/lib/jobs/types";

/** Maps Nest API job summary → legacy JobCard shape (adapter for gradual UI migration). */
export function mapJobSummaryToCard(job: ApiJobSummary): JobSummary {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    location: job.location,
    shift: job.shift,
    employment_type: job.employmentType,
    pay_min: job.payMin ?? null,
    pay_max: job.payMax ?? null,
    featured: job.featured,
    category: job.category ?? "",
    companies: job.company
      ? { name: job.company.name, slug: job.company.slug, verified: job.company.verified }
      : null,
    weekly_pay: job.weeklyPay,
    quick_hire: job.quickHire,
    source_type: job.sourceType,
  };
}

/** URL search params on `/jobs` → Nest API query (single place for filter mapping). */
export function buildJobSearchParams(search: JobsUrlSearch): JobSearchQuery {
  const params: JobSearchQuery = {
    page: search.page ?? 1,
    pageSize: search.pageSize ?? 20,
  };
  if (search.q) params.q = search.q;
  if (search.loc) {
    const parts = search.loc.split(",").map((s) => s.trim());
    if (parts[0]) params.city = parts[0];
    if (parts[1]) params.state = parts[1].slice(0, 2).toUpperCase();
  }
  if (search.category) params.category = search.category;
  if (search.shift) params.shift = search.shift as JobSearchQuery["shift"];
  if (search.type) params.employmentType = search.type as JobSearchQuery["employmentType"];
  if (search.pay_min != null) params.payMin = search.pay_min;
  if (search.radius != null) params.radius = search.radius;
  if (search.temp) params.temperatureEnv = search.temp;
  if (search.quick_hire) params.quickHire = true;
  if (search.weekly_pay) params.weeklyPay = true;
  return params;
}

/** Detail response → snake_case page model (legacy job detail template). */
export function mapJobDetailToPage(job: JobDetail) {
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    category: job.category,
    location: job.location,
    city: job.city,
    state: job.state,
    zip: job.zip,
    shift: job.shift,
    employment_type: job.employmentType,
    pay_min: job.payMin,
    pay_max: job.payMax,
    pay_period: job.payPeriod,
    description: job.description,
    requirements: job.requirements,
    status: job.status,
    source_type: job.sourceType,
    featured: job.featured,
    views: job.views,
    posted_at: job.postedAt,
    expires_at: job.expiresAt,
    created_at: job.createdAt,
    temperature_env: job.temperatureEnv,
    certifications_required: job.certificationsRequired,
    lift_requirement_lbs: job.liftRequirementLbs,
    overtime_available: job.overtimeAvailable,
    weekly_pay: job.weeklyPay,
    quick_hire: job.quickHire,
    companies: job.company
      ? {
          id: job.company.id,
          name: job.company.name,
          slug: job.company.slug,
          description: null as string | null,
          location: null as string | null,
          website: null as string | null,
        }
      : null,
    screening_questions: job.screeningQuestions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options ?? [],
      required: q.required,
      sort_order: q.sortOrder,
    })),
  };
}

export type JobPageModel = ReturnType<typeof mapJobDetailToPage>;
