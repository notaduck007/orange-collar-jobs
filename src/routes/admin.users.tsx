import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — DockHire Admin" }] }),
  component: AdminUsers,
});

function AdminUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users", q],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, display_name, full_name, phone, location, active, created_at, user_roles(role)")
        .order("created_at", { ascending: false });
      if (q) query = query.or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const setRole = async (userId: string, role: AppRole) => {
    // Replace user's role row
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
  };

  const toggleActive = async (userId: string, active: boolean) => {
    const { error } = await supabase.from("profiles").update({ active: !active }).eq("id", userId);
    if (error) toast.error(error.message);
    else { toast.success(active ? "Deactivated" : "Reactivated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">People</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">All users</h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" className="h-7 w-56 border-0 bg-transparent p-0 focus-visible:ring-0" />
        </div>
      </div>

      <div className="grid gap-2">
        {users.map((u) => {
          const rolesField = u.user_roles as unknown;
          const rolesArr = Array.isArray(rolesField) ? (rolesField as Array<{ role: AppRole }>) : rolesField ? [rolesField as { role: AppRole }] : [];
          const role = (rolesArr[0]?.role ?? "job_seeker") as AppRole;
          return (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[color:var(--ink)]">{u.display_name || u.full_name || u.id.slice(0, 8)}</p>
                  {!u.active && <Badge className="border-0 bg-red-100 text-red-900">Deactivated</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {u.location ?? "—"} · joined {new Date(u.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={role} onValueChange={(v) => setRole(u.id, v as AppRole)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job_seeker">Job seeker</SelectItem>
                    <SelectItem value="employer">Employer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => toggleActive(u.id, u.active)} className="gap-1">
                  {u.active ? <><UserX className="h-3.5 w-3.5" /> Deactivate</> : <><UserCheck className="h-3.5 w-3.5" /> Reactivate</>}
                </Button>
              </div>
            </div>
          );
        })}
        {users.length === 0 && <p className="text-sm text-muted-foreground">No users match.</p>}
      </div>
    </div>
  );
}
