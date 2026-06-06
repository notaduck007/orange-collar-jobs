import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import type { Row } from "@/lib/row-types";

export const Route = createFileRoute("/seeker/saved")({
  head: () => ({ meta: [{ title: "Saved Jobs — WarehouseJobs.com" }] }),
  component: SavedJobsPage,
});

function SavedJobsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ["seeker-saved", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_jobs")
        .select(
          "id, created_at, jobs(id, slug, title, location, shift, pay_min, pay_max, pay_period, companies(name))",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    const { error } = await supabase.from("saved_jobs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Removed from saved");
      qc.invalidateQueries({ queryKey: ["seeker-saved", user?.id] });
      qc.invalidateQueries({ queryKey: ["seeker-stats", user?.id] });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="label-caps text-primary">Bookmarks</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          Saved jobs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{saved.length} bookmarked</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : saved.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-base font-semibold text-[color:var(--ink)]">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookmark jobs while you browse and come back to them later.
          </p>
          <Button asChild className="btn-primary mt-4">
            <Link to="/jobs">Browse jobs</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {saved.map((s: Row) => {
            const j = s.jobs;
            if (!j) return null;
            const pay =
              j.pay_min && j.pay_max
                ? `$${j.pay_min}–$${j.pay_max} / ${j.pay_period ?? "hour"}`
                : null;
            return (
              <div
                key={s.id}
                className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <Link
                    to="/jobs/$slug"
                    params={{ slug: j.slug }}
                    className="text-base font-semibold text-[color:var(--ink)] hover:text-primary"
                  >
                    {j.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{j.companies?.name}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {j.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {j.shift}
                    </span>
                    {pay && <span className="font-semibold text-[color:var(--ink)]">{pay}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(s.id)}
                  className="shrink-0 text-muted-foreground hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
