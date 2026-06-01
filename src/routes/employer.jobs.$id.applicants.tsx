import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Mail, Phone, FileText, User as UserIcon, LayoutGrid, List, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/employer/jobs/$id/applicants")({
  head: () => ({ meta: [{ title: "Applicants — WarehouseJobs Employers" }] }),
  component: ApplicantsPage,
});

type AppStatus = "submitted" | "reviewed" | "interview" | "hired" | "rejected";

const COLUMNS: { value: AppStatus; label: string; accent: string }[] = [
  { value: "submitted", label: "Submitted", accent: "border-t-blue-400" },
  { value: "reviewed", label: "Reviewed", accent: "border-t-slate-400" },
  { value: "interview", label: "Interview", accent: "border-t-amber-400" },
  { value: "hired", label: "Hired", accent: "border-t-emerald-500" },
  { value: "rejected", label: "Rejected", accent: "border-t-rose-400" },
];

const statusStyles: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-900 border-blue-200",
  reviewed: "bg-muted text-muted-foreground",
  interview: "bg-amber-100 text-amber-900 border-amber-200",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
  hired: "bg-emerald-100 text-emerald-900 border-emerald-200",
  shortlisted: "bg-[color:var(--primary-tint)] text-primary border-primary/30",
};

type Applicant = {
  id: string;
  applicant_id: string;
  job_id: string;
  status: AppStatus;
  cover_letter: string | null;
  resume_url: string | null;
  created_at: string;
  profile?: { display_name: string | null; phone: string | null };
};

function ApplicantsPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [view, setView] = useState<"board" | "table">("board");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Applicant | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
      return (apps ?? []).map((a) => ({ ...a, profile: profilesById[a.applicant_id] })) as Applicant[];
    },
  });

  const byStatus = useMemo(() => {
    const groups: Record<AppStatus, Applicant[]> = {
      submitted: [], reviewed: [], interview: [], hired: [], rejected: [],
    };
    for (const a of applications) {
      // Fold legacy "shortlisted" into "interview" column visually
      const key = (a.status === ("shortlisted" as AppStatus) ? "interview" : a.status) as AppStatus;
      if (groups[key]) groups[key].push(a);
    }
    return groups;
  }, [applications]);

  const updateStatus = async (appId: string, status: AppStatus, opts?: { silent?: boolean; note?: string | null }) => {
    const patch: Record<string, unknown> = { status };
    if (opts?.note !== undefined) patch.cover_letter = opts.note;
    // optimistic
    qc.setQueryData<Applicant[]>(["employer-applicants", id], (prev) =>
      (prev ?? []).map((a) => (a.id === appId ? { ...a, status } : a)),
    );
    const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["employer-applicants", id] });
      return;
    }
    if (!opts?.silent) toast.success(`Moved to ${status}`);
  };

  const activeApp = applications.find((a) => a.id === activeId) ?? null;

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as AppStatus | undefined;
    const appId = e.active.id as string;
    if (!overId) return;
    const current = applications.find((a) => a.id === appId);
    if (!current || current.status === overId) return;
    if (overId === "rejected") {
      const app = current;
      setRejectFor(app);
      setRejectReason("");
      return;
    }
    updateStatus(appId, overId);
  };

  const confirmReject = async () => {
    if (!rejectFor) return;
    const note = rejectReason.trim()
      ? `[Rejection reason: ${rejectReason.trim()}]${rejectFor.cover_letter ? `\n\n${rejectFor.cover_letter}` : ""}`
      : rejectFor.cover_letter ?? null;
    await updateStatus(rejectFor.id, "rejected", { note, silent: true });
    toast.success("Applicant rejected");
    setRejectFor(null);
    setRejectReason("");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/employer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-caps text-primary">Applicants</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">{job?.title ?? "Job"}</h1>
            {job && (
              <p className="mt-1 text-sm text-muted-foreground">
                {job.category} · {job.location} ·{" "}
                <Link to="/jobs/$slug" params={{ slug: job.slug }} className="font-semibold text-primary hover:underline">
                  View public listing <ExternalLink className="inline h-3 w-3" />
                </Link>
              </p>
            )}
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as "board" | "table")}>
            <TabsList>
              <TabsTrigger value="board" className="gap-1.5"><LayoutGrid className="h-4 w-4" /> Board</TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5"><List className="h-4 w-4" /> Table</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading applicants…</div>
      ) : applications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-base font-semibold text-[color:var(--ink)]">No applicants yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Once seekers apply, you'll see them here.</p>
        </div>
      ) : view === "board" ? (
        <DndContext
          sensors={sensors}
          onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="grid gap-3 lg:grid-cols-5">
            {COLUMNS.map((col) => (
              <Column key={col.value} column={col} items={byStatus[col.value]} onReject={(a) => { setRejectFor(a); setRejectReason(""); }} />
            ))}
          </div>
          <DragOverlay>
            {activeApp ? <ApplicantCard app={activeApp} dragging /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <TableView
          applications={applications}
          onStatusChange={(appId, status) => {
            if (status === "rejected") {
              const a = applications.find((x) => x.id === appId);
              if (a) { setRejectFor(a); setRejectReason(""); return; }
            }
            updateStatus(appId, status);
          }}
          onReject={(a) => { setRejectFor(a); setRejectReason(""); }}
        />
      )}

      <AlertDialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this applicant?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectFor?.profile?.display_name ?? "Applicant"} will be moved to the Rejected column. Add an optional reason for your records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (optional, internal note)…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject} className="bg-rose-600 hover:bg-rose-700">
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Column({
  column,
  items,
  onReject,
}: {
  column: { value: AppStatus; label: string; accent: string };
  items: Applicant[];
  onReject: (a: Applicant) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.value });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-border border-t-4 ${column.accent} bg-card p-3 transition-colors ${isOver ? "bg-muted/60" : ""}`}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--ink)]">{column.label}</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{items.length}</span>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-[11px] text-muted-foreground">Drop here</p>
        )}
        {items.map((a) => (
          <DraggableCard key={a.id} app={a} onReject={() => onReject(a)} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ app, onReject }: { app: Applicant; onReject: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing touch-none"
    >
      <ApplicantCard app={app} onReject={onReject} />
    </div>
  );
}

function ApplicantCard({ app, dragging, onReject }: { app: Applicant; dragging?: boolean; onReject?: () => void }) {
  return (
    <div className={`rounded-lg border border-border bg-background p-3 shadow-sm ${dragging ? "ring-2 ring-primary shadow-lg" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-tint)] text-primary">
          <UserIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
            {app.profile?.display_name ?? "Applicant"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Applied {new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {app.profile?.phone && (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Phone className="h-2.5 w-2.5" /> {app.profile.phone}
          </span>
        )}
        {app.resume_url && (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <FileText className="h-2.5 w-2.5" /> Resume
          </span>
        )}
        {app.cover_letter && (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Cover note
          </span>
        )}
      </div>
      {!dragging && (
        <div className="mt-2 flex flex-wrap gap-1" onPointerDown={(e) => e.stopPropagation()}>
          {app.resume_url && (
            <>
              <a
                href={app.resume_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] font-medium hover:bg-muted"
              >
                <ExternalLink className="h-3 w-3" /> View
              </a>
              <a
                href={app.resume_url}
                download
                className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2 text-[11px] font-medium hover:bg-muted"
              >
                <Download className="h-3 w-3" /> Download
              </a>
            </>
          )}
          {onReject && app.status !== "rejected" && (
            <button
              onClick={onReject}
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
            >
              <XCircle className="h-3 w-3" /> Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TableView({
  applications,
  onStatusChange,
  onReject,
}: {
  applications: Applicant[];
  onStatusChange: (id: string, status: AppStatus) => void;
  onReject: (a: Applicant) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Applicant</th>
            <th className="px-4 py-3">Applied</th>
            <th className="px-4 py-3">Resume</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {applications.map((a) => (
            <tr key={a.id} className="hover:bg-muted/30">
              <td className="px-4 py-3">
                <p className="font-semibold text-[color:var(--ink)]">{a.profile?.display_name ?? "Applicant"}</p>
                {a.profile?.phone && <p className="text-xs text-muted-foreground">{a.profile.phone}</p>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-4 py-3">
                {a.resume_url ? (
                  <a href={a.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <FileText className="h-3.5 w-3.5" /> View
                  </a>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={`border ${statusStyles[a.status] ?? "bg-muted"} text-[10px] font-semibold uppercase`}>
                  {a.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Select value={a.status} onValueChange={(v) => onStatusChange(a.id, v as AppStatus)}>
                    <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {a.resume_url && (
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                      <a href={a.resume_url} download><Download className="h-3.5 w-3.5" /></a>
                    </Button>
                  )}
                  {a.status !== "rejected" && (
                    <Button size="sm" variant="outline" onClick={() => onReject(a)} className="h-8 gap-1 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
