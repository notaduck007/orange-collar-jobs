import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import crewImage from "@/assets/crew-productive.webp";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Briefcase,
  Users,
  Package as PackageIcon,
  Star,
  Plus,
  Eye,
  Pause,
  Play,
  Copy,
  X,
  Pencil,
  Sparkles,
  Rocket,
  Trash2,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { apiClient, ApiError } from "@/lib/api-client";
import { requireAccessToken } from "@/lib/api/require-access-token";
import { JobSourceBadge } from "@/components/job-source-badge";
import { mapJobToEmployerRow, type EmployerJobRow } from "@/lib/jobs/map-employer-job-row";
import { publishEmployerJobViaApi } from "@/lib/jobs/publish-employer-job";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton } from "@/components/ui/skeleton-list";
import type { Row } from "@/lib/row-types";

export const Route = createFileRoute("/employer/")({
  head: () => ({ meta: [{ title: "Employer Dashboard — WarehouseJobs.com" }] }),
  component: EmployerDashboard,
});

type JobRow = EmployerJobRow;

function EmployerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: company } = useQuery({
    queryKey: ["employer-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: owned } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (owned) return owned;
      const { data: mem } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!mem?.company_id) return null;
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("id", mem.company_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: activePackages = [] } = useQuery({
    queryKey: ["active-packages-all", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_packages")
        .select(
          "id, package_id, posts_total, posts_used, featured_total, featured_used, expires_at, packages(name)",
        )
        .eq("company_id", company!.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
      return (data ?? [])
        .map((cp: Row) => ({
          id: cp.id as string,
          package_name: (cp.packages?.name as string | null) ?? null,
          posts_remaining: Math.max((cp.posts_total ?? 0) - (cp.posts_used ?? 0), 0),
          featured_remaining: Math.max((cp.featured_total ?? 0) - (cp.featured_used ?? 0), 0),
          expires_at: cp.expires_at as string,
        }))
        .filter((p) => p.posts_remaining > 0 || p.featured_remaining > 0);
    },
  });
  const activePackage = activePackages[0] ?? null;
  const extraPackages = Math.max(activePackages.length - 1, 0);
  const postingCredits = activePackage?.posts_remaining ?? 0;
  const featuredCredits = activePackage?.featured_remaining ?? 0;
  const daysToExpiry = activePackage
    ? Math.ceil((new Date(activePackage.expires_at).getTime() - Date.now()) / 86400_000)
    : null;
  const showRenewBanner =
    !!activePackage && (postingCredits <= 1 || (daysToExpiry !== null && daysToExpiry <= 5));
  const noPackage = !activePackage;

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["employer-jobs", company?.id],
    enabled: !!company,
    queryFn: async (): Promise<JobRow[]> => {
      const token = requireAccessToken();
      const res = await apiClient.listMyJobs(token, { pageSize: 100 });
      const rows = res.data.map((job) =>
        mapJobToEmployerRow(job, { companyId: company!.id, postedBy: user?.id ?? null }),
      );

      const ids = rows.map((j) => j.id);
      let counts: Record<string, number> = {};
      if (ids.length) {
        const { data: apps } = await supabase
          .from("applications")
          .select("job_id")
          .in("job_id", ids);
        counts = (apps ?? []).reduce<Record<string, number>>((acc, a) => {
          acc[a.job_id] = (acc[a.job_id] ?? 0) + 1;
          return acc;
        }, {});
      }

      return rows.map((j) => ({ ...j, applicant_count: counts[j.id] ?? 0 }));
    },
  });

  const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "published").length;
  const totalApplicants = jobs.reduce((sum, j) => sum + j.applicant_count, 0);

  const refresh = () => qc.invalidateQueries({ queryKey: ["employer-jobs", company?.id] });

  const togglePause = async (job: JobRow) => {
    if (job.status === "draft") return;
    try {
      const token = requireAccessToken();
      const next = job.status === "closed" ? "published" : "closed";
      await apiClient.updateJob(token, job.id, { status: next });
      toast.success(next === "closed" ? "Job paused" : "Job resumed");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const closeJob = async (job: JobRow) => {
    if (!confirm(`Close "${job.title}"? Applicants can no longer apply.`)) return;
    try {
      const token = requireAccessToken();
      await apiClient.deleteJob(token, job.id);
      toast.success("Job closed");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Close failed");
    }
  };

  const deleteDraft = async (job: JobRow) => {
    if (!confirm(`Delete draft "${job.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("jobs").delete().eq("id", job.id).eq("status", "draft");
    if (error) return toast.error(error.message);
    toast.success("Draft deleted");
    refresh();
  };

  const duplicateJob = async (job: JobRow) => {
    if (!user || !company || !activePackage) return;
    if (postingCredits < 1) {
      toast.error("Out of posting credits — buy a package to re-post.");
      navigate({ to: "/pricing" });
      return;
    }
    try {
      await publishEmployerJobViaApi(
        {
          title: job.title,
          category: job.category,
          shift: job.shift,
          employment_type: job.employment_type,
          pay_min: job.pay_min?.toString() ?? "",
          pay_max: job.pay_max?.toString() ?? "",
          pay_period: (job.pay_period as "hour" | "year") ?? "hour",
          city: job.city ?? "",
          state: job.state ?? "",
          zip: job.zip ?? "",
          description: job.description,
          requirements: job.requirements ?? "",
          temperature_env: "",
          certifications_required: [],
          lift_requirement_lbs: "",
          overtime_available: false,
          weekly_pay: false,
          quick_hire: false,
          feature_it: false,
        },
        { companyPackageId: activePackage.id },
      );
      toast.success("Job duplicated and re-posted");
      qc.invalidateQueries({ queryKey: ["active-packages-all", company.id] });
      refresh();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 400) {
        toast.error("Out of posting credits — buy a package to re-post.");
        navigate({ to: "/pricing" });
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not duplicate job");
    }
  };

  const markFeatured = async (job: JobRow) => {
    if (!company) return;
    if (job.featured) {
      toast.info("Already featured");
      return;
    }
    if (featuredCredits < 1) {
      toast.error("Out of featured credits — buy a package to upgrade.");
      navigate({ to: "/pricing" });
      return;
    }
    try {
      const token = requireAccessToken();
      await apiClient.featureJob(token, job.id, { featured: true });
      toast.success("Job marked as featured");
      qc.invalidateQueries({ queryKey: ["active-packages-all", company.id] });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not feature job");
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-caps text-primary">Dashboard</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
              Welcome{company?.name ? `, ${company.name}` : ""}
            </h1>
          </div>
          <Button
            onClick={() => navigate({ to: "/employer/jobs/new" })}
            className="btn-primary gap-1.5"
          >
            <Plus className="h-4 w-4" /> Post a Job
            {postingCredits === 0 && (
              <span className="ml-1 rounded bg-[color:var(--hazard)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--ink)]">
                0 posts left
              </span>
            )}
          </Button>
        </header>

        {(showRenewBanner || noPackage) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--hazard)]/40 bg-[color:var(--hazard)]/10 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-[color:var(--ink)]" />
              <div className="text-sm">
                <p className="font-semibold text-[color:var(--ink)]">
                  {noPackage
                    ? "No active package"
                    : postingCredits <= 1 && daysToExpiry !== null && daysToExpiry <= 5
                      ? `${postingCredits} post${postingCredits === 1 ? "" : "s"} left · expires in ${daysToExpiry} day${daysToExpiry === 1 ? "" : "s"}`
                      : postingCredits <= 1
                        ? `${postingCredits} post${postingCredits === 1 ? "" : "s"} remaining on your package`
                        : `Your package expires in ${daysToExpiry} day${daysToExpiry === 1 ? "" : "s"}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Renew now to keep posting without interruption.
                </p>
              </div>
            </div>
            <Button size="sm" className="btn-primary" onClick={() => navigate({ to: "/pricing" })}>
              Renew
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard icon={Briefcase} label="Active jobs" value={activeJobs} accent />
          <StatCard icon={Users} label="Total applicants" value={totalApplicants} />
          <PackageCard
            packageName={activePackage?.package_name ?? null}
            postsRemaining={postingCredits}
            featuredRemaining={featuredCredits}
            expiresAt={activePackage?.expires_at ?? null}
            extraCount={extraPackages}
          />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-[color:var(--ink)]">Your jobs</h2>
              <p className="text-xs text-muted-foreground">
                Manage status, view applicants, re-post.
              </p>
            </div>
            <Link to="/pricing" className="text-xs font-semibold text-primary hover:underline">
              Buy a package →
            </Link>
          </div>

          {isLoading ? (
            <TableSkeleton rows={4} cols={6} />
          ) : jobs.length === 0 ? (
            <div className="p-8 sm:p-12">
              <div className="mx-auto grid max-w-3xl items-center gap-6 sm:grid-cols-[200px_1fr] sm:gap-8">
                <img
                  src={crewImage}
                  alt="A productive warehouse crew collaborating at a pick station — the team you can hire by posting your first job."
                  width={400}
                  height={500}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/5] w-full rounded-lg object-cover"
                />
                <div className="text-center sm:text-left">
                  <p className="label-caps text-primary">Get started</p>
                  <p className="mt-1 text-xl font-bold text-[color:var(--ink)]">
                    Post your first job
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Reach forklift operators, pickers, and dock workers ready to start this week.
                    Your free Starter package is loaded and waiting.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <Button
                      onClick={() => navigate({ to: "/employer/jobs/new" })}
                      className="btn-primary gap-1.5"
                    >
                      <Plus className="h-4 w-4" /> Post a Job
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Applicants</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="max-w-[280px]">
                        <Link
                          to="/jobs/$slug"
                          params={{ slug: job.slug }}
                          className="font-semibold text-[color:var(--ink)] hover:text-primary"
                        >
                          {job.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{job.category}</span>
                          <JobSourceBadge sourceType={job.source_type} />
                          {job.featured && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-[color:var(--hazard)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[color:var(--ink)]">
                              <Sparkles className="h-2.5 w-2.5" /> Featured
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={job.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {job.views ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        <Link
                          to="/employer/jobs/$id/applicants"
                          params={{ id: job.id }}
                          className="font-semibold text-primary hover:underline"
                        >
                          {job.applicant_count}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(job.posted_at ?? job.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {job.expires_at ? formatDate(job.expires_at) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          {job.status === "draft" ? (
                            <>
                              <Button
                                size="sm"
                                className="btn-primary h-7 gap-1 text-xs"
                                onClick={() =>
                                  navigate({ to: "/employer/jobs/new", search: { draft: job.id } })
                                }
                              >
                                <Rocket className="h-3 w-3" /> Finish & publish
                              </Button>
                              <ActionIcon label="Delete draft" onClick={() => deleteDraft(job)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </ActionIcon>
                            </>
                          ) : (
                            <>
                              <ActionIcon
                                label="View"
                                onClick={() =>
                                  navigate({ to: "/jobs/$slug", params: { slug: job.slug } })
                                }
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </ActionIcon>
                              <ActionIcon
                                label="Edit"
                                onClick={() =>
                                  navigate({
                                    to: "/employer/jobs/$id/edit",
                                    params: { id: job.id },
                                  })
                                }
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </ActionIcon>
                              <ActionIcon
                                label={
                                  job.featured
                                    ? "Already featured"
                                    : `Mark featured (${featuredCredits} upgrades left)`
                                }
                                onClick={() => markFeatured(job)}
                                disabled={job.featured || featuredCredits < 1}
                              >
                                <Star
                                  className={`h-3.5 w-3.5 ${job.featured ? "fill-[color:var(--hazard)] text-[color:var(--hazard)]" : ""}`}
                                />
                              </ActionIcon>
                              <ActionIcon
                                label={job.status === "closed" ? "Resume" : "Pause"}
                                onClick={() => togglePause(job)}
                              >
                                {job.status === "closed" ? (
                                  <Play className="h-3.5 w-3.5" />
                                ) : (
                                  <Pause className="h-3.5 w-3.5" />
                                )}
                              </ActionIcon>
                              <ActionIcon
                                label={`Duplicate (${postingCredits} posts left)`}
                                onClick={() => duplicateJob(job)}
                                disabled={postingCredits < 1}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </ActionIcon>
                              <ActionIcon label="Close" onClick={() => closeJob(job)}>
                                <X className="h-3.5 w-3.5" />
                              </ActionIcon>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </TooltipProvider>
  );
}

function PackageCard({
  packageName,
  postsRemaining,
  featuredRemaining,
  expiresAt,
  extraCount,
}: {
  packageName: string | null;
  postsRemaining: number;
  featuredRemaining: number;
  expiresAt: string | null;
  extraCount: number;
}) {
  const expiryLabel = expiresAt
    ? `Valid until ${new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : null;
  const empty = !packageName && !expiresAt;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="label-caps">Active package</p>
        <PackageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      {empty ? (
        <>
          <p className="mt-3 text-base font-semibold text-[color:var(--ink)]">No active package</p>
          <Link
            to="/pricing"
            className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
          >
            Browse packages →
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 truncate text-base font-semibold text-[color:var(--ink)]">
            {packageName ?? "Package"}
          </p>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums text-[color:var(--ink)]">
                {postsRemaining}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Posts left
              </p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[color:var(--ink)]">
                {featuredRemaining}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Featured</p>
            </div>
          </div>
          {expiryLabel && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> {expiryLabel}
              {extraCount > 0 && (
                <span className="ml-1 text-muted-foreground">· +{extraCount} more</span>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: typeof Briefcase;
  label: string;
  value: number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${accent ? "border-primary/30 bg-[color:var(--primary-tint)]" : "border-border bg-card"}`}
    >
      <div className="flex items-center justify-between">
        <p className="label-caps">{label}</p>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-[color:var(--ink)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function PostJobButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  if (!disabled) {
    return (
      <Button onClick={onClick} className="btn-primary gap-1.5">
        <Plus className="h-4 w-4" /> Post a Job
      </Button>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}>
          <Button disabled className="gap-1.5 cursor-not-allowed">
            <Plus className="h-4 w-4" /> Post a Job
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        You're out of posting credits.{" "}
        <Link to="/pricing" className="font-semibold underline">
          Buy a package
        </Link>{" "}
        to post.
      </TooltipContent>
    </Tooltip>
  );
}

function ActionIcon({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-[color:var(--ink)] disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-green-100 text-green-900 border-green-200" },
    published: { label: "Active", cls: "bg-green-100 text-green-900 border-green-200" },
    paused: { label: "Paused", cls: "bg-amber-100 text-amber-900 border-amber-200" },
    draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
    pending_review: { label: "In review", cls: "bg-blue-100 text-blue-900 border-blue-200" },
    expired: { label: "Expired", cls: "bg-muted text-muted-foreground" },
    closed: { label: "Closed", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <Badge
      variant="outline"
      className={`border ${m.cls} text-[11px] font-semibold uppercase tracking-wide`}
    >
      {m.label}
    </Badge>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
