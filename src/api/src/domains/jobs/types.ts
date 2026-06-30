import type {
  EmploymentType,
  JobShift,
  JobSourceType,
  JobStatus,
  PayPeriod,
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
  category: string;
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

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginatedJobsResponse {
  data: JobSummaryResponse[];
  meta: PaginationMeta;
}

export interface PaginatedJobResponses {
  data: JobResponse[];
  meta: PaginationMeta;
}
