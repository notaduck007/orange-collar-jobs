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

export function levelCapabilities(level: AdminLevel | null | undefined): AdminCapability[] {
  return level ? MAP[level] : [];
}

export function useAdminPermissions() {
  const { user, role } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-permissions", user?.id],
    enabled: !!user && role === "admin",
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_permissions")
        .select("level")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data?.level as AdminLevel | undefined) ?? null;
    },
  });

  const level = data ?? null;
  const caps = levelCapabilities(level);
  return {
    loading: isLoading,
    level,
    capabilities: caps,
    can: (c: AdminCapability) => caps.includes(c),
  };
}
