import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Mail, Phone, FileText, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/employer/jobs/$id/applicants")({
  head: () => ({ meta: [{ title: "Applicants — WarehouseJobs Employers" }] }),
  component: ApplicantsPage,
});

const STATUSES = [
  { value: "submitted", label: "Submitted" },
  { value: "reviewed", label: "Reviewed" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
];

const statusStyles: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-900 border-blue-200",
  reviewed: "bg-muted text-muted-foreground",
  shortlisted: "bg-[color:var(--primary-tint)] text-primary border-primary/30",
  rejected: "bg-red-100 text-red-900 border-red-200",
  hired: "bg-green-100 text-green-900 border-green-200",
};

function ApplicantsPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const { data: job } = useQuery({
    queryKey: ["employer-job", id],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("id, title, slug, location, category").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["employer-applicants", id],
    queryFn: async () => {
      const { data: apps, error } = await supabase
        .from("applications")
        .select("*")
        .eq("job_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = (apps ?? []).map((a) => a.applicant_id);
      let profilesById: Record<string, { display_name: string | null; phone: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, phone")
          .in("id", ids);
        profilesById = (profs ?? []).reduce<typeof profilesById>((acc, p) => {
          acc[p.id] = { display_name: p.display_name, phone: p.phone };
          return acc;
        }, {});
      }
      return (apps ?? []).map((a) => ({ ...a, profile: profilesById[a.applicant_id] }));
    },
  });

  const updateStatus = async (appId: string, status: string) => {
    const { error } = await supabase.from("applications").update({ status: status as never }).eq("id", appId);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["employer-applicants", id] });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/employer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <p className="label-caps mt-3 text-primary">Applicants</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          {job?.title ?? "Job"}
        </h1>
        {job && (
          <p className="mt-1 text-sm text-muted-foreground">
            {job.category} · {job.location} ·{" "}
            <Link to="/jobs/$slug" params={{ slug: job.slug }} className="font-semibold text-primary hover:underline">View public listing</Link>
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading applicants…</div>
      ) : applications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-base font-semibold text-[color:var(--ink)]">No applicants yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Once seekers apply, you'll see them here with their resumes and contact info.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--primary-tint)] text-primary">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[color:var(--ink)]">
                      {app.profile?.display_name ?? "Applicant"}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {app.profile?.phone && (
                        <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {app.profile.phone}</span>
                      )}
                      <span>Applied {new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`border ${statusStyles[app.status] ?? "bg-muted"} text-[11px] font-semibold uppercase`}>
                    {app.status}
                  </Badge>
                  <Select value={app.status} onValueChange={(v) => updateStatus(app.id, v)}>
                    <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(app.cover_letter || app.resume_url) && (
                <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-[1fr_auto]">
                  {app.cover_letter ? (
                    <div>
                      <p className="label-caps mb-1.5 flex items-center gap-1 text-[10px]"><FileText className="h-3 w-3" /> Cover note</p>
                      <p className="whitespace-pre-line text-sm text-foreground">{app.cover_letter}</p>
                    </div>
                  ) : <div className="text-xs text-muted-foreground">No cover note provided.</div>}
                  {app.resume_url && (
                    <a
                      href={app.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center gap-1.5 self-start rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
                    >
                      <Download className="h-4 w-4" /> Resume
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
