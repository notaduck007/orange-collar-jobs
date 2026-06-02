import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, ShieldCheck, Lock, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Roles & Permissions — Admin" }] }),
  component: AdminRoles,
});

type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_system: boolean;
};
type Permission = { key: string; name: string; description: string | null; category: string };

function AdminRoles() {
  const qc = useQueryClient();
  const canManage = usePermission("roles.manage");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Role> | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name");
      if (error) throw error;
      return data as Role[];
    },
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ["admin-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("permissions")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      return data as Permission[];
    },
  });

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["admin-role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role_id, permission_key");
      if (error) throw error;
      return data as Array<{ role_id: string; permission_key: string }>;
    },
  });

  const { data: counts = [] } = useQuery({
    queryKey: ["admin-role-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("role_member_counts");
      if (error) throw error;
      return data as Array<{ role_id: string; member_count: number }>;
    },
  });

  const countByRole = useMemo(
    () => Object.fromEntries(counts.map((c) => [c.role_id, c.member_count])),
    [counts],
  );
  const permsByRole = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const rp of rolePerms) {
      if (!m.has(rp.role_id)) m.set(rp.role_id, new Set());
      m.get(rp.role_id)!.add(rp.permission_key);
    }
    return m;
  }, [rolePerms]);
  const grouped = useMemo(() => {
    const g = new Map<string, Permission[]>();
    for (const p of permissions) {
      if (!g.has(p.category)) g.set(p.category, []);
      g.get(p.category)!.push(p);
    }
    return Array.from(g.entries());
  }, [permissions]);

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0] ?? null;
  const selectedRoleKey = selectedRole?.key;
  const selectedPerms = selectedRole
    ? (permsByRole.get(selectedRole.id) ?? new Set<string>())
    : new Set<string>();

  const togglePermission = async (permissionKey: string, has: boolean) => {
    if (!selectedRole || !canManage) return;
    if (selectedRole.key === "admin") {
      toast.error("The admin role keeps every permission.");
      return;
    }
    if (has) {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", selectedRole.id)
        .eq("permission_key", permissionKey);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("role_permissions").insert({
        role_id: selectedRole.id,
        permission_key: permissionKey,
      });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["admin-role-permissions"] });
  };

  const saveRole = async () => {
    if (!editing) return;
    const key = (editing.key ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    const name = (editing.name ?? "").trim();
    if (!name) return toast.error("Name is required");
    if (editing.id) {
      const { error } = await supabase
        .from("roles")
        .update({
          name,
          description: editing.description ?? null,
          ...(roles.find((r) => r.id === editing.id)?.is_system ? {} : { key }),
        })
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Role updated");
    } else {
      if (!key) return toast.error("Key is required");
      const { error } = await supabase
        .from("roles")
        .insert({ key, name, description: editing.description ?? null, is_system: false });
      if (error) return toast.error(error.message);
      toast.success("Role created");
    }
    setEditorOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  const deleteRole = async (role: Role) => {
    if (role.is_system) return toast.error("System roles cannot be deleted");
    if (
      !confirm(`Delete role "${role.name}"? Users with only this role will lose its permissions.`)
    )
      return;
    const { error } = await supabase.from("roles").delete().eq("id", role.id);
    if (error) return toast.error(error.message);
    toast.success("Role deleted");
    if (selectedRoleId === role.id) setSelectedRoleId(null);
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
    qc.invalidateQueries({ queryKey: ["admin-role-counts"] });
  };

  if (!canManage) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-semibold text-[color:var(--ink)]">
          Insufficient permissions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Requires the <b>roles.manage</b> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label-caps">Access control</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Roles & Permissions</h1>
          <p className="text-xs text-muted-foreground">
            {roles.length} roles · {permissions.length} permissions
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing({ key: "", name: "", description: "" });
            setEditorOpen(true);
          }}
          className="gap-1"
        >
          <Plus className="h-4 w-4" /> New role
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Roles list */}
        <aside className="space-y-1.5">
          {roles.map((r) => {
            const active = (selectedRole?.id ?? roles[0]?.id) === r.id;
            return (
              <div
                key={r.id}
                className={`rounded-md border p-3 transition-colors ${active ? "border-primary bg-[color:var(--primary-tint)]" : "border-border bg-card hover:bg-muted"}`}
              >
                <button
                  onClick={() => setSelectedRoleId(r.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]">
                      {r.name}
                      {r.is_system && (
                        <Lock className="h-3 w-3 text-muted-foreground" aria-label="System role" />
                      )}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {r.key} · {countByRole[r.id] ?? 0} member
                      {(countByRole[r.id] ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  {r.is_system && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      System
                    </Badge>
                  )}
                </button>
                <div className="mt-2 flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(r);
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  {!r.is_system && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRole(r);
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Permission editor for selected role */}
        <main className="rounded-lg border border-border bg-card">
          {!selectedRole ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Select a role to edit permissions.
            </div>
          ) : (
            <>
              <div className="border-b border-border p-4">
                <p className="text-sm font-semibold text-[color:var(--ink)]">{selectedRole.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedRole.description || "No description."}
                </p>
                {selectedRoleKey === "admin" && (
                  <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
                    The admin role implicitly holds every permission and cannot be reduced.
                  </p>
                )}
              </div>
              <div className="divide-y divide-border">
                {grouped.map(([category, perms]) => (
                  <div key={category} className="p-4">
                    <p className="label-caps mb-2 text-[10px] text-muted-foreground">{category}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {perms.map((p) => {
                        const has = selectedRoleKey === "admin" || selectedPerms.has(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`flex items-start gap-2 rounded-md border border-border p-2 ${selectedRoleKey === "admin" ? "opacity-70" : "cursor-pointer hover:bg-muted"}`}
                          >
                            <Checkbox
                              checked={has}
                              disabled={selectedRoleKey === "admin"}
                              onCheckedChange={() => togglePermission(p.key, has)}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-[color:var(--ink)]">
                                {p.name}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">{p.key}</p>
                              {p.description && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      <Dialog
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit role" : "New role"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <label className="label-caps text-[10px] text-muted-foreground">Key</label>
                <Input
                  value={editing.key ?? ""}
                  disabled={!!editing.id && roles.find((r) => r.id === editing.id)?.is_system}
                  onChange={(e) => setEditing({ ...editing, key: e.target.value })}
                  placeholder="e.g. moderator"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Lowercase, used in code. Cannot be changed for system roles.
                </p>
              </div>
              <div>
                <label className="label-caps text-[10px] text-muted-foreground">Name</label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Moderator"
                />
              </div>
              <div>
                <label className="label-caps text-[10px] text-muted-foreground">Description</label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEditorOpen(false);
                setEditing(null);
              }}
              className="gap-1"
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={saveRole} className="gap-1">
              <Save className="h-4 w-4" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
