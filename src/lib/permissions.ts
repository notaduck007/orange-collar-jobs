import { useAuth } from "@/lib/auth";

/** Permission keys mirror the public.permissions catalog. */
export type PermissionKey =
  | "jobs.moderate"
  | "jobs.delete_any"
  | "jobs.edit_any"
  | "companies.view_all"
  | "companies.edit_any"
  | "companies.suspend"
  | "companies.verify"
  | "applications.view_all"
  | "applications.edit_any"
  | "orders.view_all"
  | "orders.refund"
  | "orders.edit_any"
  | "packages.manage"
  | "ads.manage"
  | "users.view_all"
  | "users.manage_roles"
  | "users.suspend"
  | "users.delete"
  | "roles.manage"
  | "impersonate.use"
  | "settings.manage"
  | "moderation.manage"
  | "analytics.view"
  | "audit.view";

/** True when the current user holds the given permission. Admins implicitly hold all. */
export function usePermission(key: PermissionKey): boolean {
  const { role, permissions } = useAuth();
  if (role === "admin") return true;
  if (permissions.includes("*")) return true;
  return permissions.includes(key);
}

/** Convenience: check any one of a list. */
export function useAnyPermission(keys: PermissionKey[]): boolean {
  const { role, permissions } = useAuth();
  if (role === "admin") return true;
  if (permissions.includes("*")) return true;
  return keys.some((k) => permissions.includes(k));
}

/** True when the user has any admin-side capability at all (besides being the admin role). */
export function useHasAnyAdminAccess(): boolean {
  const { role, permissions } = useAuth();
  return role === "admin" || permissions.length > 0;
}
