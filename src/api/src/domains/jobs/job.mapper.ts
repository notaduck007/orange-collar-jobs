import type {
  Company,
  Job,
  ScreeningQuestion,
} from "../../core/database/prisma-client.js";
import type {
  JobCompanySummary,
  JobDetailResponse,
  JobResponse,
  JobSummaryResponse,
} from "./types.js";

export type JobWithCompany = Job & {
  company?: Pick<Company, "id" | "name" | "slug" | "verified" | "logoUrl"> | null;
};

type JobWithQuestions = JobWithCompany & { screeningQuestions?: ScreeningQuestion[] };

function toCompanySummary(
  company: Pick<Company, "id" | "name" | "slug" | "verified" | "logoUrl"> | null | undefined,
): JobCompanySummary | null {
  if (!company) return null;
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    verified: company.verified,
    logoUrl: company.logoUrl,
  };
}

export function toJobResponse(job: JobWithCompany): JobResponse {
  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    category: job.category,
    categorySlug: job.categorySlug,
    companyId: job.companyId,
    location: job.location,
    city: job.city,
    state: job.state,
    zip: job.zip,
    lat: job.lat,
    lng: job.lng,
    employmentType: job.employmentType,
    shift: job.shift,
    payMin: job.payMin,
    payMax: job.payMax,
    payPeriod: job.payPeriod,
    description: job.description,
    requirements: job.requirements,
    temperatureEnv: job.temperatureEnv,
    certificationsRequired: job.certificationsRequired,
    liftRequirementLbs: job.liftRequirementLbs,
    overtimeAvailable: job.overtimeAvailable,
    weeklyPay: job.weeklyPay,
    quickHire: job.quickHire,
    status: job.status,
    sourceType: job.sourceType,
    externalId: job.externalId,
    sourceUrl: job.sourceUrl,
    featured: job.featured,
    featuredUntil: job.featuredUntil?.toISOString() ?? null,
    views: job.views,
    postedAt: job.postedAt?.toISOString() ?? job.createdAt.toISOString(),
    expiresAt: job.expiresAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    company: toCompanySummary(job.company),
  };
}

export function toJobSummary(job: JobWithCompany): JobSummaryResponse {
  const company = job.company;
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    category: job.category,
    location: job.location,
    city: job.city,
    state: job.state,
    employmentType: job.employmentType,
    shift: job.shift,
    payMin: job.payMin,
    payMax: job.payMax,
    payPeriod: job.payPeriod,
    featured: job.featured,
    quickHire: job.quickHire,
    weeklyPay: job.weeklyPay,
    sourceType: job.sourceType,
    postedAt: job.postedAt?.toISOString() ?? job.createdAt.toISOString(),
    company: company
      ? { name: company.name, slug: company.slug, verified: company.verified }
      : null,
  };
}

export function toJobDetail(
  job: JobWithQuestions,
  interviewSlots: JobDetailResponse["interviewSlots"] = [],
): JobDetailResponse {
  const base = toJobResponse(job);
  const questions = job.screeningQuestions ?? [];
  return {
    ...base,
    screeningQuestions: questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      required: q.required,
      sortOrder: q.sortOrder,
    })),
    interviewSlots,
  };
}
