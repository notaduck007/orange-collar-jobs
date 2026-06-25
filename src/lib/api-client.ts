/**
 * Typed fetch wrapper for the NestJS API at VITE_API_BASE_URL.
 *
 * Composition root: auth methods live here; jobs/batch are delegated to submodules (SRP).
 */
import { getAuthSession, storeTokens, clearAuthSession } from "@/lib/auth-session";
import { batchApi } from "@/lib/api/batch-api";
import { campaignsApi } from "@/lib/api/campaigns-api";
import { jobsApi } from "@/lib/api/jobs-api";
import { notificationsApi } from "@/lib/api/notifications-api";
import { ApiError, apiFetch, getApiBaseUrl } from "@/lib/api/http";
import type {
  AuthTokensResponse,
  HealthResponse,
  MeResponse,
  MessageResponse,
  RegisterRequest,
  RegisterResponse,
  Verify2faRequest,
} from "@/lib/api/contracts/auth";
import type {
  CompanyProfile,
  UpsertCompanyBody,
  AdminCompanyRecord,
  AdminUpdateCompanyBody,
} from "@/lib/api/contracts/companies";
export type { AdminCompanyRecord, AdminUpdateCompanyBody };

export { ApiError, getApiBaseUrl };
export type { ApiFetchOptions } from "@/lib/api/http";
export type * from "@/lib/api/contracts";

export const apiClient = {
  health(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>("/api/health");
  },

  me(token: string): Promise<MeResponse> {
    return apiFetch<MeResponse>("/api/v1/me", { token });
  },

  register(body: RegisterRequest): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  login(email: string, password: string): Promise<AuthTokensResponse> {
    return apiFetch<AuthTokensResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async loginAndStore(email: string, password: string): Promise<AuthTokensResponse> {
    const tokens = await apiClient.login(email, password);
    storeTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
    return tokens;
  },

  logout(token: string): Promise<void> {
    return apiFetch<void>("/api/v1/auth/logout", { method: "POST", token });
  },

  async logoutAndClear(token: string): Promise<void> {
    try {
      await apiClient.logout(token);
    } finally {
      clearAuthSession();
    }
  },

  refresh(refreshToken: string): Promise<AuthTokensResponse> {
    return apiFetch<AuthTokensResponse>("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },

  async refreshStoredSession(): Promise<AuthTokensResponse | null> {
    const session = getAuthSession();
    if (!session?.refreshToken) return null;
    try {
      const tokens = await apiClient.refresh(session.refreshToken);
      storeTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
      return tokens;
    } catch {
      clearAuthSession();
      return null;
    }
  },

  verifyEmail(token: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  forgotPassword(email: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, password: string): Promise<MessageResponse> {
    return apiFetch<MessageResponse>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },

  verify2fa(body: Verify2faRequest): Promise<AuthTokensResponse> {
    return apiFetch<AuthTokensResponse>("/api/v1/auth/verify-2fa", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async verify2faAndStore(body: Verify2faRequest): Promise<AuthTokensResponse> {
    const tokens = await apiClient.verify2fa(body);
    storeTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
    return tokens;
  },

  // Jobs (FE-3)
  searchJobs: jobsApi.searchJobs,
  listMyJobs: jobsApi.listMyJobs,
  adminListJobs: jobsApi.adminListJobs,
  getJobBySlug: jobsApi.getJobBySlug,
  createJob: jobsApi.createJob,
  updateJob: jobsApi.updateJob,
  deleteJob: jobsApi.deleteJob,
  featureJob: jobsApi.featureJob,

  // Batch (FE-4)
  submitBatch: batchApi.submitBatch,
  getBatchStatus: batchApi.getBatchStatus,

  // Admin — Companies
  adminListCompanies(
    token: string,
    params: { q?: string; verificationStatus?: string; status?: string; page?: number } = {},
  ): Promise<{
    data: AdminCompanyRecord[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.verificationStatus) qs.set("verificationStatus", params.verificationStatus);
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    return apiFetch(`/api/v1/admin/companies?${qs}`, { token });
  },
  adminUpdateCompany(
    token: string,
    id: string,
    body: AdminUpdateCompanyBody,
  ): Promise<AdminCompanyRecord> {
    return apiFetch(`/api/v1/admin/companies/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
  },

  // Companies
  getMyCompany(token: string): Promise<CompanyProfile> {
    return apiFetch<CompanyProfile>("/api/v1/companies/mine", { token });
  },
  createCompany(token: string, body: UpsertCompanyBody): Promise<CompanyProfile> {
    return apiFetch<CompanyProfile>("/api/v1/companies", {
      method: "POST",
      token,
      body: JSON.stringify(body),
    });
  },
  updateCompany(token: string, id: string, body: UpsertCompanyBody): Promise<CompanyProfile> {
    return apiFetch<CompanyProfile>(`/api/v1/companies/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
  },

  // Uploads
  async uploadLogo(token: string, file: File): Promise<{ url: string; key: string }> {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<{ url: string; key: string }>("/api/v1/uploads/logo", {
      method: "POST",
      token,
      body: form,
    });
  },

  // Notifications (FE-4.5)
  listNotifications: notificationsApi.listInbox,
  markNotificationRead: notificationsApi.markRead,
  markAllNotificationsRead: notificationsApi.markAllRead,
  getNotificationPreferences: notificationsApi.getPreferences,
  updateNotificationPreferences: notificationsApi.updatePreferences,

  // Admin campaigns (FE-4.5)
  listCampaigns: campaignsApi.listCampaigns,
  getCampaign: campaignsApi.getCampaign,
  createCampaign: campaignsApi.createCampaign,
  sendCampaign: campaignsApi.sendCampaign,
  getCampaignStats: campaignsApi.getCampaignStats,
};
