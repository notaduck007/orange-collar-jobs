import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BrandingSettings = {
  site_name: string;
  logo_url: string;
  support_email: string;
};

export type DefaultsSettings = {
  job_duration_days: number;
  free_post_allowance: number;
};

export type ToggleSettings = {
  reviews_enabled: boolean;
  candidate_search_enabled: boolean;
  require_email_verification: boolean;
};

export type FeatureFlag = { enabled: boolean; rollout_pct: number };

export type PublicSettings = {
  branding: BrandingSettings;
  defaults: DefaultsSettings;
  toggles: ToggleSettings;
  flags: Record<string, FeatureFlag>;
};

const DEFAULTS: PublicSettings = {
  branding: { site_name: "WarehouseJobs", logo_url: "", support_email: "support@example.com" },
  defaults: { job_duration_days: 30, free_post_allowance: 1 },
  toggles: { reviews_enabled: true, candidate_search_enabled: true, require_email_verification: false },
  flags: {},
};

export function useSiteSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-site-settings"],
    staleTime: 60_000,
    queryFn: async (): Promise<PublicSettings> => {
      const { data, error } = await supabase.rpc("get_public_settings");
      if (error || !data) return DEFAULTS;
      const raw = data as { settings?: Record<string, unknown>; flags?: Record<string, FeatureFlag> };
      const s = raw.settings ?? {};
      return {
        branding: { ...DEFAULTS.branding, ...((s.branding as Partial<BrandingSettings>) ?? {}) },
        defaults: { ...DEFAULTS.defaults, ...((s.defaults as Partial<DefaultsSettings>) ?? {}) },
        toggles: { ...DEFAULTS.toggles, ...((s.toggles as Partial<ToggleSettings>) ?? {}) },
        flags: raw.flags ?? {},
      };
    },
  });
  return { settings: data ?? DEFAULTS, loading: isLoading };
}

export function useFeatureFlag(key: string): boolean {
  const { settings } = useSiteSettings();
  const f = settings.flags[key];
  if (!f || !f.enabled) return false;
  if (f.rollout_pct >= 100) return true;
  // Deterministic-ish: per session
  const hash = Array.from(key).reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 100 < f.rollout_pct;
}
