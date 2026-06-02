import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Search,
  UserCheck,
  UserX,
  KeyRound,
  MailCheck,
  ShieldCheck,
  Eye,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { startImpersonation } from "@/lib/impersonation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAdminPermissions } from "@/lib/admin-permissions";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type RoleRef = { id: string; key: string; name: string; is_system: boolean };

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — WarehouseJobs Admin" }] }),
  component: AdminUsers,
});

type Row = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  active: boolean;
  created_at: string;
  roles: RoleRef[];
};

function AdminUsers() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { can, loading: permsLoading } = useAdminPermissions();
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [signedFilter, setSignedFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [openUserId, setOpenUserId] = useState<string | null>(null);

  const { data: rolesCatalog = [] } = useQuery({
    queryKey: ["roles-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("id, key, name, is_system")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as RoleRef[];
    },
  });
  const roleByKey = useMemo(
    () => Object.fromEntries(rolesCatalog.map((r) => [r.key, r])),
    [rolesCatalog],
  );

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", q, rolesCatalog.length],
    enabled: can("users") && rolesCatalog.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, display_name, full_name, phone, location, active, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (q)
        query = query.or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      const profiles = data ?? [];
      const ids = profiles.map((p) => p.id);
      const rolesByUser = new Map<string, string[]>();
      if (ids.length > 0) {
        const { data: assigns, error: aerr } = await supabase
          .from("user_role_assignments")
          .select("user_id, role_id")
          .in("user_id", ids);
        if (aerr) throw aerr;
        for (const a of assigns ?? []) {
          const list = rolesByUser.get(a.user_id) ?? [];
          list.push(a.role_id);
          rolesByUser.set(a.user_id, list);
        }
      }
      const byId = new Map(rolesCatalog.map((r) => [r.id, r]));
      return profiles.map((u): Row => {
        const roleIds = rolesByUser.get(u.id) ?? [];
        const roles = roleIds.map((rid) => byId.get(rid)).filter(Boolean) as RoleRef[];
        return { ...u, roles };
      });
    },
  });

  const filtered = useMemo(() => {
    const cutoff = (() => {
      if (signedFilter === "all") return null;
      const d = new Date();
      d.setDate(d.getDate() - (signedFilter === "7d" ? 7 : signedFilter === "30d" ? 30 : 90));
      return d;
    })();
    return users.filter((u) => {
      if (roleFilter !== "all" && !u.roles.some((r) => r.key === roleFilter)) return false;
      if (statusFilter === "active" && !u.active) return false;
      if (statusFilter === "suspended" && u.active) return false;
      if (cutoff && new Date(u.created_at) < cutoff) return false;
      return true;
    });
  }, [users, roleFilter, statusFilter, signedFilter]);

  const invokeAction = async (payload: Record<string, unknown>, successMsg: string) => {
    const { data, error } = await supabase.functions.invoke("admin-user-actions", {
      body: payload,
    });
    if (error || (data as { error?: string })?.error) {
      toast.error((data as { error?: string })?.error ?? error?.message ?? "Action failed");
      return false;
    }
    toast.success(successMsg);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
    return true;
  };

  const grantRoleById = async (userId: string, roleId: string) => {
    const { error } = await supabase
      .from("user_role_assignments")
      .insert({ user_id: userId, role_id: roleId });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Role granted");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
    qc.invalidateQueries({ queryKey: ["admin-role-counts"] });
    return true;
  };
  const revokeRoleById = async (userId: string, roleId: string) => {
    const adminRole = roleByKey["admin"];
    if (adminRole && roleId === adminRole.id && userId === me?.id) {
      if (!confirm("Revoke your OWN admin role? You will immediately lose admin access."))
        return false;
    }
    const { error } = await supabase
      .from("user_role_assignments")
      .delete()
      .eq("user_id", userId)
      .eq("role_id", roleId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Role revoked");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
    qc.invalidateQueries({ queryKey: ["admin-role-counts"] });
    return true;
  };
  const toggleRoleById = (userId: string, roleId: string, has: boolean) =>
    has ? revokeRoleById(userId, roleId) : grantRoleById(userId, roleId);

  const toggleActive = (userId: string, active: boolean) =>
    invokeAction(
      { action: active ? "suspend" : "reactivate", user_id: userId },
      active ? "User suspended" : "User reactivated",
    );
  const sendReset = (userId: string) =>
    invokeAction({ action: "password_reset", user_id: userId }, "Password reset email sent");
  const resendVerify = (userId: string) =>
    invokeAction({ action: "resend_verification", user_id: userId }, "Verification email resent");
  const impersonate = async (u: Row) => {
    if (!confirm("Sign in as this user? Your session will be paused and all actions are audited."))
      return;
    const label = u.display_name || u.full_name || u.id.slice(0, 8);
    const roleKeys = u.roles.map((r) => r.key);
    const redirectTo = roleKeys.includes("employer")
      ? "/employer"
      : roleKeys.includes("job_seeker")
        ? "/seeker"
        : "/";
    try {
      await startImpersonation(u.id, { label, kind: "user", redirectTo });
      toast.success("Now viewing as user");
      window.location.assign(redirectTo);
    } catch (e) {
      toast.error((e as Error).message || "Impersonation failed");
    }
  };

  if (permsLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!can("users")) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-semibold text-[color:var(--ink)]">
          Insufficient permissions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Requires the <b>users</b> capability.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">People</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">User console</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {users.length} users
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or phone…"
              className="h-7 w-56 border-0 bg-transparent p-0 focus-visible:ring-0"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="job_seeker">Job seekers</SelectItem>
              <SelectItem value="employer">Employers</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={signedFilter}
            onValueChange={(v) => setSignedFilter(v as typeof signedFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Signed up" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              filtered.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <button
                      onClick={() => setOpenUserId(u.id)}
                      className="font-semibold text-[color:var(--ink)] hover:underline"
                    >
                      {u.display_name || u.full_name || u.id.slice(0, 8)}
                    </button>
                    {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {rolesCatalog.map((r) => {
                        const has = u.roles.some((ur) => ur.id === r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => toggleRoleById(u.id, r.id, has)}
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                              has
                                ? r.key === "admin"
                                  ? "border-primary bg-primary/15 text-primary"
                                  : r.is_system
                                    ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                                    : "border-violet-300 bg-violet-100 text-violet-900"
                                : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                            }`}
                            title={has ? `Revoke ${r.name}` : `Grant ${r.name}`}
                          >
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  </TableCell>

                  <TableCell>
                    {u.active ? (
                      <Badge className="border-0 bg-emerald-100 text-emerald-900">Active</Badge>
                    ) : (
                      <Badge className="border-0 bg-red-100 text-red-900">Suspended</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.location ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOpenUserId(u.id)}
                        className="h-8 gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => impersonate(u)}
                        className="h-8 gap-1"
                        title="Impersonate"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(u.id, u.active)}
                        className="h-8 gap-1"
                      >
                        {u.active ? (
                          <>
                            <UserX className="h-3.5 w-3.5" /> Suspend
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" /> Reactivate
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  No users match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <UserDrawer
        userId={openUserId}
        rolesCatalog={rolesCatalog}
        onOpenChange={(o) => !o && setOpenUserId(null)}
        onSuspend={(id, active) => toggleActive(id, active)}
        onReset={(id) => sendReset(id)}
        onResend={(id) => resendVerify(id)}
        onToggleRole={(id, roleId, has) => toggleRoleById(id, roleId, has)}
      />
    </div>
  );
}

function UserDrawer({
  userId,
  rolesCatalog,
  onOpenChange,
  onSuspend,
  onReset,
  onResend,
  onToggleRole,
}: {
  userId: string | null;
  rolesCatalog: RoleRef[];
  onOpenChange: (o: boolean) => void;
  onSuspend: (id: string, active: boolean) => void;
  onReset: (id: string) => void;
  onResend: (id: string) => void;
  onToggleRole: (id: string, roleId: string, has: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const id = userId!;
      const [profileR, rolesR, companiesR, jobsR, appsR, auditR, metaR, permsR] = await Promise.all(
        [
          supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
          supabase.from("user_role_assignments").select("role_id").eq("user_id", id),
          supabase
            .from("companies")
            .select("id, name, slug, verified, created_at")
            .eq("owner_id", id),
          supabase
            .from("jobs")
            .select("id, title, status, created_at")
            .eq("posted_by", id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("applications")
            .select("id, job_id, status, created_at")
            .eq("applicant_id", id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("audit_log")
            .select("id, action, reason, metadata, created_at, actor_id")
            .eq("entity_type", "user")
            .eq("entity_id", id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase.functions.invoke("admin-user-actions", {
            body: { action: "get_meta", user_id: id },
          }),
          supabase.rpc("get_user_permissions", { _user_id: id }),
        ],
      );

      // Fetch orders for any companies owned by user
      let orders: Array<{
        id: string;
        amount_cents: number;
        currency: string;
        status: string;
        created_at: string;
        receipt_url: string | null;
      }> = [];
      const companyIds = (companiesR.data ?? []).map((c) => c.id);
      if (companyIds.length) {
        const { data } = await supabase
          .from("orders")
          .select("id, amount_cents, currency, status, created_at, receipt_url")
          .in("company_id", companyIds)
          .order("created_at", { ascending: false })
          .limit(50);
        orders = data ?? [];
      }

      const meta = (metaR.data ?? {}) as {
        email?: string | null;
        email_confirmed_at?: string | null;
        last_sign_in_at?: string | null;
        banned_until?: string | null;
        created_at?: string | null;
      };

      const roleIds = ((rolesR.data ?? []) as Array<{ role_id: string }>).map((r) => r.role_id);
      const effectivePerms = (
        (permsR.data ?? []) as Array<string | { get_user_permissions: string }>
      ).map((r) => (typeof r === "string" ? r : r.get_user_permissions));

      return {
        profile: profileR.data,
        roleIds,
        effectivePerms,
        companies: companiesR.data ?? [],
        jobs: jobsR.data ?? [],
        applications: appsR.data ?? [],
        orders,
        audit: auditR.data ?? [],
        meta,
      };
    },
  });

  return (
    <Sheet open={!!userId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {data?.profile?.display_name || data?.profile?.full_name || "User"}
          </SheetTitle>
          <SheetDescription>
            {data?.meta?.email ?? "—"} · joined{" "}
            {data?.meta?.created_at ? new Date(data.meta.created_at).toLocaleDateString() : "—"}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !data ? (
          <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-3 text-xs">
              <Meta
                label="Email verified"
                value={
                  data.meta?.email_confirmed_at
                    ? new Date(data.meta.email_confirmed_at).toLocaleString()
                    : "Unverified"
                }
              />
              <Meta
                label="Last sign in"
                value={
                  data.meta?.last_sign_in_at
                    ? new Date(data.meta.last_sign_in_at).toLocaleString()
                    : "Never"
                }
              />
              <Meta
                label="Banned until"
                value={
                  data.meta?.banned_until ? new Date(data.meta.banned_until).toLocaleString() : "—"
                }
              />
              <Meta label="Phone" value={data.profile?.phone ?? "—"} />
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5">
                <span className="label-caps text-[10px] text-muted-foreground">Roles</span>
                {rolesCatalog.map((r) => {
                  const has = data.roleIds.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => userId && onToggleRole(userId, r.id, has)}
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        has
                          ? r.key === "admin"
                            ? "border-primary bg-primary/15 text-primary"
                            : r.is_system
                              ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                              : "border-violet-300 bg-violet-100 text-violet-900"
                          : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {has ? "✓ " : "+ "}
                      {r.name}
                    </button>
                  );
                })}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => userId && onSuspend(userId, !!data.profile?.active)}
                className="gap-1"
              >
                {data.profile?.active ? (
                  <>
                    <UserX className="h-3.5 w-3.5" /> Suspend
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" /> Reactivate
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => userId && onReset(userId)}
                className="gap-1"
              >
                <KeyRound className="h-3.5 w-3.5" /> Force password reset
              </Button>
              {!data.meta?.email_confirmed_at && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => userId && onResend(userId)}
                  className="gap-1"
                >
                  <MailCheck className="h-3.5 w-3.5" /> Resend verification
                </Button>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="label-caps mb-1.5 text-[10px] text-muted-foreground">
                Effective permissions ({data.effectivePerms.length})
              </p>
              {data.roleIds.some((id) => rolesCatalog.find((r) => r.id === id)?.key === "admin") ? (
                <p className="text-xs text-[color:var(--ink)]">
                  Administrator — implicitly holds all permissions.
                </p>
              ) : data.effectivePerms.length === 0 ? (
                <p className="text-xs text-muted-foreground">No permissions granted.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {data.effectivePerms.sort().map((p) => (
                    <span
                      key={p}
                      className="rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ink)]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Tabs defaultValue="companies">
              <TabsList>
                <TabsTrigger value="companies">Companies ({data.companies.length})</TabsTrigger>
                <TabsTrigger value="jobs">Jobs ({data.jobs.length})</TabsTrigger>
                <TabsTrigger value="applications">
                  Applications ({data.applications.length})
                </TabsTrigger>
                <TabsTrigger value="orders">Orders ({data.orders.length})</TabsTrigger>
                <TabsTrigger value="audit">Audit ({data.audit.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="companies" className="space-y-1.5">
                {data.companies.map((c) => (
                  <Item
                    key={c.id}
                    title={c.name}
                    subtitle={`${c.verified ? "Verified · " : ""}${new Date(c.created_at).toLocaleDateString()}`}
                  />
                ))}
                {data.companies.length === 0 && <Empty />}
              </TabsContent>
              <TabsContent value="jobs" className="space-y-1.5">
                {data.jobs.map((j) => (
                  <Item
                    key={j.id}
                    title={j.title}
                    subtitle={`${j.status} · ${new Date(j.created_at).toLocaleDateString()}`}
                  />
                ))}
                {data.jobs.length === 0 && <Empty />}
              </TabsContent>
              <TabsContent value="applications" className="space-y-1.5">
                {data.applications.map((a) => (
                  <Item
                    key={a.id}
                    title={`Application ${a.id.slice(0, 8)}`}
                    subtitle={`${a.status} · ${new Date(a.created_at).toLocaleDateString()}`}
                  />
                ))}
                {data.applications.length === 0 && <Empty />}
              </TabsContent>
              <TabsContent value="orders" className="space-y-1.5">
                {data.orders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-md border border-border bg-card p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        ${(o.amount_cents / 100).toFixed(2)} {o.currency.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.status} · {new Date(o.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {o.receipt_url && (
                      <a
                        href={o.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Receipt
                      </a>
                    )}
                  </div>
                ))}
                {data.orders.length === 0 && <Empty />}
              </TabsContent>
              <TabsContent value="audit" className="space-y-1.5">
                {data.audit.map((a) => (
                  <div key={a.id} className="rounded-md border border-border bg-card p-2 text-xs">
                    <p className="font-medium text-[color:var(--ink)]">{a.action}</p>
                    <p className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()}
                      {a.reason ? ` · ${a.reason}` : ""}
                    </p>
                  </div>
                ))}
                {data.audit.length === 0 && <Empty />}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-caps text-[10px] text-muted-foreground">{label}</p>
      <p className="text-[color:var(--ink)]">{value}</p>
    </div>
  );
}
function Item({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-2 text-sm">
      <p className="font-medium text-[color:var(--ink)]">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}
function Empty() {
  return <p className="text-xs text-muted-foreground">Nothing here yet.</p>;
}
