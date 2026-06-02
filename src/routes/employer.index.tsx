import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import crewImage from "@/assets/crew-productive.webp";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Users, Package as PackageIcon, Star, Plus, Eye, Pause, Play, Copy, X, Pencil, Sparkles, Rocket, Trash2, AlertTriangle, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { uniqueSlug } from "@/lib/slug";
import { TableSkeleton } from "@/components/ui/skeleton-list";


export const Route = createFileRoute("/employer/")({
  head: () => ({ meta: [{ title: "Employer Dashboard — WarehouseJobs" }] }),
  component: EmployerDashboard,
});

type JobRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  featured: boolean;
  posted_at: string;
  expires_at: string | null;
  created_at: string;
  category: string;
  shift: string;
  employment_type: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_period: string | null;
  location: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  description: string;
  requirements: string | null;
  company_id: string;
  posted_by: string | null;
  applicant_count: number;
};

function EmployerDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: company } = useQuery({
    queryKey: ["employer-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: owned } = await supabase.from("companies").select("*").eq("owner_id", user!.id).maybeSingle();
      if (owned) return owned;
      const { data: mem } = await supabase
        .from("company_members").select("company_id").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle();
      if (!mem?.company_id) return null;
      const { data } = await supabase.from("companies").select("*").eq("id", mem.company_id).maybeSingle();
      return data;
    },
  });

  const { data: activePackages = [] } = useQuery({
    queryKey: ["active-packages-all", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_packages")
        .select("id, package_id, posts_total, posts_used, featured_total, featured_used, expires_at, packages(name)")
        .eq("company_id", company!.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
      return (data ?? [])
        .map((cp: any) => ({
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
      const { data: jobsData, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch counts in one shot
      const ids = (jobsData ?? []).map((j) => j.id);
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
      return (jobsData ?? []).map((j) => ({ ...j, applicant_count: counts[j.id] ?? 0 })) as JobRow[];
    },
  });

  const activeJobs = jobs.filter((j) => j.status === "active" || j.status === "published").length;
  const totalApplicants = jobs.reduce((sum, j) => sum + j.applicant_count, 0);


  const refresh = () => qc.invalidateQueries({ queryKey: ["employer-jobs", company?.id] });

  const togglePause = async (job: JobRow) => {
    const next = job.status === "paused" ? "active" : "paused";
    const { error } = await supabase.from("jobs").update({ status: next }).eq("id", job.id);
    if (error) return toast.error(error.message);
    toast.success(next === "paused" ? "Job paused" : "Job resumed");
    refresh();
  };

  const closeJob = async (job: JobRow) => {
    if (!confirm(`Close "${job.title}"? Applicants can no longer apply.`)) return;
    const { error } = await supabase.from("jobs").update({ status: "closed" }).eq("id", job.id);
    if (error) return toast.error(error.message);
    toast.success("Job closed");
    refresh();
  };

  const deleteDraft = async (job: JobRow) => {
    if (!confirm(`Delete draft "${job.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("jobs").delete().eq("id", job.id).eq("status", "draft");
    if (error) return toast.error(error.message);
    toast.success("Draft deleted");
    refresh();
  };

  const duplicateJob = async (job: JobRow) => {
    if (!user || !company) return;
    if (postingCredits < 1) {
      toast.error("Out of posting credits — buy a package to re-post.");
      navigate({ to: "/pricing" });
      return;
    }
    const { data: ok, error: credErr } = await supabase.rpc("consume_credit", {
      _company_id: company.id,
      _credit_type: "post",
    });
    if (credErr) return toast.error(credErr.message);
    if (!ok) {
      toast.error("Out of posting credits.");
      navigate({ to: "/pricing" });
      return;
    }
    const newSlug = uniqueSlug(job.title);
    const { error: jobErr } = await supabase.from("jobs").insert({
      company_id: company.id,
      posted_by: user.id,
      title: job.title,
      slug: newSlug,
      category: job.category,
      shift: job.shift as never,
      employment_type: job.employment_type as never,
      pay_min: job.pay_min,
      pay_max: job.pay_max,
      pay_period: job.pay_period,
      location: job.location,
      city: job.city,
      state: job.state,
      zip: job.zip,
      description: job.description,
      requirements: job.requirements,
      status: "active",
      featured: false,
      expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
    });
    if (jobErr) return toast.error(jobErr.message);
    toast.success("Job duplicated and re-posted");
    qc.invalidateQueries({ queryKey: ["company-credits", company.id] });
    refresh();
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
    const { data: ok, error: credErr } = await supabase.rpc("consume_credit", {
      _company_id: company.id,
      _credit_type: "featured",
    });
    if (credErr) return toast.error(credErr.message);
    if (!ok) {
      toast.error("Out of featured credits.");
      navigate({ to: "/pricing" });
      return;
    }
    const featuredUntil = job.expires_at ?? new Date(Date.now() + 30 * 86400_000).toISOString();
    const { error } = await supabase
      .from("jobs")
      .update({ featured: true, featured_until: featuredUntil })
      .eq("id", job.id);
    if (error) return toast.error(error.message);
    toast.success("Job marked as featured");
    qc.invalidateQueries({ queryKey: ["company-credits", company.id] });
    refresh();
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
          <Button onClick={() => navigate({ to: "/employer/jobs/new" })} className="btn-primary gap-1.5">
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
                    : postingCredits <= 1 && (daysToExpiry !== null && daysToExpiry <= 5)
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
              <p className="text-xs text-muted-foreground">Manage status, view applicants, re-post.</p>
            </div>
            <Link to="/pricing" className="text-xs font-semibold text-primary hover:underline">Buy a package →</Link>
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
                  <p className="mt-1 text-xl font-bold text-[color:var(--ink)]">Post your first job</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Reach forklift operators, pickers, and dock workers ready to start this week. Your free Starter package is loaded and waiting.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <Button onClick={() => navigate({ to: "/employer/jobs/new" })} className="btn-primary gap-1.5">
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
                        <Link to="/jobs/$slug" params={{ slug: job.slug }} className="font-semibold text-[color:var(--ink)] hover:text-primary">
                          {job.title}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{job.category}</span>
                          {job.featured && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-[color:var(--hazard)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[color:var(--ink)]">
                              <Sparkles className="h-2.5 w-2.5" /> Featured
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={job.status} /></TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{job.views ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        <Link to="/employer/jobs/$id/applicants" params={{ id: job.id }} className="font-semibold text-primary hover:underline">
                          {job.applicant_count}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(job.posted_at ?? job.created_at)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{job.expires_at ? formatDate(job.expires_at) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-0.5">
                          {job.status === "draft" ? (
                            <>
                              <Button
                                size="sm"
                                className="btn-primary h-7 gap-1 text-xs"
                                onClick={() => navigate({ to: "/employer/jobs/new", search: { draft: job.id } })}
                              >
                                <Rocket className="h-3 w-3" /> Finish & publish
                              </Button>
                              <ActionIcon label="Delete draft" onClick={() => deleteDraft(job)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </ActionIcon>
                            </>
                          ) : (
                            <>
                              <ActionIcon label="View" onClick={() => navigate({ to: "/jobs/$slug", params: { slug: job.slug } })}>
                                <Eye className="h-3.5 w-3.5" />
                              </ActionIcon>
                              <ActionIcon label="Edit" onClick={() => navigate({ to: "/employer/jobs/$id/edit", params: { id: job.id } })}>
                                <Pencil className="h-3.5 w-3.5" />
                              </ActionIcon>
                              <ActionIcon
                                label={job.featured ? "Already featured" : `Mark featured (${featuredCredits} upgrades left)`}
                                onClick={() => markFeatured(job)}
                                disabled={job.featured || featuredCredits < 1}
                              >
                                <Star className={`h-3.5 w-3.5 ${job.featured ? "fill-[color:var(--hazard)] text-[color:var(--hazard)]" : ""}`} />
                              </ActionIcon>
                              <ActionIcon label={job.status === "paused" ? "Resume" : "Pause"} onClick={() => togglePause(job)}>
                                {job.status === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                              </ActionIcon>
                              <ActionIcon label={`Duplicate (${postingCredits} posts left)`} onClick={() => duplicateJob(job)} disabled={postingCredits < 1}>
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
          <Link to="/pricing" className="mt-1 inline-block text-xs font-semibold text-primary hover:underline">
            Browse packages →
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 truncate text-base font-semibold text-[color:var(--ink)]">{packageName ?? "Package"}</p>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums text-[color:var(--ink)]">{postsRemaining}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Posts left</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-[color:var(--ink)]">{featuredRemaining}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Featured</p>
            </div>
          </div>
          {expiryLabel && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> {expiryLabel}
              {extraCount > 0 && <span className="ml-1 text-muted-foreground">· +{extraCount} more</span>}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: typeof Briefcase; label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${accent ? "border-primary/30 bg-[color:var(--primary-tint)]" : "border-border bg-card"}`}>
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
        <Link to="/pricing" className="font-semibold underline">Buy a package</Link> to post.
      </TooltipContent>
    </Tooltip>
  );
}

function ActionIcon({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
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
  return <Badge variant="outline" className={`border ${m.cls} text-[11px] font-semibold uppercase tracking-wide`}>{m.label}</Badge>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
