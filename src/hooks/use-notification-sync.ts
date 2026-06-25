import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth-session";
import { NOTIFICATIONS_INBOX_KEY } from "./use-notifications-inbox";

/**
 * Poll-based inbox sync (Phase 4.5).
 * Full Socket.IO namespace `/notifications` lands when the gateway exposes HTTP upgrade;
 * until then we refetch inbox every few seconds and on tab focus.
 */
export function useNotificationSync(enabled = true) {
  const qc = useQueryClient();
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sync = useCallback(() => {
    const token = getAccessToken();
    if (!token) {
      setConnected(false);
      return;
    }
    void qc.invalidateQueries({ queryKey: [NOTIFICATIONS_INBOX_KEY] });
    setLastSyncAt(Date.now());
    setConnected(true);
  }, [qc]);

  useEffect(() => {
    if (!enabled) return;

    sync();
    timerRef.current = setInterval(sync, 5_000);

    const onFocus = () => sync();
    window.addEventListener("focus", onFocus);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, qc, sync]);

  return { connected, lastSyncAt, sync };
}
