import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/seeker/alerts")({
  head: () => ({ meta: [{ title: "Job Alerts — WarehouseJobs" }] }),
  component: AlertsPage,
});

function AlertsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    keyword: "",
    category_id: "",
    city: "",
    state: "",
    frequency: "daily",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["job-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("job_categories").select("id, name").eq("active", true).order("sort_order").order("name");
      return data ?? [];
    },
  });

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["seeker-alerts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("job_alerts")
        .select("*, job_categories(name)")
        .eq("applicant_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createAlert = async () => {
    if (!user) return;
    if (!form.keyword && !form.category_id && !form.city) {
      toast.error("Add at least one of: keyword, category, or city.");
      return;
    }
    const { error } = await supabase.from("job_alerts").insert({
      applicant_id: user.id,
      keyword: form.keyword || null,
      category_id: form.category_id ? Number(form.category_id) : null,
      city: form.city || null,
      state: form.state ? form.state.toUpperCase() : null,
      frequency: form.frequency,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Alert created");
      qc.invalidateQueries({ queryKey: ["seeker-alerts", user.id] });
      qc.invalidateQueries({ queryKey: ["seeker-stats", user.id] });
      setOpen(false);
      setForm({ keyword: "", category_id: "", city: "", state: "", frequency: "daily" });
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("job_alerts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Alert removed");
      qc.invalidateQueries({ queryKey: ["seeker-alerts", user?.id] });
      qc.invalidateQueries({ queryKey: ["seeker-stats", user?.id] });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps text-primary">Notifications</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">Job alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get notified when new warehouse jobs match your criteria.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary">
              <Plus className="mr-1 h-4 w-4" /> New alert
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a job alert</DialogTitle>
              <DialogDescription>
                Use any combination of keyword, category, and location. We'll email you when matching jobs are posted.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="kw">Keyword</Label>
                <Input
                  id="kw"
                  placeholder="e.g. forklift, reach, cherry picker"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    maxLength={2}
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">As soon as posted</SelectItem>
                    <SelectItem value="daily">Daily digest</SelectItem>
                    <SelectItem value="weekly">Weekly digest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button className="btn-primary" onClick={createAlert}>
                Create alert
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <BellRing className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-base font-semibold text-[color:var(--ink)]">No active alerts</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one above, or open a search on{" "}
            <Link to="/jobs" className="font-semibold text-primary hover:underline">
              Find Jobs
            </Link>{" "}
            and tap "Create alert from this search".
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {alerts.map((a: any) => (
            <div
              key={a.id}
              className="flex items-start justify-between rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {a.keyword && (
                    <span className="rounded-md bg-[color:var(--primary-tint)] px-2 py-0.5 font-semibold text-primary">
                      "{a.keyword}"
                    </span>
                  )}
                  {a.job_categories?.name && (
                    <span className="rounded-md border border-border px-2 py-0.5">
                      {a.job_categories.name}
                    </span>
                  )}
                  {(a.city || a.state) && (
                    <span className="rounded-md border border-border px-2 py-0.5">
                      {[a.city, a.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {a.frequency === "instant"
                    ? "As soon as posted"
                    : a.frequency === "weekly"
                    ? "Weekly digest"
                    : "Daily digest"}{" "}
                  · created {new Date(a.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(a.id)}
                className="shrink-0 text-muted-foreground hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
