const KEY = "wj_impersonation_v1";

type ImpersonationState = {
  actor_id: string;
  actor_session: { access_token: string; refresh_token: string };
  target_user_id: string;
  target_email: string;
  target_label?: string;
  target_kind?: "user" | "company";
  redirect_to?: string;
  started_at: string;
};

export function getImpersonation(): ImpersonationState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

function setImpersonation(s: ImpersonationState | null) {
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
}

export type StartImpersonationOptions = {
  reason?: string;
  label?: string;
  kind?: "user" | "company";
  entityId?: string;
  redirectTo?: string;
};

/**
 * Impersonation requires a Supabase Edge Function that has been removed.
 * This will be re-implemented as a Nest API endpoint in a future phase.
 */
export async function startImpersonation(
  _targetUserId: string,
  _opts: StartImpersonationOptions = {},
): Promise<void> {
  throw new Error(
    "Impersonation is being migrated to the new platform and is temporarily unavailable.",
  );
}

export async function stopImpersonation(): Promise<void> {
  setImpersonation(null);
}
