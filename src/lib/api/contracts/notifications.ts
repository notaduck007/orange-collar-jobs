/** OpenAPI wire types for notifications inbox + preferences (Phase 4.5). */

import type { PaginatedResponse } from "./common";

export type NotificationType = "system" | "application" | "message" | "marketing" | "auth";

export interface NotificationRecord {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly type: NotificationType;
  readonly senderId: string | null;
  readonly read: boolean;
  readonly readAt: string | null;
  readonly createdAt: string;
}

export interface NotificationPreferences {
  readonly emailTransactional: boolean;
  readonly emailMarketing: boolean;
  readonly smsTransactional: boolean;
  readonly smsMarketing: boolean;
  readonly inApp: boolean;
}

export type UpdateNotificationPreferencesRequest = Partial<NotificationPreferences>;

export interface InboxQuery {
  readonly unreadOnly?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
}

export type PaginatedNotifications = PaginatedResponse<NotificationRecord>;

export interface MarkAllReadResponse {
  readonly updated: number;
}
