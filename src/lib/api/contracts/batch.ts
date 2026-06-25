/**
 * OpenAPI wire types for `/api/v1/jobs/batch*` — request/response shapes only.
 */

import type { EmploymentType, JobShift, JobSourceType } from "./jobs";

/** OpenAPI `BatchJobItem`. */
export interface BatchJobItem {
  externalId?: string;
  sourceUrl?: string;
  companyName?: string;
  title: string;
  category?: string;
  location: string;
  city?: string;
  state?: string;
  zip?: string;
  employmentType: EmploymentType;
  shift: JobShift;
  payMin?: number;
  payMax?: number;
  payPeriod?: string;
  description: string;
  requirements?: string;
  sourceType: JobSourceType;
  expiresAt?: string;
}

/** OpenAPI `BatchRequest`. */
export interface BatchRequest {
  jobs: BatchJobItem[];
  source?: string;
}

/** OpenAPI `BatchResponse` — async ingest (>100 jobs, HTTP 202). */
export interface BatchResponse {
  readonly batchId: string;
  readonly status: "queued" | "processing" | "completed" | "failed";
  readonly count: number;
  readonly message?: string;
}

/** OpenAPI `BatchStatus` — sync ingest result or poll response. */
export interface BatchStatus {
  readonly batchId: string;
  readonly status: "queued" | "processing" | "completed" | "failed";
  readonly total: number;
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly failed: number;
  readonly errors: ReadonlyArray<{
    readonly index: number;
    readonly externalId?: string | null;
    readonly reason: string;
  }>;
  readonly startedAt?: string | null;
  readonly completedAt?: string | null;
}

export type BatchSubmitResult = BatchStatus | BatchResponse;
