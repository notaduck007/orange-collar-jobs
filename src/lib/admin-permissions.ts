import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AdminLevel = "super_admin" | "moderator" | "finance" | "support";
export type AdminCapability =
  | "moderation"
  | "billing"
  | "users"
  | "settings"
  | "ads"
  | "support";

const MAP: Record<AdminLevel, AdminCapability[]> = {
  super_admin: ["moderation", "billing", "users", "settings", "ads", "support"],
  moderator: ["moderation", "ads", "support"],
  finance: ["billing"],
  support: ["support", "users"],
};

const ALL_CAPS: AdminCapability[] = ["moderation", "billing", "users", "settings", "ads", "support"];

export function levelCapabilities(level: AdminLevel | null | undefined): AdminCapability[] {
  return level ? MAP[level] : [];
}

export function useAdminPermissions() {
  const { user, role, permissions } = useAuth();
  const isAdmin = role === "admin";
  const hasWildcard = permissions.includes("*");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-permissions", user?.id],
    // Skip the legacy lookup for super admins — they bypass capability checks entirely.
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_permissions")
        .select("level")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data?.level as AdminLevel | undefined) ?? null;
    },
  });

  // Super admin (system 'admin' role) bypass: always has every capability.
  if (isAdmin || hasWildcard) {
    return {
      loading: false,
      level: "super_admin" as AdminLevel,
      capabilities: ALL_CAPS,
      can: (_c: AdminCapability) => true,
    };
  }

  const level = data ?? null;
  const caps = levelCapabilities(level);
  return {
    loading: isLoading,
    level,
    capabilities: caps,
    can: (c: AdminCapability) => caps.includes(c),
  };
}
