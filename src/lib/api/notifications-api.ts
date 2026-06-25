import { apiFetch } from "./http";
import type {
  InboxQuery,
  MarkAllReadResponse,
  NotificationPreferences,
  NotificationRecord,
  PaginatedNotifications,
  UpdateNotificationPreferencesRequest,
} from "./contracts/notifications";

function inboxQuery(params?: InboxQuery): string {
  const q = new URLSearchParams();
  if (params?.unreadOnly) q.set("unreadOnly", "true");
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export const notificationsApi = {
  listInbox(token: string, params?: InboxQuery): Promise<PaginatedNotifications> {
    return apiFetch<PaginatedNotifications>(`/api/v1/notifications${inboxQuery(params)}`, {
      token,
    });
  },

  markRead(token: string, id: string): Promise<NotificationRecord> {
    return apiFetch<NotificationRecord>(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
      token,
    });
  },

  markAllRead(token: string): Promise<MarkAllReadResponse> {
    return apiFetch<MarkAllReadResponse>("/api/v1/notifications/read-all", {
      method: "POST",
      token,
    });
  },

  getPreferences(token: string): Promise<NotificationPreferences> {
    return apiFetch<NotificationPreferences>("/api/v1/notifications/preferences", { token });
  },

  updatePreferences(
    token: string,
    body: UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferences> {
    return apiFetch<NotificationPreferences>("/api/v1/notifications/preferences", {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
  },
};
