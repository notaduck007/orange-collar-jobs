import { useQuery } from "@tanstack/react-query";

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
  branding: {
    site_name: "WarehouseJobs.com",
    logo_url: "",
    support_email: "support@warehousejobs.com",
  },
  defaults: { job_duration_days: 30, free_post_allowance: 1 },
  toggles: {
    reviews_enabled: true,
    candidate_search_enabled: true,
    require_email_verification: false,
  },
  flags: {},
};

export function useSiteSettings() {
  const { data, isLoading } = useQuery({
    queryKey: ["public-site-settings"],
    staleTime: Infinity,
    queryFn: async (): Promise<PublicSettings> => DEFAULTS,
  });
  return { settings: data ?? DEFAULTS, loading: isLoading };
}

export function useFeatureFlag(key: string): boolean {
  const { settings } = useSiteSettings();
  const f = settings.flags[key];
  if (!f || !f.enabled) return false;
  if (f.rollout_pct >= 100) return true;
  const hash = Array.from(key).reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 100 < f.rollout_pct;
}
