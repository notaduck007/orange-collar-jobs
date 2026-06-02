import { supabase } from "@/integrations/supabase/client";

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

export async function startImpersonation(
  targetUserId: string,
  opts: StartImpersonationOptions = {},
) {
  const { data: cur } = await supabase.auth.getSession();
  const actorSession = cur.session;
  if (!actorSession) throw new Error("Not signed in");

  const { data, error } = await supabase.functions.invoke("impersonate-user", {
    body: {
      user_id: targetUserId,
      reason: opts.reason,
      target_label: opts.label,
      target_kind: opts.kind ?? "user",
      entity_id: opts.entityId ?? targetUserId,
    },
  });
  if (error) throw error;
  const { token_hash, target_user_id, target_email, actor_id } = data as {
    token_hash: string;
    target_user_id: string;
    target_email: string;
    actor_id: string;
  };

  setImpersonation({
    actor_id,
    actor_session: {
      access_token: actorSession.access_token,
      refresh_token: actorSession.refresh_token,
    },
    target_user_id,
    target_email,
    target_label: opts.label,
    target_kind: opts.kind ?? "user",
    redirect_to: opts.redirectTo,
    started_at: new Date().toISOString(),
  });

  const { error: vErr } = await supabase.auth.verifyOtp({
    token_hash,
    type: "magiclink",
  });
  if (vErr) {
    setImpersonation(null);
    throw vErr;
  }
}

export async function stopImpersonation() {
  const s = getImpersonation();
  if (!s) return;
  try {
    await supabase.functions.invoke("stop-impersonation", {
      body: {
        actor_id: s.actor_id,
        target_user_id: s.target_user_id,
        target_label: s.target_label,
        target_kind: s.target_kind,
      },
    });
  } catch {
    // best-effort audit; restore session regardless
  }
  await supabase.auth.setSession(s.actor_session);
  setImpersonation(null);
}
