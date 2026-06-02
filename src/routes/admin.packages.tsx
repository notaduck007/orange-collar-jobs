import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/packages")({
  head: () => ({ meta: [{ title: "Packages — WarehouseJobs Admin" }] }),
  component: AdminPackages,
});

type Pkg = {
  id: string;
  name: string;
  kind: string;
  price_cents: number;
  posting_count: number;
  featured_count: number;
  duration_days: number;
  ad_slot: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
};

const KINDS = ["posting", "featured", "advertising"];

function AdminPackages() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [open, setOpen] = useState(false);

  const { data: packages = [] } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Pkg[];
    },
  });

  const toggle = async (p: Pkg) => {
    const { error } = await supabase.from("packages").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(p.active ? "Disabled" : "Enabled");
      qc.invalidateQueries({ queryKey: ["admin-packages"] });
    }
  };
  const remove = async (p: Pkg) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from("packages").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-packages"] });
    }
  };

  const openEdit = (p: Pkg | null) => {
    setEditing(p);
    setOpen(true);
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Pricing</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Packages</h1>
        </div>
        <Button onClick={() => openEdit(null)} className="btn-primary gap-1.5">
          <Plus className="h-4 w-4" /> New package
        </Button>
      </div>

      <div className="grid gap-3">
        {packages.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[color:var(--ink)]">{p.name}</p>
                <Badge className="border-0 bg-blue-100 text-blue-900 capitalize">{p.kind}</Badge>
                {!p.active && (
                  <Badge className="border-0 bg-gray-100 text-gray-900">Disabled</Badge>
                )}
              </div>
              <p className="mt-1 text-sm font-bold text-primary">
                ${(p.price_cents / 100).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.posting_count} post · {p.featured_count} featured · {p.duration_days}d
                {p.ad_slot ? ` · ${p.ad_slot}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(p)} className="gap-1">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggle(p)} className="gap-1">
                <Power className="h-3.5 w-3.5" /> {p.active ? "Disable" : "Enable"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => remove(p)}
                className="gap-1 text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {packages.length === 0 && <p className="text-sm text-muted-foreground">No packages yet.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New package"}</DialogTitle>
          </DialogHeader>
          <PackageForm
            pkg={editing}
            onSaved={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["admin-packages"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PackageForm({ pkg, onSaved }: { pkg: Pkg | null; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: pkg?.name ?? "",
    kind: pkg?.kind ?? "posting",
    price_cents: pkg?.price_cents ?? 0,
    posting_count: pkg?.posting_count ?? 0,
    featured_count: pkg?.featured_count ?? 0,
    duration_days: pkg?.duration_days ?? 30,
    ad_slot: pkg?.ad_slot ?? "",
    description: pkg?.description ?? "",
    sort_order: pkg?.sort_order ?? 0,
    active: pkg?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      ad_slot: form.ad_slot || null,
      description: form.description || null,
    };
    const op = pkg
      ? supabase.from("packages").update(payload).eq("id", pkg.id)
      : supabase.from("packages").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success(pkg ? "Updated" : "Created");
      onSaved();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Kind</Label>
          <Select value={form.kind} onValueChange={(v) => set("kind", v)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Price (USD)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.price_cents / 100}
            onChange={(e) => set("price_cents", Math.round(Number(e.target.value) * 100))}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Posting credits</Label>
          <Input
            type="number"
            value={form.posting_count}
            onChange={(e) => set("posting_count", Number(e.target.value))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Featured credits</Label>
          <Input
            type="number"
            value={form.featured_count}
            onChange={(e) => set("featured_count", Number(e.target.value))}
            className="mt-1"
          />
        </div>
        <div>
          <Label>Duration (days)</Label>
          <Input
            type="number"
            value={form.duration_days}
            onChange={(e) => set("duration_days", Number(e.target.value))}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Ad slot (optional)</Label>
          <Input
            value={form.ad_slot}
            onChange={(e) => set("ad_slot", e.target.value)}
            placeholder="home_banner"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Sort order</Label>
          <Input
            type="number"
            value={form.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value))}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          className="mt-1"
          rows={2}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => set("active", e.target.checked)}
        />
        Active (visible on pricing page)
      </label>
      <Button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "Saving…" : "Save package"}
      </Button>
    </form>
  );
}
