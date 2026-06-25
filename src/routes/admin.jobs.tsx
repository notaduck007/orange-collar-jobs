import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Pencil, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobSourceBadge } from "@/components/job-source-badge";
import { apiClient, ApiError } from "@/lib/api-client";
import { requireAccessToken } from "@/lib/api/require-access-token";
import type { JobStatus } from "@/lib/api/contracts/jobs";

const searchSchema = z.object({
  status: z.string().optional(),
  category: z.string().optional(),
});

export const Route = createFileRoute("/admin/jobs")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Jobs — WarehouseJobs.com Admin" }] }),
  component: AdminJobs,
});

const STATUSES: JobStatus[] = ["draft", "active", "published", "closed", "expired"];

async function fetchAdminJobs(filters: { status?: string; category?: string }) {
  const token = requireAccessToken();
  const res = await apiClient.adminListJobs(token, {
    status: filters.status as JobStatus | undefined,
    pageSize: 100,
  });
  let rows = res.data;
  if (filters.category) {
    rows = rows.filter((j) => j.category === filters.category);
  }
  return rows;
}

function AdminJobs() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();

  const { data: jobs = [] } = useQuery({
    queryKey: ["admin-jobs", search],
    queryFn: () => fetchAdminJobs(search),
  });

  const categories = [...new Set(jobs.map((j) => j.category).filter(Boolean))].sort();

  const withToken = async <T,>(fn: (token: string) => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn(requireAccessToken());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      return undefined;
    }
  };

  const setStatus = async (id: string, status: JobStatus) => {
    await withToken(async (token) => {
      try {
        await apiClient.updateJob(token, id, { status });
        toast.success(`Job ${status}`);
        qc.invalidateQueries({ queryKey: ["admin-jobs"] });
      } catch (err) {
        const msg =
          err instanceof ApiError &&
          err.body &&
          typeof err.body === "object" &&
          "message" in err.body
            ? String((err.body as { message: string }).message)
            : "Update failed";
        toast.error(msg);
      }
    });
  };

  const toggleFeatured = async (id: string, featured: boolean) => {
    await withToken(async (token) => {
      await apiClient.featureJob(token, id, { featured: !featured });
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
    });
  };

  const deleteJob = async (id: string) => {
    if (!confirm("Close this job listing?")) return;
    await withToken(async (token) => {
      await apiClient.deleteJob(token, id);
      toast.success("Job closed");
      qc.invalidateQueries({ queryKey: ["admin-jobs"] });
    });
  };

  const update = (patch: Partial<typeof search>) =>
    navigate({ to: "/admin/jobs", search: { ...search, ...patch } });

  return (
    <div>
      <div className="mb-6">
        <p className="label-caps">Moderation</p>
        <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">All jobs</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Loaded from GET /api/v1/admin/jobs — all statuses across companies.
        </p>
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
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search.status || search.category) && (
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
                <JobSourceBadge sourceType={j.sourceType} />
                {j.featured && (
                  <Badge className="border-0 bg-[color:var(--hazard)] text-[color:var(--ink)]">
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {j.company?.name ?? "—"} · {j.category} · {j.views} views · posted{" "}
                {new Date(j.postedAt ?? j.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
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
    active: "bg-green-100 text-green-900",
    published: "bg-green-100 text-green-900",
    closed: "bg-red-100 text-red-900",
    expired: "bg-red-100 text-red-900",
    draft: "bg-blue-100 text-blue-900",
  };
  return <Badge className={`${map[status] ?? "bg-gray-100"} border-0`}>{status}</Badge>;
}
