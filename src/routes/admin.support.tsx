import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Flag, LifeBuoy, Mail, Send, User2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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
    body: "Hi,\n\nThanks for reaching out — we've received your message and a teammate will follow up shortly.\n\n— WarehouseJobs Support",
  },
  {
    label: "Need more info",
    subject: "A quick question about your request",
    body: "Hi,\n\nThanks for the report. Could you share a bit more detail (URL, screenshot, or timing) so we can investigate?\n\n— WarehouseJobs Support",
  },
  {
    label: "Resolved",
    subject: "Your request has been resolved",
    body: "Hi,\n\nWe've taken care of this. Let us know if you run into anything else.\n\n— WarehouseJobs Support",
  },
];

type Ticket = {
  id: string; user_id: string | null; email: string;
  subject: string; body: string; status: string; priority: string;
  assigned_to: string | null; created_at: string; updated_at: string;
};
type Report = {
  id: string; reporter_id: string | null; entity_type: string; entity_id: string;
  reason: string; details: string | null; status: string;
  assigned_to: string | null; resolution_note: string | null;
  resolved_at: string | null; resolved_by: string | null; created_at: string;
};

function AdminSupport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"tickets" | "reports">("tickets");
  const [statusFilter, setStatusFilter] = useState<string>("open");

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
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_log").insert({
      actor_id: user!.id, action: "ticket_update",
      entity_type: "support_ticket", entity_id: id,
      metadata: patch as never,
    });
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    toast.success("Ticket updated");
  };

  const updateReport = async (id: string, patch: Partial<Report>): Promise<void> => {
    const { error } = await supabase.from("reports").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_log").insert({
      actor_id: user!.id, action: "report_update",
      entity_type: "report", entity_id: id,
      metadata: patch as never,
    });
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
    toast.success("Report updated");
  };

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
          <Badge variant="secondary"><LifeBuoy className="mr-1 h-3 w-3" />{openTickets} open tickets</Badge>
          <Badge variant="secondary"><Flag className="mr-1 h-3 w-3" />{openReports} open reports</Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as never)}>
        <div className="flex items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="tickets">Tickets ({openTickets})</TabsTrigger>
            <TabsTrigger value="reports">Reports ({openReports})</TabsTrigger>
          </TabsList>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(tab === "tickets" ? TICKET_STATUSES : REPORT_STATUSES).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
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
                  <tr key={t.id} onClick={() => setOpenTicket(t)}
                      className="cursor-pointer border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">{t.subject}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{t.email}</span>
                    </td>
                    <td className="px-3 py-2"><Badge variant="outline">{t.priority}</Badge></td>
                    <td className="px-3 py-2"><Badge>{t.status}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No tickets.</td></tr>
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
                  <tr key={r.id} onClick={() => setOpenReport(r)}
                      className="cursor-pointer border-t border-border hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Badge variant="outline">{r.entity_type}</Badge>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">{r.entity_id.slice(0,8)}</span>
                    </td>
                    <td className="px-3 py-2 font-medium">{r.reason}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.reporter_id ? <span className="inline-flex items-center gap-1"><User2 className="h-3 w-3" />{r.reporter_id.slice(0,8)}</span> : "anonymous"}
                    </td>
                    <td className="px-3 py-2"><Badge>{r.status}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No reports.</td></tr>
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
  ticket, onClose, currentUserId, onUpdate,
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
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_log").insert({
      actor_id: currentUserId!, action: "ticket_reply",
      entity_type: "support_ticket", entity_id: ticket.id,
      metadata: { subject: replySubject } as never,
    });
    toast.success("Reply sent");
    setReplySubject(""); setReplyBody("");
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
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{ticket.email}</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(ticket.created_at).toLocaleString()}</span>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3 whitespace-pre-wrap">{ticket.body}</div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={ticket.status} onValueChange={(v) => onUpdate(ticket.id, { status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={ticket.priority} onValueChange={(v) => onUpdate(ticket.id, { priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                    {ticket.assigned_to === currentUserId ? "Unassign me" : ticket.assigned_to ? "Take over" : "Assign to me"}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">Reply</Label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {CANNED.map((c) => (
                    <Button key={c.label} variant="outline" size="sm" onClick={() => applyCanned(c)}>
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
  report, onClose, currentUserId, onUpdate,
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
                <Select value={report.status} onValueChange={(v) => onUpdate(report.id, { status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                {report.assigned_to === currentUserId ? "Unassign me" : report.assigned_to ? "Take over" : "Assign to me"}
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
                    onClick={() => onUpdate(report.id, { status: "dismissed", resolution_note: note || null })}
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
