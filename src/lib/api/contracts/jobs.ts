/**
 * OpenAPI wire types for `/api/v1/jobs*` — request/response shapes only.
 * Do not add UI or form models here; those belong in `src/lib/jobs/`.
 */

import type { PaginatedResponse } from "./common";

export type EmploymentType =
  | "full_time"
  | "part_time"
  | "temp"
  | "temp_to_hire"
  | "contract"
  | "seasonal";

export type JobShift = "first" | "second" | "third" | "weekend" | "flexible";

export type JobStatus = "draft" | "active" | "published" | "closed" | "expired";

export type JobSourceType = "direct" | "scraped" | "api" | "syndicated";

export type PayPeriod = "hour" | "day" | "week" | "month" | "year";

export type TemperatureEnv = "ambient" | "cooler" | "freezer";

export type ScreeningQuestionType = "yes_no" | "single" | "multi" | "number" | "text";

export interface JobCompanySummary {
  readonly id?: string;
  readonly name: string;
  readonly slug: string;
  readonly verified: boolean;
  readonly logoUrl?: string | null;
}

/** Compact job card — OpenAPI `JobSummary`. */
export interface JobSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly location: string;
  readonly city?: string | null;
  readonly state?: string | null;
  readonly employmentType: EmploymentType;
  readonly shift: JobShift;
  readonly payMin?: number | null;
  readonly payMax?: number | null;
  readonly payPeriod?: PayPeriod | null;
  readonly featured: boolean;
  readonly quickHire: boolean;
  readonly weeklyPay: boolean;
  readonly sourceType: JobSourceType;
  readonly postedAt: string;
  readonly company?: {
    readonly name: string;
    readonly slug: string;
    readonly verified: boolean;
  } | null;
}

/** Full job resource — OpenAPI `Job`. */
export interface Job {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly category: string;
  readonly categorySlug: string;
  readonly companyId?: string | null;
  readonly location: string;
  readonly city: string;
  readonly state: string;
  readonly zip?: string | null;
  readonly lat?: number | null;
  readonly lng?: number | null;
  readonly employmentType: EmploymentType;
  readonly shift: JobShift;
  readonly payMin?: number | null;
  readonly payMax?: number | null;
  readonly payPeriod?: PayPeriod | null;
  readonly description: string;
  readonly requirements?: string | null;
  readonly temperatureEnv?: TemperatureEnv | null;
  readonly certificationsRequired: readonly string[];
  readonly liftRequirementLbs?: number | null;
  readonly overtimeAvailable: boolean;
  readonly weeklyPay: boolean;
  readonly quickHire: boolean;
  readonly status: JobStatus;
  readonly sourceType: JobSourceType;
  readonly externalId?: string | null;
  readonly sourceUrl?: string | null;
  readonly featured: boolean;
  readonly featuredUntil?: string | null;
  readonly views: number;
  readonly postedAt: string | null;
  readonly expiresAt?: string | null;
  readonly createdAt: string;
  readonly company?: JobCompanySummary | null;
}

export interface ScreeningQuestion {
  id?: string;
  prompt: string;
  type: ScreeningQuestionType;
  options?: string[];
  required: boolean;
  sortOrder: number;
}

export interface InterviewSlot {
  readonly id: string;
  readonly startsAt: string;
  readonly capacity: number;
  readonly remaining: number;
}

/** GET `/api/v1/jobs/{slug}` — Job + screeningQuestions + interviewSlots. */
export interface JobDetail extends Job {
  readonly screeningQuestions: readonly ScreeningQuestion[];
  readonly interviewSlots?: readonly InterviewSlot[];
}

export type PaginatedJobs = PaginatedResponse<JobSummary>;

/** POST `/api/v1/jobs` body — OpenAPI `CreateJobRequest`. */
export interface CreateJobRequest {
  title: string;
  category: string;
  categorySlug?: string;
  companyId?: string;
  location: string;
  city: string;
  state: string;
  zip?: string;
  lat?: number;
  lng?: number;
  employmentType: EmploymentType;
  shift: JobShift;
  payMin?: number;
  payMax?: number;
  payPeriod?: PayPeriod;
  description: string;
  requirements?: string;
  temperatureEnv?: TemperatureEnv;
  certificationsRequired?: string[];
  liftRequirementLbs?: number;
  overtimeAvailable?: boolean;
  weeklyPay?: boolean;
  quickHire?: boolean;
  featured?: boolean;
  companyPackageId?: string;
  screeningQuestions?: Array<Omit<ScreeningQuestion, "id">>;
  status?: JobStatus;
}

/** PATCH `/api/v1/jobs/{id}` body — OpenAPI `UpdateJobRequest`. */
export type UpdateJobRequest = Partial<CreateJobRequest>;

/** GET `/api/v1/jobs` query parameters. */
export interface JobSearchQuery {
  q?: string;
  category?: string;
  city?: string;
  state?: string;
  zip?: string;
  radius?: number;
  shift?: JobShift;
  employmentType?: EmploymentType;
  payMin?: number;
  featured?: boolean;
  quickHire?: boolean;
  weeklyPay?: boolean;
  temperatureEnv?: TemperatureEnv;
  companyId?: string;
  page?: number;
  pageSize?: number;
}

/** GET `/api/v1/admin/jobs` query parameters. */
export interface AdminJobSearchQuery {
  status?: JobStatus;
  sourceType?: JobSourceType;
  companyId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export type PaginatedJobRecords = PaginatedResponse<Job>;

export interface FeatureJobRequest {
  readonly featured: boolean;
  readonly featuredUntil?: string | null;
}
