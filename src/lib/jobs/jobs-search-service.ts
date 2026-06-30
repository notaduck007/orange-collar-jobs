import type { JobSummary } from "@/components/job-card";
import { apiClient } from "@/lib/api-client";
import { buildJobSearchParams, mapJobSummaryToCard } from "@/lib/jobs/job-mappers";
import type { JobsUrlSearch } from "@/lib/jobs/types";

export const JOBS_PAGE_SIZE = 20;

export async function fetchJobsSearchPage(
  search: JobsUrlSearch,
  page: number,
): Promise<{ jobs: JobSummary[]; total: number; page: number; totalPages: number }> {
  const params = buildJobSearchParams({ ...search, page, pageSize: JOBS_PAGE_SIZE });
  const res = await apiClient.searchJobs(params);
  return {
    jobs: res.data.map(mapJobSummaryToCard),
    total: res.meta.total,
    page: res.meta.page,
    totalPages: res.meta.totalPages,
  };
}

/** Paginate public search until all rows for a company slug are collected. */
export async function fetchJobsForCompanySlug(companySlug: string) {
  const company = await apiClient.getCompanyBySlug(companySlug);
  const rows: Awaited<ReturnType<typeof apiClient.searchJobs>>["data"] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const res = await apiClient.searchJobs({ companyId: company.id, page, pageSize: 50 });
    totalPages = res.meta.totalPages;
    rows.push(...res.data);
    page += 1;
  }
  return rows;
}
