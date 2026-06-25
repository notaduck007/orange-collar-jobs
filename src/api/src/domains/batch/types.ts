import type { BatchStatus as PrismaBatchStatus } from "../../core/database/prisma-client.js";

// ── BullMQ job payload ────────────────────────────────────────────────────────

export interface BatchJobData {
  batchId: string;
  items: BatchJobItemRaw[];
  companyId?: string | null | undefined;
  source?: string | undefined;
}

/** Raw item shape used inside the BullMQ payload (serialisable) */
export interface BatchJobItemRaw {
  externalId?: string;
  sourceUrl?: string;
  companyName?: string;
  title: string;
  category?: string;
  location: string;
  city?: string;
  state?: string;
  zip?: string;
  employmentType: string;
  shift: string;
  payMin?: number;
  payMax?: number;
  payPeriod?: string;
  description: string;
  requirements?: string;
  sourceType: string;
  expiresAt?: string;
}

// ── Per-item result ───────────────────────────────────────────────────────────

export type BatchItemAction = "created" | "updated" | "skipped" | "failed";

export interface BatchItemResult {
  action: BatchItemAction;
  index: number;
  externalId?: string | undefined;
  error?: string | undefined;
}

// ── HTTP response shapes (mirror OpenAPI BatchStatus / BatchResponse) ─────────

export interface BatchStatusResponse {
  batchId: string;
  status: PrismaBatchStatus;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ index: number; externalId?: string | null; reason: string }>;
  startedAt: string | null;
  completedAt: string | null;
}

/** Returned immediately on async (>100 jobs) enqueue — HTTP 202 */
export interface BatchSubmitResponse {
  batchId: string;
  status: string;
  count: number;
  message: string;
}

/** Attached to request by BatchAuthGuard when X-Api-Key is used */
export interface ApiKeyAuthInfo {
  apiKeyId: string | null;
  companyId: string | null;
}

declare module "express" {
  interface Request {
    apiKeyAuth?: ApiKeyAuthInfo;
  }
}
