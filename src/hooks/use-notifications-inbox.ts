import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-session";
import type { InboxQuery } from "@/lib/api/contracts/notifications";

export const NOTIFICATIONS_INBOX_KEY = "notifications-inbox";

export function useNotificationsInbox(params?: InboxQuery) {
  const token = getAccessToken();

  return useQuery({
    queryKey: [NOTIFICATIONS_INBOX_KEY, params?.unreadOnly, params?.page],
    enabled: !!token,
    queryFn: () => apiClient.listNotifications(token!, params),
    refetchInterval: 5_000,
  });
}

export function useUnreadNotificationCount() {
  const q = useNotificationsInbox({ unreadOnly: true, pageSize: 1 });
  const total = q.data?.meta.total ?? 0;
  return { count: total, ...q };
}

export function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: [NOTIFICATIONS_INBOX_KEY] });
}
