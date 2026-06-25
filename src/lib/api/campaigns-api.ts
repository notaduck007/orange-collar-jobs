import { apiFetch } from "./http";
import type {
  CampaignStats,
  CampaignStatus,
  CreateCampaignRequest,
  MarketingCampaign,
  PaginatedCampaigns,
} from "./contracts/campaigns";

function campaignQuery(status?: CampaignStatus, page?: number, pageSize?: number): string {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (page) q.set("page", String(page));
  if (pageSize) q.set("pageSize", String(pageSize));
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export const campaignsApi = {
  listCampaigns(
    token: string,
    params?: { status?: CampaignStatus; page?: number; pageSize?: number },
  ): Promise<PaginatedCampaigns> {
    return apiFetch<PaginatedCampaigns>(
      `/api/v1/admin/campaigns${campaignQuery(params?.status, params?.page, params?.pageSize)}`,
      { token },
    );
  },

  getCampaign(token: string, id: string): Promise<MarketingCampaign> {
    return apiFetch<MarketingCampaign>(`/api/v1/admin/campaigns/${encodeURIComponent(id)}`, {
      token,
    });
  },

  createCampaign(token: string, body: CreateCampaignRequest): Promise<MarketingCampaign> {
    return apiFetch<MarketingCampaign>("/api/v1/admin/campaigns", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
  },

  sendCampaign(token: string, id: string): Promise<MarketingCampaign> {
    return apiFetch<MarketingCampaign>(`/api/v1/admin/campaigns/${encodeURIComponent(id)}/send`, {
      method: "POST",
      token,
    });
  },

  getCampaignStats(token: string, id: string): Promise<CampaignStats> {
    return apiFetch<CampaignStats>(`/api/v1/admin/campaigns/${encodeURIComponent(id)}/stats`, {
      token,
    });
  },
};
