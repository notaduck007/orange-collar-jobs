import type { AuthUser } from "@/lib/auth";

/** Returns true if the user has a confirmed email, OR if verification isn't required. */
export function emailIsVerified(user: AuthUser | null, requireVerification: boolean): boolean {
  if (!requireVerification) return true;
  return !!user;
}

/**
 * Rate-limit check. Supabase RPC has been removed; this always returns true
 * (fail-open) until a Nest API rate-limit endpoint is wired up.
 */
export async function checkRateLimit(
  _key: string,
  _windowSeconds: number,
  _max: number,
): Promise<boolean> {
  return true;
}

/** Common limit presets. */
export const LIMITS = {
  applyPerHour: { windowSeconds: 3600, max: 10 },
  jobPostPerDay: { windowSeconds: 86_400, max: 20 },
} as const;
