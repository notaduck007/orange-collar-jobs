/** UI/domain types for the jobs feature — not API wire shapes. */

import type {
  EmploymentType,
  JobShift,
  JobStatus,
  JobSourceType,
  PayPeriod,
  ScreeningQuestionType,
} from "@/lib/api/contracts/jobs";

export type {
  EmploymentType,
  JobShift,
  JobStatus,
  JobSourceType,
  PayPeriod,
  ScreeningQuestionType,
};

/** Employer job wizard form slice (snake_case matches legacy route state). */
export interface EmployerJobFormSlice {
  title: string;
  category: string;
  shift: string;
  employment_type: string;
  pay_min: string;
  pay_max: string;
  pay_period: PayPeriod;
  city: string;
  state: string;
  zip: string;
  description: string;
  requirements: string;
  temperature_env: string;
  certifications_required: string[];
  lift_requirement_lbs: string;
  overtime_available: boolean;
  weekly_pay: boolean;
  quick_hire: boolean;
  feature_it: boolean;
}

export interface ScreeningQuestionInput {
  prompt: string;
  type: ScreeningQuestionType;
  options: string[];
  required: boolean;
}

/** URL search params on `/jobs` before mapping to API query. */
export interface JobsUrlSearch {
  q?: string;
  loc?: string;
  category?: string;
  shift?: string;
  type?: string;
  pay_min?: number;
  radius?: number;
  temp?: "ambient" | "cooler" | "freezer";
  weekly_pay?: boolean;
  quick_hire?: boolean;
  page?: number;
  pageSize?: number;
}
