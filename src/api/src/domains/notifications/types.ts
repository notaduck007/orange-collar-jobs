import type {
  CampaignChannel,
  CampaignStatus,
  NotificationType,
} from "../../core/database/prisma-client.js";

export type NotificationKind = "auth" | "transactional" | "marketing";
export type NotificationChannel = "email" | "sms" | "in_app";

export interface SendNotificationRequest {
  kind: NotificationKind;
  channel: NotificationChannel;
  template: string;
  userId?: string;
  to?: string;
  data?: Record<string, unknown>;
  idempotencyKey?: string;
  title?: string;
  body?: string;
  link?: string;
  type?: NotificationType;
  campaignId?: string;
}

export interface NotificationDeliveryResult {
  deliveryId: string;
  status: string;
  notificationId?: string;
}

export interface NotificationResponse {
  id: string;
  userId: string;
  title: string;
  body: string;
  link: string | null;
  type: NotificationType;
  senderId: string | null;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreferencesResponse {
  emailTransactional: boolean;
  emailMarketing: boolean;
  smsTransactional: boolean;
  smsMarketing: boolean;
  inApp: boolean;
}

export interface PaginatedNotificationsResponse {
  data: NotificationResponse[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface MarketingCampaignResponse {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  segment: Record<string, unknown>;
  subject: string | null;
  htmlBody: string | null;
  textBody: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

export interface CampaignStatsResponse {
  campaignId: string;
  targeted: number;
  sent: number;
  delivered: number;
  bounced: number;
  optedOut: number;
  failed: number;
}

export interface NotificationJobData {
  deliveryId: string;
}

export interface CampaignSendJobData {
  campaignId: string;
  userIds: string[];
  offset: number;
}
