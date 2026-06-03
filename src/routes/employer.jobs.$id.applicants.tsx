import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Mail,
  Phone,
  FileText,
  User as UserIcon,
  LayoutGrid,
  List,
  ExternalLink,
  XCircle,
  Star,
  Trash2,
  Send,
} from "lucide-react";
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
import { useAuth } from "@/lib/auth";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isKnockout, type QuestionType } from "@/components/screening-questions-builder";
import type { Row } from "@/lib/row-types";

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
  rating: number | null;
  rejection_reason: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  applicant_certifications: string[] | null;
  applicant_desired_shift: string | null;
  applicant_desired_employment_type: string | null;
  applicant_willing_to_relocate: boolean | null;
  applicant_headline: string | null;
  applicant_skills: string[] | null;
  profile?: { display_name: string | null; phone: string | null };
  seeker?: {
    headline: string | null;
    skills: string[] | null;
    certifications: string[] | null;
    desired_shift: string | null;
    desired_employment_type: string | null;
    willing_to_relocate: boolean | null;
  };
};

function snap<T>(s: T | null | undefined, fb: T | null | undefined): T | null {
  if (s !== null && s !== undefined) {
    if (Array.isArray(s)) return s.length > 0 ? s : (fb ?? null);
    if (s !== "") return s;
  }
  return fb ?? null;
}

function displayName(a: Applicant): string {
  return a.applicant_name || a.profile?.display_name || "Applicant";
}

