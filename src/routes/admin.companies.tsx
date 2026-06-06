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
  FileText,
  X,
  Check,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { startImpersonation } from "@/lib/impersonation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Company = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
  hq_city: string | null;
  hq_state: string | null;
  owner_id: string | null;
  status: string;
  verified: boolean;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  verified_at: string | null;
  verified_by: string | null;
  verification_evidence_url: string | null;
  verification_note: string | null;
  posting_credits: number;
  featured_credits: number;
  created_at: string;
};

function AdminCompanies() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const { data: companies = [] } = useQuery({
    queryKey: ["admin-companies", q, tab],
    queryFn: async () => {
      let query = supabase.from("companies").select("*").order("created_at", { ascending: false });
      if (tab === "pending") query = query.eq("verification_status", "pending");
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const updateCompany = async (id: string, patch: Partial<Company>) => {
    const { error } = await supabase.from("companies").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    }
  };

  const decide = async (c: Company, approve: boolean, reason: string) => {
    if (!approve && !reason.trim()) {
      toast.error("Reason required to reject");
      return false;
    }
    const patch: Partial<Company> = approve
      ? ({
          verified: true,
          verification_status: "verified",
          verified_at: new Date().toISOString(),
          verified_by: user?.id ?? null,
          verification_note: reason || null,
        } as Partial<Company>)
      : {
          verified: false,
          verification_status: "rejected",
          verified_by: user?.id ?? null,
          verification_note: reason,
        };
    const { error } = await supabase.from("companies").update(patch).eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (user) {
      await supabase.from("audit_log").insert({
        actor_id: user.id,
        action: approve ? "company_verify_approve" : "company_verify_reject",
        entity_type: "company",
        entity_id: c.id,
        reason: reason || null,
      });
    }
    if (c.owner_id) {
      await supabase.from("notifications").insert({
        user_id: c.owner_id,
        sender_id: user?.id ?? null,
        type: "verification",
        title: approve ? "Your company is verified" : "Verification rejected",
        body: approve
          ? `${c.name} is now marked as a Verified employer.`
          : `Verification for ${c.name} was rejected. Reason: ${reason}`,
        link: `/employer`,
      });
      try {
        await supabase.functions.invoke("send-email", {
          body: {
            to: c.owner_id,
            subject: approve ? "Your company is verified" : "Verification rejected",
            body: approve
              ? `${c.name} is now a Verified employer on WarehouseJobs.com.`
              : `We couldn't verify ${c.name}. Reason: ${reason}`,
          },
        });
      } catch {
        /* email is best-effort */
      }
    }
    toast.success(approve ? "Approved" : "Rejected");
    qc.invalidateQueries({ queryKey: ["admin-companies"] });
    return true;
  };

  const renderRow = (c: Company) => (
    <div key={c.id} className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {c.logo_url ? (
            <img src={c.logo_url} alt={c.name} className="h-12 w-12 rounded object-cover" />
          ) : (
            <div className="h-12 w-12 rounded bg-muted" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-[color:var(--ink)]">{c.name}</p>
              <VerificationPill status={c.verification_status} />
              {c.status === "suspended" && (
                <Badge className="border-0 bg-red-100 text-red-900">Suspended</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {[c.industry, c.hq_city, c.hq_state].filter(Boolean).join(" · ") || "—"}
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
            <p className="mt-1 text-xs text-muted-foreground">
              {c.posting_credits} post · {c.featured_credits} featured credits
            </p>
            {c.verification_note && (
              <p className="mt-1 text-xs italic text-muted-foreground">
                Note: {c.verification_note}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.verification_evidence_url && <EvidenceLink path={c.verification_evidence_url} />}
          <Link to="/admin/jobs" search={{ company: c.id } as never}>
            <Button size="sm" variant="outline" className="gap-1">
              <Eye className="h-3.5 w-3.5" /> Jobs
            </Button>
          </Link>
          {c.owner_id && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              title="Open this company's employer dashboard as their owner"
              onClick={async () => {
                if (!c.owner_id) return;
                if (
                  !confirm(
                    `View ${c.name}'s employer dashboard as the owner? All actions are audited.`,
                  )
                )
                  return;
                try {
                  await startImpersonation(c.owner_id, {
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
          {c.verification_status === "pending" ? (
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
                    ? { verified: false, verification_status: "unverified" }
                    : {
                        verified: true,
                        verification_status: "verified",
                        verified_at: new Date().toISOString(),
                      },
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
          <CreditsDialog company={c} onSave={(patch) => updateCompany(c.id, patch)} />
        </div>
      </div>
    </div>
  );

  const pendingCount = companies.filter((c) => c.verification_status === "pending").length;

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

function VerificationPill({ status }: { status: Company["verification_status"] }) {
  const map = {
    unverified: { label: "Unverified", cls: "bg-muted text-muted-foreground" },
    pending: { label: "Pending review", cls: "bg-amber-100 text-amber-900" },
    verified: { label: "Verified", cls: "bg-blue-100 text-blue-900" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-900" },
  } as const;
  const s = map[status] ?? map.unverified;
  return <Badge className={`border-0 ${s.cls}`}>{s.label}</Badge>;
}

function EvidenceLink({ path }: { path: string }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.storage
        .from("company-verification")
        .createSignedUrl(path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      window.open(data.signedUrl, "_blank");
    } catch (e) {
      toast.error((e as Error).message || "Could not open evidence");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="outline" onClick={open} disabled={busy} className="gap-1">
      <FileText className="h-3.5 w-3.5" /> Evidence
    </Button>
  );
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

function CreditsDialog({
  company,
  onSave,
}: {
  company: { id: string; name: string; posting_credits: number; featured_credits: number };
  onSave: (patch: { posting_credits: number; featured_credits: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(company.posting_credits);
  const [featured, setFeatured] = useState(company.featured_credits);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Credits
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust credits — {company.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Posting credits</Label>
            <Input
              type="number"
              value={posting}
              onChange={(e) => setPosting(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Featured credits</Label>
            <Input
              type="number"
              value={featured}
              onChange={(e) => setFeatured(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <Button
            onClick={() => {
              onSave({ posting_credits: posting, featured_credits: featured });
              setOpen(false);
            }}
            className="btn-primary w-full"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
