import { useEffect, useState } from "react";
import { Eye, LogOut } from "lucide-react";
import { getImpersonation, stopImpersonation } from "@/lib/impersonation";
import { supabase } from "@/integrations/supabase/client";

export function ImpersonationBanner() {
  const [state, setState] = useState(() => getImpersonation());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setState(getImpersonation());
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.includes("impersonation")) sync();
    };
    window.addEventListener("storage", onStorage);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => sync());
    return () => {
      window.removeEventListener("storage", onStorage);
      subscription.unsubscribe();
    };
  }, []);

  if (!state) return null;

  const onExit = async () => {
    setBusy(true);
    try {
      await stopImpersonation();
      setState(null);
      window.location.assign("/admin");
    } finally {
      setBusy(false);
    }
  };

  const label = state.target_label || state.target_email;

  return (
    <div className="sticky top-0 z-[100] flex items-center justify-between gap-3 border-b-2 border-amber-500 bg-amber-100 px-4 py-2 text-sm text-amber-900 shadow-sm dark:bg-amber-950/80 dark:text-amber-100">
      <div className="flex items-center gap-2 truncate">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">
          <strong>Viewing as</strong> {label}
          {state.target_label && state.target_email && (
            <span className="ml-1 opacity-70">({state.target_email})</span>
          )}
          <span className="ml-2 opacity-70">
            · since {new Date(state.started_at).toLocaleTimeString()}
          </span>
        </span>
      </div>
      <button
        onClick={onExit}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-900 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-800 disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" />
        {busy ? "Exiting…" : "Exit to admin"}
      </button>
    </div>
  );
}
