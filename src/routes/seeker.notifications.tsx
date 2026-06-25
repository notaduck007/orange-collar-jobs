import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/hooks/use-notification-preferences";
import { useNotificationSync } from "@/hooks/use-notification-sync";
import { useNotificationsInbox } from "@/hooks/use-notifications-inbox";

export const Route = createFileRoute("/seeker/notifications")({
  head: () => ({ meta: [{ title: "Notifications — WarehouseJobs.com" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const inboxQ = useNotificationsInbox({ pageSize: 50 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  useNotificationSync();

  const items = inboxQ.data?.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6" data-testid="notifications-inbox">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps text-primary">Inbox</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Updates from applications, employers, and the platform — synced from the Nest API.
          </p>
        </div>
        {unread > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={markAll.isPending}
            onClick={() => markAll.mutate()}
          >
            {markAll.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            Mark all read
          </Button>
        )}
      </div>

      {inboxQ.isLoading && (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications…
        </div>
      )}

      {inboxQ.isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load notifications. Ensure you are signed in and the API is running.
        </p>
      )}

      {!inboxQ.isLoading && !inboxQ.isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      )}

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((n) => (
          <li
            key={n.id}
            className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between ${
              n.read ? "opacity-80" : "bg-[color:var(--primary-tint)]/30"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[color:var(--ink)]">{n.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {n.type} · {new Date(n.createdAt).toLocaleString()}
              </p>
              {n.link && (
                <Link
                  to={n.link as never}
                  className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
                >
                  View
                </Link>
              )}
            </div>
            {!n.read && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                disabled={markRead.isPending}
                onClick={() => markRead.mutate(n.id)}
              >
                Mark read
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
