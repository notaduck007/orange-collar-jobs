/** OpenAPI wire types for admin marketing campaigns (Phase 4.5). */

import type { PaginatedResponse } from "./common";

export type CampaignChannel = "email" | "sms";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";

export interface MarketingCampaign {
  readonly id: string;
  readonly name: string;
  readonly channel: CampaignChannel;
  readonly status: CampaignStatus;
  readonly segment?: Record<string, unknown>;
  readonly subject?: string | null;
  readonly htmlBody?: string | null;
  readonly textBody?: string | null;
  readonly scheduledAt?: string | null;
  readonly sentAt?: string | null;
  readonly createdAt: string;
}

export interface CreateCampaignRequest {
  readonly name: string;
  readonly channel: CampaignChannel;
  readonly segment?: Record<string, unknown>;
  readonly subject?: string;
  readonly htmlBody?: string;
  readonly textBody?: string;
  readonly scheduledAt?: string | null;
}

export interface CampaignStats {
  readonly campaignId: string;
  readonly targeted: number;
  readonly sent: number;
  readonly delivered: number;
  readonly bounced: number;
  readonly optedOut: number;
  readonly failed: number;
}

export type PaginatedCampaigns = PaginatedResponse<MarketingCampaign>;
