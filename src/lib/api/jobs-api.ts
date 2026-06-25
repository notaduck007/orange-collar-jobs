import { apiFetch } from "./http";
import type {
  AdminJobSearchQuery,
  CreateJobRequest,
  FeatureJobRequest,
  JobDetail,
  JobSearchQuery,
  PaginatedJobRecords,
  PaginatedJobs,
  UpdateJobRequest,
} from "./contracts/jobs";

function toQuery(params: JobSearchQuery | AdminJobSearchQuery): string {
  const q = new URLSearchParams();
  const entries = params as Record<string, string | number | boolean | undefined>;
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === null || value === "") continue;
    q.set(key, String(value));
  }
  if (!q.has("page")) q.set("page", "1");
  if (!q.has("pageSize")) q.set("pageSize", "20");
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const jobsApi = {
  searchJobs(params: JobSearchQuery = {}): Promise<PaginatedJobs> {
    return apiFetch<PaginatedJobs>(`/api/v1/jobs${toQuery(params)}`);
  },

  listMyJobs(token: string, params: JobSearchQuery = {}): Promise<PaginatedJobRecords> {
    return apiFetch<PaginatedJobRecords>(`/api/v1/jobs/mine${toQuery(params)}`, { token });
  },

  adminListJobs(token: string, params: AdminJobSearchQuery = {}): Promise<PaginatedJobRecords> {
    return apiFetch<PaginatedJobRecords>(`/api/v1/admin/jobs${toQuery(params)}`, { token });
  },

  getJobBySlug(slug: string): Promise<JobDetail> {
    return apiFetch<JobDetail>(`/api/v1/jobs/${encodeURIComponent(slug)}`);
  },

  createJob(token: string, body: CreateJobRequest): Promise<JobDetail> {
    return apiFetch<JobDetail>("/api/v1/jobs", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
  },

  updateJob(token: string, id: string, body: UpdateJobRequest): Promise<JobDetail> {
    return apiFetch<JobDetail>(`/api/v1/jobs/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
  },

  deleteJob(token: string, id: string): Promise<void> {
    return apiFetch<void>(`/api/v1/jobs/${id}`, { method: "DELETE", token });
  },

  featureJob(token: string, id: string, body: FeatureJobRequest): Promise<JobDetail> {
    return apiFetch<JobDetail>(`/api/v1/admin/jobs/${id}/feature`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
  },
};
