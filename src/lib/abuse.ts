import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Returns true if the user has a confirmed email, OR if verification isn't required. */
export function emailIsVerified(user: User | null, requireVerification: boolean): boolean {
  if (!requireVerification) return true;
  if (!user) return false;
  return !!user.email_confirmed_at || !!user.confirmed_at;
}

/**
 * Atomically check + increment a rate-limit bucket via Postgres RPC.
 * Returns true if the action is allowed, false if the user is over the limit.
 */
export async function checkRateLimit(
  key: string,
  windowSeconds: number,
  max: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "check_rate_limit" as never,
    {
      _key: key,
      _window_seconds: windowSeconds,
      _max: max,
    } as never,
  );
  if (error) {
    // Fail-open on infra errors so legitimate users aren't blocked.
    // eslint-disable-next-line no-console
    console.warn("rate-limit RPC failed", error);
    return true;
  }
  return data !== false;
}

/** Common limit presets. */
export const LIMITS = {
  applyPerHour: { windowSeconds: 3600, max: 10 },
  jobPostPerDay: { windowSeconds: 86_400, max: 20 },
} as const;