function formatShift(s: string | null): string | null {
  if (!s) return null;
  const map: Record<string, string> = { first: "1st shift", second: "2nd shift", third: "3rd shift", weekend: "Weekends", any: "Any shift" };
  return map[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

function formatEmploymentType(s: string | null): string | null {
  if (!s) return null;
  const map: Record<string, string> = { full_time: "Full-time", part_time: "Part-time", contract: "Contract", temporary: "Temporary", seasonal: "Seasonal" };
  return map[s] ?? s.replace(/_/g, " ");
}

function candidateInfo(a: Applicant) {
  return {
    certifications: snap(a.applicant_certifications, a.seeker?.certifications) ?? [],
    skills: snap(a.applicant_skills, a.seeker?.skills) ?? [],
    shift: snap(a.applicant_desired_shift, a.seeker?.desired_shift),
    employmentType: snap(a.applicant_desired_employment_type, a.seeker?.desired_employment_type),
    willingToRelocate: snap(a.applicant_willing_to_relocate, a.seeker?.willing_to_relocate),
    headline: snap(a.applicant_headline, a.seeker?.headline),
    email: a.applicant_email,
  };
}

type AppNote = {
  id: string;
  application_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author?: { display_name: string | null };
};

function ApplicantsPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"board" | "table">("board");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<Applicant | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [hideKnockouts, setHideKnockouts] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: screening } = useQuery({
    queryKey: ["screening-with-answers", id],
    queryFn: async () => {
      const { data: qs } = await supabase
        .from("screening_questions")
        .select("id, type, knockout_answer")
        .eq("job_id", id);
      const { data: ans } = await supabase
        .from("application_answers")
        .select("application_id, question_id, answer")
        .in(
          "question_id",
          (qs ?? []).map((q: Row) => q.id).length
            ? (qs ?? []).map((q: Row) => q.id)
            : ["00000000-0000-0000-0000-000000000000"],
        );
      const qById: Record<string, { type: QuestionType; knockout_answer: unknown }> = {};
      (qs ?? []).forEach((q: Row) => {
        qById[q.id] = { type: q.type, knockout_answer: q.knockout_answer };
      });
      const knockedOut = new Set<string>();
      (ans ?? []).forEach((a: Row) => {
        const q = qById[a.question_id];
        if (q && isKnockout(q, a.answer)) knockedOut.add(a.application_id);
      });
      return { knockedOut };
    },
  });
  const knockedOut = useMemo(() => screening?.knockedOut ?? new Set<string>(), [screening]);

  const { data: job } = useQuery({
    queryKey: ["employer-job", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, slug, location, category")
        .eq("id", id)
        .maybeSingle();
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
      let seekersById: Record<string, Applicant["seeker"]> = {};
      if (ids.length) {
        const [{ data: profs }, { data: seekers }] = await Promise.all([
          supabase.from("profiles").select("id, display_name, phone").in("id", ids),
          supabase
            .from("seeker_profiles")
            .select("user_id, headline, skills, certifications, desired_shift, desired_employment_type, willing_to_relocate")
            .in("user_id", ids),
        ]);
        profilesById = (profs ?? []).reduce<typeof profilesById>((acc, p) => {
          acc[p.id] = { display_name: p.display_name, phone: p.phone };
          return acc;
        }, {});
        seekersById = (seekers ?? []).reduce<typeof seekersById>((acc, s: Row) => {
          acc[s.user_id] = {
            headline: s.headline ?? null,
            skills: s.skills ?? null,
            certifications: s.certifications ?? null,
            desired_shift: s.desired_shift ?? null,
            desired_employment_type: s.desired_employment_type ?? null,
            willing_to_relocate: s.willing_to_relocate ?? null,
          };
          return acc;
        }, {});
      }
      return (apps ?? []).map((a) => ({
        ...a,
        profile: profilesById[a.applicant_id],
        seeker: seekersById[a.applicant_id],
      })) as Applicant[];
    },
  });

  const visibleApplications = useMemo(
    () => (hideKnockouts ? applications.filter((a) => !knockedOut.has(a.id)) : applications),
    [applications, hideKnockouts, knockedOut],
  );

  const byStatus = useMemo(() => {
    const groups: Record<AppStatus, Applicant[]> = {
      submitted: [],
      reviewed: [],
      interview: [],
      hired: [],
      rejected: [],
    };
    for (const a of visibleApplications) {
      const key = (a.status === ("shortlisted" as AppStatus) ? "interview" : a.status) as AppStatus;
      if (groups[key]) groups[key].push(a);
    }
    return groups;
  }, [visibleApplications]);

  const patchLocal = (appId: string, patch: Partial<Applicant>) =>
    qc.setQueryData<Applicant[]>(["employer-applicants", id], (prev) =>
      (prev ?? []).map((a) => (a.id === appId ? { ...a, ...patch } : a)),
    );

  const updateStatus = async (appId: string, status: AppStatus, opts?: { silent?: boolean }) => {
    patchLocal(appId, { status });
    const { error } = await supabase.from("applications").update({ status }).eq("id", appId);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["employer-applicants", id] });
      return;
    }
    if (!opts?.silent) toast.success(`Moved to ${status}`);
  };

  const updateRating = async (appId: string, rating: number | null) => {
    patchLocal(appId, { rating });
    const { error } = await supabase
      .from("applications")
      .update({ rating } as never)
      .eq("id", appId);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["employer-applicants", id] });
    }
  };

  const activeApp = applications.find((a) => a.id === activeId) ?? null;
  const openApp = applications.find((a) => a.id === openId) ?? null;

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as AppStatus | undefined;
    const appId = e.active.id as string;
    if (!overId) return;
    const current = applications.find((a) => a.id === appId);
    if (!current || current.status === overId) return;
    if (overId === "rejected") {
      setRejectFor(current);
      setRejectReason(current.rejection_reason ?? "");
      return;
    }
    updateStatus(appId, overId);
  };

  const confirmReject = async () => {
    if (!rejectFor) return;
    const reason = rejectReason.trim() || null;
    patchLocal(rejectFor.id, { status: "rejected", rejection_reason: reason });
    const { error } = await supabase
      .from("applications")
      .update({ status: "rejected", rejection_reason: reason } as never)
      .eq("id", rejectFor.id);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ["employer-applicants", id] });
    } else {
      toast.success("Applicant rejected");
    }
    setRejectFor(null);
    setRejectReason("");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/employer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-caps text-primary">Applicants</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
              {job?.title ?? "Job"}
            </h1>
            {job && (
              <p className="mt-1 text-sm text-muted-foreground">
                {job.category} · {job.location} ·{" "}
                <Link
                  to="/jobs/$slug"
                  params={{ slug: job.slug }}
                  className="font-semibold text-primary hover:underline"
                >
                  View public listing <ExternalLink className="inline h-3 w-3" />
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {knockedOut.size > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="accent-[color:var(--primary)]"
                  checked={hideKnockouts}
                  onChange={(e) => setHideKnockouts(e.target.checked)}
                />
                Hide knockouts ({knockedOut.size})
              </label>
            )}
            <Tabs value={view} onValueChange={(v) => setView(v as "board" | "table")}>
              <TabsList>
                <TabsTrigger value="board" className="gap-1.5">
                  <LayoutGrid className="h-4 w-4" /> Board
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-1.5">
                  <List className="h-4 w-4" /> Table
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Loading applicants…</div>
      ) : applications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-base font-semibold text-[color:var(--ink)]">No applicants yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once seekers apply, you'll see them here.
          </p>
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
              <Column
                key={col.value}
                column={col}
                items={byStatus[col.value]}
                knockedOut={knockedOut}
                onReject={(a) => {
                  setRejectFor(a);
                  setRejectReason(a.rejection_reason ?? "");
                }}
                onOpen={(a) => setOpenId(a.id)}
              />
            ))}
          </div>
          <DragOverlay>{activeApp ? <ApplicantCard app={activeApp} dragging /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <TableView
          applications={visibleApplications}
          knockedOut={knockedOut}
          onStatusChange={(appId, status) => {
            if (status === "rejected") {
              const a = applications.find((x) => x.id === appId);
              if (a) {
                setRejectFor(a);
                setRejectReason(a.rejection_reason ?? "");
                return;
              }
            }
            updateStatus(appId, status);
          }}
          onReject={(a) => {
            setRejectFor(a);
            setRejectReason(a.rejection_reason ?? "");
          }}
          onOpen={(a) => setOpenId(a.id)}
        />
      )}

      <AlertDialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this applicant?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectFor ? displayName(rejectFor) : "Applicant"} will be moved to the Rejected
              column. The reason is recorded for your team only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (e.g. lacked forklift certification, unavailable on weekends)…"
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

      <Sheet open={!!openApp} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {openApp && (
            <ApplicantDrawer
              app={openApp}
              currentUserId={user?.id ?? null}
              onRate={(r) => updateRating(openApp.id, r)}
              onReject={() => {
                setRejectFor(openApp);
                setRejectReason(openApp.rejection_reason ?? "");
              }}
              onStatusChange={(s) => updateStatus(openApp.id, s)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Column({
  column,
  items,
  knockedOut,
  onReject,
  onOpen,
}: {
  column: { value: AppStatus; label: string; accent: string };
  items: Applicant[];
  knockedOut: Set<string>;
  onReject: (a: Applicant) => void;
  onOpen: (a: Applicant) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.value });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-border border-t-4 ${column.accent} bg-card p-3 transition-colors ${isOver ? "bg-muted/60" : ""}`}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--ink)]">
          {column.label}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="space-y-2 min-h-[60px]">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-2 py-4 text-center text-[11px] text-muted-foreground">
            Drop here
          </p>
        )}
        {items.map((a) => (
          <DraggableCard
            key={a.id}
            app={a}
            knockout={knockedOut.has(a.id)}
            onReject={() => onReject(a)}
            onOpen={() => onOpen(a)}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({
  app,
  knockout,
  onReject,
  onOpen,
}: {
  app: Applicant;
  knockout?: boolean;
  onReject: () => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: app.id });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing touch-none"
    >
      <ApplicantCard app={app} knockout={knockout} onReject={onReject} onOpen={onOpen} />
    </div>
  );
}

function StarRow({ value, size = "sm" }: { value: number | null; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  if (!value) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${cls} ${n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function ApplicantCard({
  app,
  dragging,
  knockout,
  onReject,
  onOpen,
}: {
  app: Applicant;
  dragging?: boolean;
  knockout?: boolean;
  onReject?: () => void;
  onOpen?: () => void;
}) {
  return (
    <div
      className={`rounded-lg border ${knockout ? "border-rose-300 bg-rose-50/40" : "border-border bg-background"} p-3 shadow-sm ${dragging ? "ring-2 ring-primary shadow-lg" : ""}`}
    >
      {knockout && (
        <p className="mb-1.5 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-800">
          <XCircle className="h-2.5 w-2.5" /> Knockout
        </p>
      )}
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-tint)] text-primary">
          <UserIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          {onOpen && !dragging ? (
            <button
              type="button"
              onClick={onOpen}
              onPointerDown={(e) => e.stopPropagation()}
              className="truncate text-left text-sm font-semibold text-[color:var(--ink)] hover:text-primary hover:underline"
            >
              {displayName(app)}
            </button>
          ) : (
            <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
              {displayName(app)}
            </p>
          )}
          {(() => {
            const info = candidateInfo(app);
            return info.headline ? (
              <p className="truncate text-[11px] text-muted-foreground">{info.headline}</p>
            ) : null;
          })()}
          <p className="text-[11px] text-muted-foreground">
            Applied{" "}
            {new Date(app.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        {app.rating && <StarRow value={app.rating} />}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {(app.applicant_phone || app.profile?.phone) && (
          <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Phone className="h-2.5 w-2.5" /> {app.applicant_phone || app.profile?.phone}
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
      {(() => {
        const info = candidateInfo(app);
        const shift = formatShift(info.shift);
        const et = formatEmploymentType(info.employmentType);
        const availability = [shift, et].filter(Boolean).join(" · ");
        const hasDetails =
          info.certifications.length > 0 || availability || info.willingToRelocate;
        if (!hasDetails) return null;
        return (
          <div className="mt-2 flex flex-wrap gap-1">
            {info.certifications.length > 0 && (
              <span className="inline-flex items-center rounded bg-[color:var(--primary-tint)] px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {info.certifications.slice(0, 3).join(", ")}
                {info.certifications.length > 3 ? ` +${info.certifications.length - 3}` : ""}
              </span>
            )}
            {availability && (
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {availability}
              </span>
            )}
            {info.willingToRelocate && (
              <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                Open to relocate
              </span>
            )}
          </div>
        );
      })()}
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
  knockedOut,
  onStatusChange,
  onReject,
  onOpen,
}: {
  applications: Applicant[];
  knockedOut: Set<string>;
  onStatusChange: (id: string, status: AppStatus) => void;
  onReject: (a: Applicant) => void;
  onOpen: (a: Applicant) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Applicant</th>
            <th className="px-4 py-3">Applied</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Resume</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {applications.map((a) => (
            <tr key={a.id} className="hover:bg-muted/30">
              <td className="px-4 py-3">
                <button
                  onClick={() => onOpen(a)}
                  className="text-left font-semibold text-[color:var(--ink)] hover:text-primary hover:underline"
                >
                  {a.profile?.display_name ?? "Applicant"}
                </button>
                {knockedOut.has(a.id) && (
                  <Badge
                    variant="outline"
                    className="ml-2 border-destructive/40 bg-destructive/10 text-[9px] font-semibold uppercase text-destructive"
                  >
                    Knockout
                  </Badge>
                )}
                {a.profile?.phone && (
                  <p className="text-xs text-muted-foreground">{a.profile.phone}</p>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-3">
                <StarRow value={a.rating} />
              </td>
              <td className="px-4 py-3">
                {a.resume_url ? (
                  <a
                    href={a.resume_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" /> View
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={`border ${statusStyles[a.status] ?? "bg-muted"} text-[10px] font-semibold uppercase`}
                >
                  {a.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Select
                    value={a.status}
                    onValueChange={(v) => onStatusChange(a.id, v as AppStatus)}
                  >
                    <SelectTrigger className="h-8 w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {a.resume_url && (
                    <Button asChild size="sm" variant="outline" className="h-8 gap-1">
                      <a href={a.resume_url} download>
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  {a.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onReject(a)}
                      className="h-8 gap-1 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    >
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

function RatingControl({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`Rate ${n} of 5`}
          className="p-0.5"
        >
          <Star
            className={`h-5 w-5 transition-colors ${n <= shown ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-300"}`}
          />
        </button>
      ))}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function ApplicantDrawer({
  app,
  currentUserId,
  onRate,
  onReject,
  onStatusChange,
}: {
  app: Applicant;
  currentUserId: string | null;
  onRate: (r: number | null) => void;
  onReject: () => void;
  onStatusChange: (s: AppStatus) => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ["application-notes", app.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("application_notes")
        .select("*")
        .eq("application_id", app.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const authorIds = Array.from(new Set((data ?? []).map((n: Row) => n.author_id)));
      let byId: Record<string, { display_name: string | null }> = {};
      if (authorIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", authorIds);
        byId = (profs ?? []).reduce<typeof byId>((acc, p) => {
          acc[p.id] = { display_name: p.display_name };
          return acc;
        }, {});
      }
      return (data ?? []).map((n: Row) => ({ ...n, author: byId[n.author_id] })) as AppNote[];
    },
  });

  const addNote = async () => {
    if (!currentUserId || !draft.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("application_notes").insert({
      application_id: app.id,
      author_id: currentUserId,
      body: draft.trim(),
    });
    setPosting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft("");
    qc.invalidateQueries({ queryKey: ["application-notes", app.id] });
  };

  const deleteNote = async (noteId: string) => {
    const { error } = await supabase.from("application_notes").delete().eq("id", noteId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["application-notes", app.id] });
  };

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>{app.profile?.display_name ?? "Applicant"}</SheetTitle>
        <SheetDescription>
          Applied{" "}
          {new Date(app.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap gap-2">
        {app.resume_url && (
          <>
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={app.resume_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> View resume
              </a>
            </Button>
            <Button asChild size="sm" variant="outline" className="gap-1">
              <a href={app.resume_url} download>
                <Download className="h-3.5 w-3.5" /> Download
              </a>
            </Button>
          </>
        )}
        <Select value={app.status} onValueChange={(v) => onStatusChange(v as AppStatus)}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLUMNS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {app.status !== "rejected" && (
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            className="gap-1 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          >
            <XCircle className="h-3.5 w-3.5" /> Reject…
          </Button>
        )}
      </div>

      {app.cover_letter && (
        <section>
          <p className="label-caps mb-1.5">Cover note</p>
          <p className="whitespace-pre-line rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground">
            {app.cover_letter}
          </p>
        </section>
      )}

      <section>
        <p className="label-caps mb-1.5">Rating</p>
        <RatingControl value={app.rating} onChange={onRate} />
      </section>

      {app.status === "rejected" && app.rejection_reason && (
        <section>
          <p className="label-caps mb-1.5 text-rose-700">Rejection reason</p>
          <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {app.rejection_reason}
          </p>
        </section>
      )}

      <section>
        <p className="label-caps mb-2">Team notes</p>
        <div className="space-y-2">
          {notesLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!notesLoading && notes.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
              No notes yet. Share your impressions with the rest of your team.
            </p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="group rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[color:var(--ink)]">
                  {n.author?.display_name ?? "Teammate"}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                {n.author_id === currentUserId && (
                  <button
                    type="button"
                    onClick={() => deleteNote(n.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-rose-600 group-hover:opacity-100"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-foreground">{n.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <Textarea
            placeholder="Add a note for your team…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={addNote}
              disabled={!draft.trim() || posting}
              className="gap-1"
            >
              <Send className="h-3.5 w-3.5" /> {posting ? "Posting…" : "Post note"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
