import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/row-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Categories — WarehouseJobs Admin" }] }),
  component: AdminCategories,
});

type Category = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  active: boolean;
  sort_order: number;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AdminCategories() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", icon: "" });
  const [saving, setSaving] = useState(false);

  const { data: cats = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_categories")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  async function patch(id: number, fields: Partial<Category>) {
    const { error } = await supabase.from("job_categories").update(fields).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
  }

  async function move(c: Category, dir: -1 | 1) {
    const idx = cats.findIndex((x) => x.id === c.id);
    const other = cats[idx + dir];
    if (!other) return;
    await Promise.all([
      supabase.from("job_categories").update({ sort_order: other.sort_order }).eq("id", c.id),
      supabase.from("job_categories").update({ sort_order: c.sort_order }).eq("id", other.id),
    ]);
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
  }

  async function remove(c: Category) {
    if (!confirm(`Delete category "${c.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("job_categories").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Category deleted");
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
  }

  async function create() {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      const slug = slugify(form.name);
      const nextSort = (cats[cats.length - 1]?.sort_order ?? 0) + 10;
      const { error } = await supabase.from("job_categories").insert({
        name: form.name.trim(),
        slug,
        icon: form.icon.trim() || null,
        sort_order: nextSort,
        active: true,
      });
      if (error) throw error;
      toast.success("Category created");
      setCreating(false);
      setForm({ name: "", icon: "" });
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    } catch (e: unknown) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label-caps">Site settings</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Job categories</h1>
          <p className="text-sm text-muted-foreground">
            Add, rename, reorder, or deactivate the categories shown in job posting and search.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New category
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left w-24">Order</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Slug</th>
              <th className="px-3 py-2 text-left w-32">Icon</th>
              <th className="px-3 py-2 text-left w-28">Active</th>
              <th className="px-3 py-2 text-right w-24"></th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c, i) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={i === 0}
                      onClick={() => move(c, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={i === cats.length - 1}
                      onClick={() => move(c, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Input
                    defaultValue={c.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== c.name) patch(c.id, { name: v });
                    }}
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.slug}</td>
                <td className="px-3 py-2">
                  <Input
                    defaultValue={c.icon ?? ""}
                    placeholder="emoji or name"
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (c.icon ?? "")) patch(c.id, { icon: v || null });
                    }}
                    className="h-8"
                  />
                </td>
                <td className="px-3 py-2">
                  <Switch checked={c.active} onCheckedChange={(v) => patch(c.id, { active: v })} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && cats.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No categories yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
              {form.name && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Slug: <span className="font-mono">{slugify(form.name)}</span>
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Icon (optional)</label>
              <Input
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                className="mt-1"
                placeholder="📦 or lucide name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
