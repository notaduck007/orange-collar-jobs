import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Returns the set of job IDs the current user has applied to. */
export function useAppliedJobs() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["seeker-applied-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("job_id")
        .eq("applicant_id", user!.id);
      return (data ?? []).map((r) => r.job_id);
    },
  });
  return useMemo(() => new Set(data ?? []), [data]);
}

/** Returns whether the current user can quick-apply (resume + headline). */
export function useQuickApplyReady() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["seeker-quickapply-ready", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: prof }, { data: seeker }] = await Promise.all([
        supabase
          .from("profiles")
          .select("default_resume_url, full_name, display_name")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase.from("seeker_profiles").select("headline").eq("user_id", user!.id).maybeSingle(),
      ]);
      const hasName = !!(prof?.full_name || prof?.display_name);
      void seeker;
      return {
        ready: hasName,
        resumeUrl: prof?.default_resume_url ?? null,
      };
    },
  });
  return data ?? { ready: false, resumeUrl: null };
}
