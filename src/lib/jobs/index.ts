import type { JobSummary } from "@/components/job-card";

export type {
  EmployerJobFormSlice,
  EmploymentType,
  JobsUrlSearch,
  JobShift,
  JobSourceType,
  JobStatus,
  PayPeriod,
  ScreeningQuestionInput,
  ScreeningQuestionType,
} from "./types";

/** Extended card fields used internally before mapping to JobCard. */
export type MappedJobSummary = JobSummary & {
  source_type?: string;
  category?: string;
};
