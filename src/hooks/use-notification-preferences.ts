import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-session";
import type { UpdateNotificationPreferencesRequest } from "@/lib/api/contracts/notifications";
import { NOTIFICATIONS_INBOX_KEY } from "./use-notifications-inbox";

export const NOTIFICATION_PREFERENCES_KEY = "notification-preferences";

export function useNotificationPreferences() {
  const token = getAccessToken();

  return useQuery({
    queryKey: [NOTIFICATION_PREFERENCES_KEY],
    enabled: !!token,
    queryFn: () => apiClient.getNotificationPreferences(token!),
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  const token = getAccessToken();

  return useMutation({
    mutationFn: (body: UpdateNotificationPreferencesRequest) =>
      apiClient.updateNotificationPreferences(token!, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [NOTIFICATION_PREFERENCES_KEY] });
      toast.success("Notification preferences saved.");
    },
    onError: (err: Error) => toast.error(err.message || "Could not save preferences."),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const token = getAccessToken();

  return useMutation({
    mutationFn: (id: string) => apiClient.markNotificationRead(token!, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [NOTIFICATIONS_INBOX_KEY] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const token = getAccessToken();

  return useMutation({
    mutationFn: () => apiClient.markAllNotificationsRead(token!),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: [NOTIFICATIONS_INBOX_KEY] });
      toast.success(`Marked ${res.updated} notification(s) as read.`);
    },
  });
}
