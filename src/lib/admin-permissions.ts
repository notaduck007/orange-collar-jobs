import { useAuth } from "@/lib/auth";

export type AdminLevel = "super_admin" | "moderator" | "finance" | "support";
export type AdminCapability = "moderation" | "billing" | "users" | "settings" | "ads" | "support";

/** Capability → required RBAC permission keys. Holding ANY of the listed
 * permission keys grants the capability. */
const CAPABILITY_KEYS: Record<AdminCapability, string[]> = {
  moderation: ["moderation.manage", "jobs.moderate"],
  billing: ["orders.view_all", "orders.refund", "orders.edit_any", "packages.manage"],
  users: ["users.view_all", "users.manage_roles", "users.suspend"],
  settings: ["settings.manage"],
  ads: ["ads.manage"],
  support: ["moderation.manage"],
};


const ALL_CAPS: AdminCapability[] = [
  "moderation",
  "billing",
  "users",
  "settings",
  "ads",
  "support",
];

export function levelCapabilities(level: AdminLevel | null | undefined): AdminCapability[] {
  if (!level) return [];
  if (level === "super_admin") return ALL_CAPS;
  if (level === "moderator") return ["moderation", "ads", "support"];
  if (level === "finance") return ["billing"];
  if (level === "support") return ["support", "users"];
  return [];
}

export function useAdminPermissions() {
  const { user, role, permissions } = useAuth();
  const isAdmin = role === "admin";
  const hasWildcard = permissions.includes("*");

  if (!user) {
    return {
      loading: false,
      level: null as AdminLevel | null,
      capabilities: [] as AdminCapability[],
      can: (_c: AdminCapability) => false,
    };
  }

  if (isAdmin || hasWildcard) {
    return {
      loading: false,
      level: "super_admin" as AdminLevel,
      capabilities: ALL_CAPS,
      can: (_c: AdminCapability) => true,
    };
  }

  const has = (cap: AdminCapability) => CAPABILITY_KEYS[cap].some((k) => permissions.includes(k));
  const caps = ALL_CAPS.filter(has);

  return {
    loading: false,
    level: null as AdminLevel | null,
    capabilities: caps,
    can: has,
  };

}
