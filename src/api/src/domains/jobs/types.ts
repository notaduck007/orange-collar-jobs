import type {
  Company,
  EmploymentType,
  Job,
  JobShift,
  JobSourceType,
  JobStatus,
  PayPeriod,
  ScreeningQuestion,
  ScreeningQuestionType,
  TemperatureEnv,
} from "../../core/database/prisma-client.js";

export interface JobCompanySummary {
  id: string;
  name: string;
  slug: string;
  verified: boolean;
  logoUrl?: string | null;
}

export interface ScreeningQuestionResponse {
  id: string;
  prompt: string;
  type: ScreeningQuestionType;
  options: string[];
  required: boolean;
  sortOrder: number;
}

export interface JobResponse {
  id: string;
  title: string;
  slug: string;
  category: string;
  categorySlug: string;
  companyId?: string | null;
  location: string;
  city: string;
  state: string;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  employmentType: EmploymentType;
  shift: JobShift;
  payMin?: number | null;
  payMax?: number | null;
  payPeriod?: PayPeriod | null;
  description: string;
  requirements?: string | null;
  temperatureEnv?: TemperatureEnv | null;
  certificationsRequired: string[];
  liftRequirementLbs?: number | null;
  overtimeAvailable: boolean;
  weeklyPay: boolean;
  quickHire: boolean;
  status: JobStatus;
  sourceType: JobSourceType;
  externalId?: string | null;
  sourceUrl?: string | null;
  featured: boolean;
  featuredUntil?: string | null;
  views: number;
  postedAt: string;
  expiresAt?: string | null;
  createdAt: string;
  company?: JobCompanySummary | null;
}

export interface JobSummaryResponse {
  id: string;
  slug: string;
  title: string;
  location: string;
  city?: string | null;
  state?: string | null;
  employmentType: EmploymentType;
  shift: JobShift;
  payMin?: number | null;
  payMax?: number | null;
  payPeriod?: PayPeriod | null;
  featured: boolean;
  quickHire: boolean;
  weeklyPay: boolean;
  sourceType: JobSourceType;
  postedAt: string;
  company?: {
    name: string;
    slug: string;
    verified: boolean;
  } | null;
}

export interface JobDetailResponse extends JobResponse {
  screeningQuestions: ScreeningQuestionResponse[];
  interviewSlots: Array<{
    id: string;
    startsAt: string;
    capacity: number;
    remaining: number;
  }>;
}

export interface PaginatedJobsResponse {
  data: JobSummaryResponse[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

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
