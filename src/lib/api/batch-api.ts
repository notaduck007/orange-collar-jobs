import { apiFetch } from "./http";
import type {
  BatchRequest,
  BatchResponse,
  BatchStatus,
  BatchSubmitResult,
} from "./contracts/batch";

export type { BatchSubmitResult };

export const batchApi = {
  submitBatch(apiKey: string, body: BatchRequest): Promise<BatchSubmitResult> {
    return apiFetch<BatchSubmitResult>("/api/v1/jobs/batch", {
      method: "POST",
      apiKey,
      body: JSON.stringify(body),
    });
  },

  getBatchStatus(apiKey: string, batchId: string): Promise<BatchStatus> {
    return apiFetch<BatchStatus>(`/api/v1/jobs/batch/${encodeURIComponent(batchId)}/status`, {
      apiKey,
    });
  },
};

export function isAsyncBatchResponse(result: BatchSubmitResult): result is BatchResponse {
  return "count" in result && !("total" in result);
}

export function isSyncBatchStatus(result: BatchSubmitResult): result is BatchStatus {
  return "total" in result;
}
