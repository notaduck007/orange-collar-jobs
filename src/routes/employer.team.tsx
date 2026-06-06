import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/employer/team")({
  head: () => ({ meta: [{ title: "Team — WarehouseJobs.com Employer" }] }),
  component: EmployerTeam,
});

type MemberRole = "owner" | "admin" | "recruiter";
type MemberStatus = "invited" | "active" | "removed";
type Member = {
  id: string;
  company_id: string;
  user_id: string | null;
  role: MemberRole;
  invited_email: string | null;
  status: MemberStatus;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null } | null;
};

function EmployerTeam() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("recruiter");
  const [submitting, setSubmitting] = useState(false);

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
      const { data: m } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!m?.company_id) return null;
      const { data: c } = await supabase
        .from("companies")
        .select("*")
        .eq("id", m.company_id)
        .maybeSingle();
      return c ?? null;
    },
  });

  const isOwner = !!company && !!user && company.owner_id === user.id;

  const { data: members = [] } = useQuery({
    queryKey: ["company-members", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("id, company_id, user_id, role, invited_email, status, created_at")
        .eq("company_id", company!.id)
        .neq("status", "removed")
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = (data ?? []).map((m) => m.user_id).filter((id): id is string => !!id);
      let profilesById = new Map<
        string,
        { display_name: string | null; avatar_url: string | null }
      >();
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", userIds);
        profilesById = new Map(
          (profs ?? []).map((p) => [
            p.id,
            { display_name: p.display_name, avatar_url: p.avatar_url },
          ]),
        );
      }
      return (data ?? []).map((m) => ({
        ...m,
        profile: m.user_id ? (profilesById.get(m.user_id) ?? null) : null,
      })) as Member[];
    },
  });

  const myMembership = useMemo(
    () => members.find((m) => m.user_id === user?.id) ?? null,
    [members, user?.id],
  );
  const canManage = isOwner || myMembership?.role === "owner" || myMembership?.role === "admin";

  const invite = async () => {
    if (!company || !email.trim()) return;
    const clean = email.trim().toLowerCase();
    setSubmitting(true);
    try {
      // Check existing
      const { data: existing } = await supabase
        .from("company_members")
        .select("id, status")
        .eq("company_id", company.id)
        .ilike("invited_email", clean)
        .maybeSingle();

      if (existing) {
        if (existing.status === "removed") {
          await supabase
            .from("company_members")
            .update({ status: "invited", role })
            .eq("id", existing.id);
        } else {
          toast.info("That email is already on the team.");
          setSubmitting(false);
          return;
        }
      } else {
        const { error } = await supabase
          .from("company_members")
          .insert({ company_id: company.id, invited_email: clean, role, status: "invited" });
        if (error) throw error;
      }
      toast.success(`Invited ${clean}. They'll join on first sign-up.`);
      setEmail("");
      setRole("recruiter");
      qc.invalidateQueries({ queryKey: ["company-members", company.id] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setSubmitting(false);
    }
  };

  const changeRole = async (m: Member, next: MemberRole) => {
    if (m.role === "owner") {
      toast.error("Cannot change the owner role.");
      return;
    }
    const { error } = await supabase.from("company_members").update({ role: next }).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["company-members", company?.id] });
  };

  const remove = async (m: Member) => {
    if (m.role === "owner") {
      toast.error("Cannot remove the owner.");
      return;
    }
    if (
      !confirm(
        `Remove ${m.profile?.display_name || m.invited_email || "this member"} from the team?`,
      )
    )
      return;
    const { error } = await supabase
      .from("company_members")
      .update({ status: "removed" })
      .eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["company-members", company?.id] });
  };

  if (!company) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
        Set up your company first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[color:var(--ink)]">Team</h1>
        <p className="text-sm text-muted-foreground">
          Invite recruiters to collaborate on {company.name}.
        </p>
      </header>

      {canManage && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-[color:var(--ink)]">Invite a teammate</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <div className="space-y-1">
              <Label htmlFor="invite-email" className="sr-only">
                Email
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="recruiter@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={invite} disabled={submitting || !email.trim()} className="gap-1">
              <UserPlus className="h-4 w-4" /> Invite
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Invitees are linked automatically when they sign up using that email address.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {m.user_id ? (
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    ) : (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-semibold text-[color:var(--ink)]">
                        {m.profile?.display_name || m.invited_email || "Pending"}
                      </p>
                      {m.profile?.display_name && m.invited_email && (
                        <p className="text-xs text-muted-foreground">{m.invited_email}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {canManage && m.role !== "owner" ? (
                    <Select value={m.role} onValueChange={(v) => changeRole(m, v as MemberRole)}>
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recruiter">Recruiter</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                      {m.role}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-semibold uppercase ${
                      m.status === "active"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-700"
                    }`}
                  >
                    {m.status}
                  </Badge>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    {m.role !== "owner" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => remove(m)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td
                  colSpan={canManage ? 4 : 3}
                  className="px-4 py-10 text-center text-sm text-muted-foreground"
                >
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
