import { apiClient } from "@/lib/api-client";
import { mapJobSummaryToCard } from "@/lib/jobs/job-mappers";
import type { JobSummary } from "@/components/job-card";
import type { PublicCompanyProfile } from "@/lib/api/contracts/companies";

/** Legacy snake_case shape used by the company profile route template. */
export interface CompanyPageModel {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  website: string | null;
  logo_url: string | null;
  hq_city: string | null;
  hq_state: string | null;
  industry: string | null;
  verified: boolean;
}

export function mapPublicCompanyToPage(company: PublicCompanyProfile): CompanyPageModel {
  return {
    id: company.id,
    name: company.name,
    description: company.description,
    location: company.location,
    website: company.website,
    logo_url: company.logoUrl,
    hq_city: company.hqCity,
    hq_state: company.hqState,
    industry: company.industry,
    verified: company.verified,
  };
}

/** Load employer profile + all listable jobs for `/companies/$slug`. */
export async function fetchCompanyProfilePage(slug: string): Promise<{
  company: CompanyPageModel | null;
  jobs: JobSummary[];
}> {
  try {
    const company = await apiClient.getCompanyBySlug(slug);
    const jobs: JobSummary[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const res = await apiClient.searchJobs({ companyId: company.id, page, pageSize: 50 });
      totalPages = res.meta.totalPages;
      jobs.push(
        ...res.data.map((job) =>
          mapJobSummaryToCard({
            ...job,
            company: job.company ?? {
              name: company.name,
              slug: company.slug,
              verified: company.verified,
            },
          }),
        ),
      );
      page += 1;
    }
    return { company: mapPublicCompanyToPage(company), jobs };
  } catch {
    return { company: null, jobs: [] };
  }
}
