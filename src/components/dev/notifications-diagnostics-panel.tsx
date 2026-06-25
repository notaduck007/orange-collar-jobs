import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-session";
import { useNotificationSync } from "@/hooks/use-notification-sync";
import { useNotificationsInbox } from "@/hooks/use-notifications-inbox";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function NotificationsDiagnosticsPanel() {
  const token = getAccessToken();
  const { connected, lastSyncAt, sync } = useNotificationSync(!!token);
  const inboxQ = useNotificationsInbox({ pageSize: 5, unreadOnly: false });
  const [markResult, setMarkResult] = useState<string | null>(null);

  const runMarkAll = async () => {
    if (!token) return;
    setMarkResult(null);
    try {
      const res = await apiClient.markAllNotificationsRead(token);
      setMarkResult(`Marked ${res.updated} read`);
      sync();
    } catch (err) {
      setMarkResult(err instanceof ApiError ? `HTTP ${err.statusCode}` : String(err));
    }
  };

  return (
    <Card title="Notifications  ·  FE-4.5 inbox sync">
      <div data-testid="notifications-diagnostics-panel" className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Poll-based inbox sync (5s). Socket.IO push when gateway exposes HTTP upgrade.
        </p>
        <div className="flex flex-wrap gap-4 text-xs">
          <span>
            Sync:{" "}
            <strong className={connected ? "text-green-700" : "text-red-700"}>
              {token ? (connected ? "active" : "idle") : "no token"}
            </strong>
          </span>
          <span>Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "—"}</span>
          <span>
            Inbox rows: {inboxQ.data?.meta.total ?? "…"} (showing {inboxQ.data?.data.length ?? 0})
          </span>
        </div>
        <button
          type="button"
          disabled={!token}
          onClick={() => void runMarkAll()}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          POST /api/v1/notifications/read-all
        </button>
        {markResult && (
          <pre className="rounded-md bg-muted p-2 font-mono text-xs">{markResult}</pre>
        )}
        {inboxQ.data?.data[0] && (
          <pre className="max-h-32 overflow-auto rounded-md bg-muted p-2 font-mono text-xs">
            {JSON.stringify(inboxQ.data.data[0], null, 2)}
          </pre>
        )}
      </div>
    </Card>
  );
}
