import { apiFetch } from "./http";
import type { PublicCompanyProfile } from "./contracts/companies";

export const companiesApi = {
  getCompanyBySlug(slug: string): Promise<PublicCompanyProfile> {
    return apiFetch<PublicCompanyProfile>(`/api/v1/companies/slug/${encodeURIComponent(slug)}`);
  },
};
