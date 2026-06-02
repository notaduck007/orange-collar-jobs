/**
 * Loose row type for use in callbacks over Supabase query results whose
 * shape is too dynamic to type from generated `Tables<...>` (e.g. aggregated
 * dashboard queries, joined selects with relations, jsonb snapshots).
 *
 * Prefer `Tables<"name">` from `@/integrations/supabase/types` when the row
 * is a plain table read. Use `Row` only at boundaries where strict typing
 * would require disproportionate plumbing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

/** Safely extract a human-readable message from an unknown thrown value. */
export function errMsg(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}
