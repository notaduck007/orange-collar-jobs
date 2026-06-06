import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Flag,
  LifeBuoy,
  Mail,
  Send,
  User2,
  Clock,
  ShieldCheck,
  Download,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Support — Admin" }] }),
  component: AdminSupport,
});

const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;
const REPORT_STATUSES = ["open", "reviewing", "resolved", "dismissed"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

const CANNED: { label: string; subject: string; body: string }[] = [
  {
    label: "Acknowledge",
    subject: "We received your message",
    body: "Hi,\n\nThanks for reaching out — we've received your message and a teammate will follow up shortly.\n\n— WarehouseJobs.com Support",
  },
  {
    label: "Need more info",
    subject: "A quick question about your request",
    body: "Hi,\n\nThanks for the report. Could you share a bit more detail (URL, screenshot, or timing) so we can investigate?\n\n— WarehouseJobs.com Support",
  },
  {
    label: "Resolved",
    subject: "Your request has been resolved",
    body: "Hi,\n\nWe've taken care of this. Let us know if you run into anything else.\n\n— WarehouseJobs.com Support",
  },
];

type Ticket = {
  id: string;
  user_id: string | null;
  email: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};
type Report = {
  id: string;
  reporter_id: string | null;
  entity_type: string;
  entity_id: string;
  reason: string;
  details: string | null;
  status: string;
  assigned_to: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

function AdminSupport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"tickets" | "reports" | "dsr">("tickets");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [dsrUserId, setDsrUserId] = useState("");
  const [dsrBusy, setDsrBusy] = useState<string | null>(null);

  const dsrQ = useQuery({
    queryKey: ["admin-dsr"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Array<{
        id: string;
        user_id: string;
        type: string;
        status: string;
        reason: string | null;
        created_at: string;
        processed_at: string | null;
      }>;
    },
  });

  const ticketsQ = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Ticket[];
    },
  });

  const reportsQ = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Report[];
    },
  });

  const tickets = useMemo(
    () => (ticketsQ.data ?? []).filter((t) => statusFilter === "all" || t.status === statusFilter),
    [ticketsQ.data, statusFilter],
  );
  const reports = useMemo(
    () => (reportsQ.data ?? []).filter((r) => statusFilter === "all" || r.status === statusFilter),
    [reportsQ.data, statusFilter],
  );

  const openTickets = (ticketsQ.data ?? []).filter((t) => t.status === "open").length;
  const openReports = (reportsQ.data ?? []).filter((r) => r.status === "open").length;

  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [openReport, setOpenReport] = useState<Report | null>(null);

  const updateTicket = async (id: string, patch: Partial<Ticket>): Promise<void> => {
    const { error } = await supabase.from("support_tickets").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: user!.id,
      action: "ticket_update",
      entity_type: "support_ticket",
      entity_id: id,
      metadata: patch as never,
    });
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    toast.success("Ticket updated");
  };

  const updateReport = async (id: string, patch: Partial<Report>): Promise<void> => {
    const { error } = await supabase.from("reports").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: user!.id,
      action: "report_update",
      entity_type: "report",
      entity_id: id,
      metadata: patch as never,
    });
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
    toast.success("Report updated");
  };

  const exportUserData = async (userId: string): Promise<void> => {
    setDsrBusy(userId + ":export");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ user_id: userId }),
        },
      );
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dsr-export-${userId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await supabase
        .from("deletion_requests")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("type", "export")
        .neq("status", "completed");
      qc.invalidateQueries({ queryKey: ["admin-dsr"] });
      toast.success("Export downloaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      toast.error(msg);
    } finally {
      setDsrBusy(null);
    }
  };

  const deleteUser = async (userId: string, mode: "soft" | "hard"): Promise<void> => {
    if (
      !confirm(`Confirm ${mode}-delete for user ${userId.slice(0, 8)}? This anonymizes their PII.`)
    )
      return;
    setDsrBusy(userId + ":delete");
    try {
      const { data, error } = await supabase.functions.invoke("delete-user-account", {
        body: { user_id: userId, mode },
      });
      if (error) throw error;
      const payload = data as { error?: string } | null;
      if (payload?.error) throw new Error(payload.error);
      await supabase
        .from("deletion_requests")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("type", "delete")
        .neq("status", "completed");
      toast.success(`User ${mode}-deleted`);
      qc.invalidateQueries({ queryKey: ["admin-dsr"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Deletion failed";
      toast.error(msg);
    } finally {
      setDsrBusy(null);
    }
  };

  const openDsr = (dsrQ.data ?? []).filter((d) => d.status !== "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Support</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Help desk</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tickets from the contact form and user-submitted reports.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Badge variant="secondary">
            <LifeBuoy className="mr-1 h-3 w-3" />
            {openTickets} open tickets
          </Badge>
          <Badge variant="secondary">
            <Flag className="mr-1 h-3 w-3" />
            {openReports} open reports
          </Badge>
          <Badge variant="secondary">
            <ShieldCheck className="mr-1 h-3 w-3" />
            {openDsr} open DSR
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as never)}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="tickets">Tickets ({openTickets})</TabsTrigger>
            <TabsTrigger value="reports">Reports ({openReports})</TabsTrigger>
            <TabsTrigger value="dsr">DSR ({openDsr})</TabsTrigger>
          </TabsList>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(tab === "tickets" ? TICKET_STATUSES : REPORT_STATUSES).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="tickets" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">From</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Received</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setOpenTicket(t)}
                    className="cursor-pointer border-t border-border hover:bg-muted/40"
                  >
                    <td className="px-3 py-2 font-medium">{t.subject}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {t.email}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{t.priority}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge>{t.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No tickets.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Reporter</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Received</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setOpenReport(r)}
                    className="cursor-pointer border-t border-border hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      <Badge variant="outline">{r.entity_type}</Badge>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {r.entity_id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{r.reason}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.reporter_id ? (
                        <span className="inline-flex items-center gap-1">
                          <User2 className="h-3 w-3" />
                          {r.reporter_id.slice(0, 8)}
                        </span>
                      ) : (
                        "anonymous"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge>{r.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No reports.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="dsr" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Fulfill a data-subject request</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Export or delete on behalf of a user (e.g. emailed privacy request). Actions are
              audited.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                placeholder="User UUID"
                value={dsrUserId}
                onChange={(e) => setDsrUserId(e.target.value)}
                className="w-80 font-mono text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!dsrUserId || dsrBusy === dsrUserId + ":export"}
                onClick={() => exportUserData(dsrUserId)}
              >
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!dsrUserId || dsrBusy === dsrUserId + ":delete"}
                onClick={() => deleteUser(dsrUserId, "soft")}
              >
                <ShieldCheck className="mr-2 h-4 w-4" /> Soft-delete (anonymize)
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={!dsrUserId || dsrBusy === dsrUserId + ":delete"}
                onClick={() => deleteUser(dsrUserId, "hard")}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Hard-delete
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Requested</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(dsrQ.data ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{d.user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{d.type}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge>{d.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{d.reason ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => exportUserData(d.user_id)}
                          disabled={dsrBusy === d.user_id + ":export"}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {d.type === "delete" && d.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteUser(d.user_id, "soft")}
                            disabled={dsrBusy === d.user_id + ":delete"}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!dsrQ.data || dsrQ.data.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      No requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <TicketSheet
        ticket={openTicket}
        onClose={() => setOpenTicket(null)}
        currentUserId={user?.id}
        onUpdate={updateTicket}
      />
      <ReportSheet
        report={openReport}
        onClose={() => setOpenReport(null)}
        currentUserId={user?.id}
        onUpdate={updateReport}
      />
    </div>
  );
}

function TicketSheet({
  ticket,
  onClose,
  currentUserId,
  onUpdate,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  currentUserId?: string;
  onUpdate: (id: string, patch: Partial<Ticket>) => Promise<void>;
}) {
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);

  const applyCanned = (c: (typeof CANNED)[number]) => {
    setReplySubject(c.subject);
    setReplyBody(c.body);
  };

  const send = async () => {
    if (!ticket) return;
    if (!replySubject.trim() || !replyBody.trim()) return toast.error("Subject and body required");
    setSending(true);
    const { error } = await supabase.functions.invoke("send-email", {
      body: { to: ticket.email, subject: replySubject, body: replyBody },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("audit_log").insert({
      actor_id: currentUserId!,
      action: "ticket_reply",
      entity_type: "support_ticket",
      entity_id: ticket.id,
      metadata: { subject: replySubject } as never,
    });
    toast.success("Reply sent");
    setReplySubject("");
    setReplyBody("");
    await onUpdate(ticket.id, { status: "pending" });
  };

  return (
    <Sheet open={!!ticket} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {ticket && (
          <>
            <SheetHeader>
              <SheetTitle>{ticket.subject}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {ticket.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(ticket.created_at).toLocaleString()}
                </span>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap">
                {ticket.body}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) => onUpdate(ticket.id, { status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select
                    value={ticket.priority}
                    onValueChange={(v) => onUpdate(ticket.id, { priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Assigned</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() =>
                      onUpdate(ticket.id, {
                        assigned_to: ticket.assigned_to === currentUserId ? null : currentUserId,
                      })
                    }
                  >
                    {ticket.assigned_to === currentUserId
                      ? "Unassign me"
                      : ticket.assigned_to
                        ? "Take over"
                        : "Assign to me"}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                  Reply
                </Label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {CANNED.map((c) => (
                    <Button
                      key={c.label}
                      variant="outline"
                      size="sm"
                      onClick={() => applyCanned(c)}
                    >
                      {c.label}
                    </Button>
                  ))}
                </div>
                <Input
                  className="mb-2"
                  placeholder="Subject"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                />
                <Textarea
                  rows={6}
                  placeholder="Write a reply…"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <Button onClick={send} disabled={sending} className="btn-primary mt-2 w-full">
                  <Send className="mr-1.5 h-4 w-4" /> {sending ? "Sending…" : "Send reply"}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReportSheet({
  report,
  onClose,
  currentUserId,
  onUpdate,
}: {
  report: Report | null;
  onClose: () => void;
  currentUserId?: string;
  onUpdate: (id: string, patch: Partial<Report>) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  return (
    <Sheet open={!!report} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {report && (
          <>
            <SheetHeader>
              <SheetTitle>Report: {report.reason}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{report.entity_type}</Badge>
                <span className="font-mono text-muted-foreground">{report.entity_id}</span>
              </div>
              {report.details && (
                <div className="rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap">
                  {report.details}
                </div>
              )}
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={report.status}
                  onValueChange={(v) => onUpdate(report.id, { status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  onUpdate(report.id, {
                    assigned_to: report.assigned_to === currentUserId ? null : currentUserId,
                  })
                }
              >
                {report.assigned_to === currentUserId
                  ? "Unassign me"
                  : report.assigned_to
                    ? "Take over"
                    : "Assign to me"}
              </Button>
              <div className="space-y-1.5 border-t border-border pt-4">
                <Label className="text-xs">Resolution note</Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you do?"
                />
                <div className="flex gap-2">
                  <Button
                    className="btn-primary flex-1"
                    onClick={() =>
                      onUpdate(report.id, {
                        status: "resolved",
                        resolution_note: note || null,
                        resolved_at: new Date().toISOString() as never,
                        resolved_by: currentUserId as never,
                      })
                    }
                  >
                    Mark resolved
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() =>
                      onUpdate(report.id, { status: "dismissed", resolution_note: note || null })
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
