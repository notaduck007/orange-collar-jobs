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
