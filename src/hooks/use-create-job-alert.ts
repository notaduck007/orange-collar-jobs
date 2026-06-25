import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AuthUser, AppRole } from "@/lib/auth";

/** Job alerts remain on Supabase until Phase 5 notifications — isolated from FE-3 jobs board. */
export function useCreateJobAlertFromSearch() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  return async (
    user: AuthUser | null,
    role: AppRole | null,
    search: { q?: string; loc?: string; category?: string },
  ) => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login", next: "/jobs" } as never });
      return;
    }
    if (role && role !== "job_seeker" && role !== "admin") {
      toast.error("Only job seekers can create alerts.");
      return;
    }
    if (!search.q && !search.loc && !search.category) {
      toast.error("Add a keyword, location, or category to create an alert.");
      return;
    }
    const [city, state] = (search.loc ?? "").split(",").map((s: string) => s.trim());
    const { error } = await supabase.from("job_alerts").insert({
      applicant_id: user.id,
      keyword: search.q || null,
      city: city || null,
      state: state ? state.toUpperCase().slice(0, 2) : null,
      frequency: "daily",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Alert created — manage it in your dashboard.");
      qc.invalidateQueries({ queryKey: ["seeker-alerts", user.id] });
    }
  };
}
