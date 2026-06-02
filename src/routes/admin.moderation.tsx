import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, AlertTriangle, ExternalLink, Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/moderation")({
  head: () => ({ meta: [{ title: "Moderation hub — WarehouseJobs Admin" }] }),
  component: ModerationHub,
});

type TabKey = "jobs" | "ads" | "reviews" | "reports";
type Action = "approve" | "reject" | "escalate";

type Item = {
  id: string;
  kind: TabKey;
  title: string;
  subtitle?: string;
  body?: string;
  ownerEmailHint?: string;
  ownerUserId?: string | null;
  href?: string;
  meta?: Record<string, unknown>;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "jobs", label: "Jobs" },
  { key: "ads", label: "Ads" },
  { key: "reviews", label: "Reviews" },
  { key: "reports", label: "Abuse reports" },
];

function ModerationHub() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("jobs");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [dialog, setDialog] = useState<{ action: Action; ids: string[] } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // ---- Data ----------------------------------------------------------------
  const jobsQ = useQuery({
    queryKey: ["mod-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, description, location, status, posted_by, companies(name)")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const adsQ = useQuery({
    queryKey: ["mod-ads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("advertisements")
        .select("id, slot, image_url, target_url, owner_id, companies(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const reviewsQ = useQuery({
    queryKey: ["mod-reviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("id, title, body, rating, status, author_id, flag_reason, companies(name)")
        .eq("status", "flagged")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const reportsQ = useQuery({
    queryKey: ["mod-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("abuse_reports")
        .select("id, entity_type, entity_id, reason, details, reporter_id, status")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const items: Item[] = useMemo(() => {
    if (tab === "jobs") {
      return (jobsQ.data ?? []).map((j: any) => ({
        id: j.id,
        kind: "jobs",
        title: j.title,
        subtitle: `${j.companies?.name ?? "Unknown company"} · ${j.location ?? ""}`,
        body: j.description,
        ownerUserId: j.posted_by,
        href: `/jobs/${j.id}`,
      }));
    }
    if (tab === "ads") {
      return (adsQ.data ?? []).map((a: any) => ({
        id: a.id,
        kind: "ads",
        title: `${a.companies?.name ?? "Unknown"} — ${a.slot}`,
        subtitle: a.target_url,
        body: a.image_url,
        ownerUserId: a.owner_id,
        meta: { image_url: a.image_url },
      }));
    }
    if (tab === "reviews") {
      return (reviewsQ.data ?? []).map((r: any) => ({
        id: r.id,
        kind: "reviews",
        title: `${r.title ?? "Review"} · ${r.rating}★ — ${r.companies?.name ?? ""}`,
        subtitle: r.flag_reason ? `Flagged: ${r.flag_reason}` : "Flagged review",
        body: r.body,
        ownerUserId: r.author_id,
      }));
    }
    return (reportsQ.data ?? []).map((r: any) => ({
      id: r.id,
      kind: "reports",
      title: `${r.entity_type} report — ${r.reason}`,
      subtitle: `Target: ${r.entity_id}`,
      body: r.details ?? "",
      ownerUserId: r.reporter_id,
      meta: { entity_type: r.entity_type, entity_id: r.entity_id },
    }));
  }, [tab, jobsQ.data, adsQ.data, reviewsQ.data, reportsQ.data]);

  useEffect(() => {
    setSelected(new Set());
    setCursor(0);
  }, [tab]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const openAction = useCallback(
    (action: Action, ids?: string[]) => {
      const target = ids && ids.length ? ids : selected.size ? [...selected] : items[cursor] ? [items[cursor].id] : [];
      if (!target.length) {
        toast.error("Nothing selected");
        return;
      }
      setReason("");
      setDialog({ action, ids: target });
    },
    [selected, cursor, items],
  );

  // ---- Keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (dialog) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "j") setCursor((c) => Math.min(items.length - 1, c + 1));
      else if (e.key === "k") setCursor((c) => Math.max(0, c - 1));
      else if (e.key === "x") {
        const it = items[cursor];
        if (it) toggle(it.id);
      } else if (e.key === "a") openAction("approve");
      else if (e.key === "r") openAction("reject");
      else if (e.key === "e") openAction("escalate");
      else if (e.key >= "1" && e.key <= "4") {
        setTab(TABS[Number(e.key) - 1].key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, items, cursor, openAction]);

  // ---- Submit --------------------------------------------------------------
  const submit = async () => {
    if (!dialog) return;
    if ((dialog.action === "reject" || dialog.action === "escalate") && reason.trim().length < 3) {
      toast.error("Reason required");
      return;
    }
    setBusy(true);
    try {
      for (const id of dialog.ids) {
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        await applyAction(item, dialog.action, reason.trim(), user?.id);
      }
      toast.success(
        `${dialog.action} applied to ${dialog.ids.length} item${dialog.ids.length === 1 ? "" : "s"}`,
      );
      setDialog(null);
      setReason("");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["mod-jobs"] });
      qc.invalidateQueries({ queryKey: ["mod-ads"] });
      qc.invalidateQueries({ queryKey: ["mod-reviews"] });
      qc.invalidateQueries({ queryKey: ["mod-reports"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const counts = {
    jobs: jobsQ.data?.length ?? 0,
    ads: adsQ.data?.length ?? 0,
    reviews: reviewsQ.data?.length ?? 0,
    reports: reportsQ.data?.length ?? 0,
  };

  return (
    <div>
      <p className="label-caps">Moderation</p>
      <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Moderation hub</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Shortcuts: <kbd className="kbd">1–4</kbd> tabs · <kbd className="kbd">j/k</kbd> move ·{" "}
        <kbd className="kbd">x</kbd> select · <kbd className="kbd">a</kbd> approve ·{" "}
        <kbd className="kbd">r</kbd> reject · <kbd className="kbd">e</kbd> escalate
      </p>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.key
                ? "border-primary font-semibold text-[color:var(--ink)]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} <span className="ml-1 rounded bg-muted px-1.5 text-[11px]">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {selected.size > 0 ? `${selected.size} selected` : `${items.length} items`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => openAction("approve")} className="btn-primary gap-1">
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAction("reject")} className="gap-1">
            <X className="h-4 w-4" /> Reject
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAction("escalate")} className="gap-1">
            <AlertTriangle className="h-4 w-4" /> Escalate
          </Button>
        </div>
      </div>

      {/* List */}
      <div className="mt-4 grid gap-3">
        {items.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nothing to review here. 🎉
          </div>
        )}
        {items.map((it, idx) => (
          <div
            key={it.id}
            onClick={() => setCursor(idx)}
            className={`flex gap-3 rounded-lg border bg-card p-4 transition-colors ${
              cursor === idx ? "border-primary" : "border-border"
            }`}
          >
            <Checkbox
              checked={selected.has(it.id)}
              onCheckedChange={() => toggle(it.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {it.kind}
                </Badge>
                <p className="font-semibold text-[color:var(--ink)]">{it.title}</p>
                {it.href && (
                  <Link
                    to={it.href}
                    className="ml-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {it.subtitle && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{it.subtitle}</p>
              )}
              {it.kind === "ads" && it.meta?.image_url ? (
                <img
                  src={String(it.meta.image_url)}
                  alt="creative"
                  className="mt-2 max-h-32 rounded border border-border object-contain"
                />
              ) : (
                it.body && (
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-foreground">
                    {it.body}
                  </p>
                )
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button size="sm" onClick={() => openAction("approve", [it.id])} className="btn-primary gap-1">
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAction("reject", [it.id])}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => openAction("escalate", [it.id])}>
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{dialog?.action} {dialog?.ids.length} item{dialog && dialog.ids.length === 1 ? "" : "s"}</DialogTitle>
            <DialogDescription>
              {dialog?.action === "approve"
                ? "Content will be published and the owner notified."
                : dialog?.action === "reject"
                ? "Provide a reason. The owner will be notified."
                : "Escalate to a super admin with a note."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              dialog?.action === "approve"
                ? "Optional note for the audit log"
                : "Required reason / note"
            }
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy} className="btn-primary gap-1">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Action handler --------------------------------------------------------
async function applyAction(item: Item, action: Action, reason: string, actorId?: string) {
  let notifyTitle = "";
  let notifyBody = "";
  let notifyLink: string | undefined;

  if (item.kind === "jobs") {
    notifyLink = `/jobs/${item.id}`;
    if (action === "approve") {
      const { error } = await supabase.from("jobs").update({ status: "published" }).eq("id", item.id);
      if (error) throw error;
      notifyTitle = "Your job posting is live";
      notifyBody = `"${item.title}" has been approved and is now visible to job seekers.`;
    } else if (action === "reject") {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "draft" })
        .eq("id", item.id);
      if (error) throw error;
      notifyTitle = "Your job posting needs changes";
      notifyBody = `"${item.title}" was not approved. Reason: ${reason}`;
    } else {
      notifyTitle = "Your job posting was escalated";
      notifyBody = `"${item.title}" is under additional review. ${reason}`;
    }
  } else if (item.kind === "ads") {
    if (action === "approve") {
      const { error } = await supabase
        .from("advertisements")
        .update({ status: "active" })
        .eq("id", item.id);
      if (error) throw error;
      notifyTitle = "Your ad is now running";
      notifyBody = `Your ad has been approved and will start showing in its slot.`;
    } else if (action === "reject") {
      const { error } = await supabase
        .from("advertisements")
        .update({ status: "rejected" })
        .eq("id", item.id);
      if (error) throw error;
      notifyTitle = "Your ad was not approved";
      notifyBody = `Reason: ${reason}`;
    } else {
      notifyTitle = "Your ad was escalated";
      notifyBody = `Additional review in progress. ${reason}`;
    }
  } else if (item.kind === "reviews") {
    if (action === "approve") {
      // Approving a flagged review = restore to published, clear flags
      const { error } = await supabase
        .from("reviews")
        .update({ status: "published", flag_count: 0, flag_reason: null })
        .eq("id", item.id);
      if (error) throw error;
      notifyTitle = "Your review was restored";
      notifyBody = `After review, your post was reinstated.`;
    } else if (action === "reject") {
      const { error } = await supabase
        .from("reviews")
        .update({ status: "removed" })
        .eq("id", item.id);
      if (error) throw error;
      notifyTitle = "Your review was removed";
      notifyBody = `Reason: ${reason}`;
    } else {
      notifyTitle = "Your review is being escalated";
      notifyBody = reason;
    }
  } else if (item.kind === "reports") {
    const newStatus = action === "approve" ? "resolved" : action === "reject" ? "rejected" : "escalated";
    const { error } = await supabase
      .from("abuse_reports")
      .update({
        status: newStatus,
        resolved_by: actorId ?? null,
        resolution_note: reason || null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (error) throw error;
    notifyTitle = `Your report was ${newStatus}`;
    notifyBody = reason || "Thanks for flagging this content.";
  }

  // Audit log
  await supabase.from("audit_log").insert({
    actor_id: actorId ?? null,
    action,
    entity_type: item.kind,
    entity_id: item.id,
    reason: reason || null,
    metadata: item.meta ?? null,
  });

  // In-app notification to owner / reporter
  if (item.ownerUserId) {
    await supabase.from("notifications").insert({
      user_id: item.ownerUserId,
      sender_id: actorId ?? null,
      type: "moderation",
      title: notifyTitle,
      body: notifyBody,
      link: notifyLink ?? null,
    });

    // Send email (best effort)
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", item.ownerUserId)
        .maybeSingle();
      await supabase.functions.invoke("send-email", {
        body: {
          to: item.ownerUserId,
          to_name: prof?.display_name ?? null,
          subject: notifyTitle,
          body: notifyBody,
        },
      });
    } catch {
      // Non-fatal — notification is the source of truth.
    }
  }
}
