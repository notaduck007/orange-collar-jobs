import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Check, Pencil, Pause, Play, X, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type JobStatus = Database["public"]["Enums"]["job_status"];

const searchSchema = z.object({
  status: z.string().optional(),
  company: z.string().optional(),
  category: z.string().optional(),
});

export const Route = createFileRoute("/admin/jobs")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Jobs — WarehouseJobs.com Admin" }] }),
  component: AdminJobs,
});

const STATUSES: JobStatus[] = [
  "draft",
  "pending_review",
  "published",
  "active",
  "paused",
  "closed",
  "expired",
];

function AdminJobs() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["job-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("job_categories").select("name").order("name");
      return data ?? [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["admin-jobs", search],
    queryFn: async () => {
      let q = supabase
        .from("jobs")
        .select(
          "id, slug, title, status, featured, views, category, created_at, expires_at, company_id, companies(name)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (search.status) q = q.eq("status", search.status as JobStatus);
      if (search.company) q = q.eq("company_id", search.company);
      if (search.category) q = q.eq("category", search.category);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = async (id: string, status: JobStatus) => {
    const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Job ${status}`);
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
    }
  };
  const toggleFeatured = async (id: string, featured: boolean) => {
    const { error } = await supabase.from("jobs").update({ featured: !featured }).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-jobs"] });
  };
  const deleteJob = async (id: string) => {
    if (!confirm("Permanently delete this job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
    }
  };

  const update = (patch: Partial<typeof search>) =>
    navigate({ to: "/admin/jobs", search: { ...search, ...patch } });

  return (
    <div>
      <div className="mb-6">
        <p className="label-caps">Moderation</p>
        <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">All jobs</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          value={search.status ?? "all"}
          onValueChange={(v) => update({ status: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.category ?? "all"}
          onValueChange={(v) => update({ category: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search.status || search.category || search.company) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/admin/jobs", search: {} })}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-2">
        {jobs.map((j) => (
          <div
            key={j.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/jobs/$slug"
                  params={{ slug: j.slug }}
                  className="font-semibold text-[color:var(--ink)] hover:text-primary"
                >
                  {j.title}
                </Link>
                <StatusBadge status={j.status} />
                {j.featured && (
                  <Badge className="border-0 bg-[color:var(--hazard)] text-[color:var(--ink)]">
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {j.companies?.name ?? "—"} · {j.category} · {j.views} views · posted{" "}
                {new Date(j.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {j.status === "pending_review" && (
                <Button
                  size="sm"
                  onClick={() => setStatus(j.id, "active")}
                  className="btn-primary gap-1"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
              )}
              <Link to="/employer/jobs/$id/edit" params={{ id: j.id }}>
                <Button size="sm" variant="outline" className="gap-1">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toggleFeatured(j.id, j.featured)}
                className="gap-1"
              >
                <Star
                  className={`h-3.5 w-3.5 ${j.featured ? "fill-current text-[color:var(--hazard)]" : ""}`}
                />
              </Button>
              {j.status === "paused" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(j.id, "active")}
                  className="gap-1"
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(j.id, "paused")}
                  className="gap-1"
                >
                  <Pause className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus(j.id, "closed")}
                className="gap-1"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => deleteJob(j.id)}
                className="gap-1 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs match.</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_review: "bg-yellow-100 text-yellow-900",
    active: "bg-green-100 text-green-900",
    published: "bg-green-100 text-green-900",
    paused: "bg-gray-100 text-gray-900",
    closed: "bg-red-100 text-red-900",
    expired: "bg-red-100 text-red-900",
    draft: "bg-blue-100 text-blue-900",
  };
  return <Badge className={`${map[status] ?? "bg-gray-100"} border-0`}>{status}</Badge>;
}
