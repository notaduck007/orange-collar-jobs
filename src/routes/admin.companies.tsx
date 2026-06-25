import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Search,
  ShieldCheck,
  ShieldOff,
  Eye,
  Ban,
  Play,
  BadgeCheck,
  X,
  Check,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { apiClient } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-session";
import type { AdminCompanyRecord } from "@/lib/api-client";
import { startImpersonation } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/companies")({
  head: () => ({ meta: [{ title: "Companies — WarehouseJobs.com Admin" }] }),
  component: AdminCompanies,
});

type Company = AdminCompanyRecord;

function AdminCompanies() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["admin-companies", q, tab],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return [];
      const res = await apiClient.adminListCompanies(token, {
        q: q || undefined,
        verificationStatus: tab === "pending" ? "pending" : undefined,
      });
      return res.data;
    },
  });

  const updateCompany = async (
    id: string,
    patch: Parameters<typeof apiClient.adminUpdateCompany>[2],
  ) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiClient.adminUpdateCompany(token, id, patch);
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const decide = async (c: Company, approve: boolean, reason: string) => {
    if (!approve && !reason.trim()) {
      toast.error("Reason required to reject");
      return false;
    }
    const token = getAccessToken();
    if (!token) return false;
    try {
      await apiClient.adminUpdateCompany(
        token,
        c.id,
        approve
          ? { verified: true, verificationStatus: "verified", verificationNote: reason || null }
          : { verified: false, verificationStatus: "rejected", verificationNote: reason },
      );
      toast.success(approve ? "Approved" : "Rejected");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
      return false;
    }
  };

  const renderRow = (c: Company) => (
    <div key={c.id} className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt={c.name} className="h-12 w-12 rounded object-cover" />
          ) : (
            <div className="h-12 w-12 rounded bg-muted" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[color:var(--ink)]">{c.name}</p>
              <VerificationPill status={c.verificationStatus} />
              {c.status === "suspended" && (
                <Badge className="border-0 bg-red-100 text-red-900">Suspended</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {[c.industry, c.hqCity, c.hqState].filter(Boolean).join(" · ") || "—"}
            </p>
            {c.website && (
              <a
                href={c.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {c.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {c.verificationNote && (
              <p className="mt-1 text-xs italic text-muted-foreground">
                Note: {c.verificationNote}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Evidence link requires signed URL from storage — available via future endpoint */}
          <Link to="/admin/jobs" search={{ company: c.id } as never}>
            <Button size="sm" variant="outline" className="gap-1">
              <Eye className="h-3.5 w-3.5" /> Jobs
            </Button>
          </Link>
          {c.ownerId && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              title="Open this company's employer dashboard as their owner"
              onClick={async () => {
                if (!c.ownerId) return;
                if (
                  !confirm(
                    `View ${c.name}'s employer dashboard as the owner? All actions are audited.`,
                  )
                )
                  return;
                try {
                  await startImpersonation(c.ownerId!, {
                    label: c.name,
                    kind: "company",
                    entityId: c.id,
                    redirectTo: "/employer",
                  });
                  toast.success(`Now viewing as ${c.name}`);
                  window.location.assign("/employer");
                } catch (e) {
                  toast.error((e as Error).message || "Could not start impersonation");
                }
              }}
            >
              <UserCog className="h-3.5 w-3.5" /> View as
            </Button>
          )}
          {c.verificationStatus === "pending" ? (
            <>
              <DecisionDialog
                kind="approve"
                trigger={
                  <Button size="sm" className="gap-1 bg-blue-600 text-white hover:bg-blue-700">
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                }
                onConfirm={(reason) => decide(c, true, reason)}
              />
              <DecisionDialog
                kind="reject"
                trigger={
                  <Button size="sm" variant="outline" className="gap-1 text-red-600">
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                }
                onConfirm={(reason) => decide(c, false, reason)}
              />
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateCompany(
                  c.id,
                  c.verified
                    ? { verified: false, verificationStatus: "unverified" as const }
                    : { verified: true, verificationStatus: "verified" as const },
                )
              }
              className="gap-1"
            >
              {c.verified ? (
                <>
                  <ShieldOff className="h-3.5 w-3.5" /> Unverify
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" /> Verify
                </>
              )}
            </Button>
          )}
          {c.status === "suspended" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateCompany(c.id, { status: "active" })}
              className="gap-1"
            >
              <Play className="h-3.5 w-3.5" /> Reactivate
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateCompany(c.id, { status: "suspended" })}
              className="gap-1"
            >
              <Ban className="h-3.5 w-3.5" /> Suspend
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const pendingCount = companies.filter((c) => c.verificationStatus === "pending").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Companies</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">
            Verification & management
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name…"
            className="w-56 bg-transparent text-sm focus:outline-none"
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "all")}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <BadgeCheck className="h-3.5 w-3.5" /> Verification queue
            {tab === "pending" && pendingCount > 0 && (
              <Badge className="ml-1 border-0 bg-amber-200 text-amber-900">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All companies</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <div className="grid gap-3">
            {companies.map(renderRow)}
            {companies.length === 0 && (
              <p className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                The verification queue is empty.
              </p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <div className="grid gap-3">
            {companies.map(renderRow)}
            {companies.length === 0 && (
              <p className="text-sm text-muted-foreground">No companies match.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function VerificationPill({ status }: { status: Company["verificationStatus"] }) {
  const map = {
    unverified: { label: "Unverified", cls: "bg-muted text-muted-foreground" },
    pending: { label: "Pending review", cls: "bg-amber-100 text-amber-900" },
    verified: { label: "Verified", cls: "bg-blue-100 text-blue-900" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-900" },
  } as const;
  const s = map[status] ?? map.unverified;
  return <Badge className={`border-0 ${s.cls}`}>{s.label}</Badge>;
}

function DecisionDialog({
  kind,
  trigger,
  onConfirm,
}: {
  kind: "approve" | "reject";
  trigger: React.ReactNode;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setReason("");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {kind === "approve" ? "Approve verification" : "Reject verification"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>
            {kind === "approve" ? "Internal note (optional)" : "Reason (sent to the employer)"}
          </Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder={
              kind === "approve"
                ? "Confirmed via domain email…"
                : "Could not confirm business registration…"
            }
          />
        </div>
        <DialogFooter>
          <Button
            disabled={busy || (kind === "reject" && !reason.trim())}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm(reason);
              setBusy(false);
              if (ok) setOpen(false);
            }}
            className={
              kind === "approve"
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-red-600 text-white hover:bg-red-700"
            }
          >
            {busy ? "Saving…" : kind === "approve" ? "Approve" : "Reject"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
