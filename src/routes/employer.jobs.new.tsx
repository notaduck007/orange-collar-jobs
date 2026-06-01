import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { uniqueSlug } from "@/lib/slug";

export const Route = createFileRoute("/employer/jobs/new")({
  head: () => ({ meta: [{ title: "Post a Job — DockHire Employers" }] }),
  component: NewJobPage,
});

const SHIFTS = [
  { value: "first", label: "1st Shift (Day)" },
  { value: "second", label: "2nd Shift (Evening)" },
  { value: "third", label: "3rd Shift (Overnight)" },
  { value: "weekend", label: "Weekend" },
  { value: "flexible", label: "Flexible" },
];
const TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "temp", label: "Temp" },
  { value: "temp_to_hire", label: "Temp-to-Hire" },
  { value: "contract", label: "Contract" },
  { value: "seasonal", label: "Seasonal" },
];

const schema = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.string().min(1),
  shift: z.string().min(1),
  employment_type: z.string().min(1),
  description: z.string().trim().min(30).max(5000),
  requirements: z.string().trim().max(3000).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(2).max(2),
  zip: z.string().trim().max(10).optional(),
  pay_min: z.string().optional(),
  pay_max: z.string().optional(),
  pay_period: z.enum(["hour", "year"]),
});

function NewJobPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ["employer-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["job-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("job_categories").select("*").order("name");
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    title: "",
    category: "",
    shift: "first",
    employment_type: "full_time",
    description: "",
    requirements: "",
    city: company?.hq_city ?? "",
    state: company?.hq_state ?? "",
    zip: "",
    pay_min: "",
    pay_max: "",
    pay_period: "hour" as "hour" | "year",
    feature_it: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const postingCredits = company?.posting_credits ?? 0;
  const featuredCredits = company?.featured_credits ?? 0;
  const canPost = postingCredits > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !company) return;
    if (!canPost) {
      toast.error("Out of posting credits.");
      return;
    }

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const wantsFeatured = form.feature_it;
    if (wantsFeatured && featuredCredits < 1) {
      toast.error("Out of featured credits. Uncheck the featured option or buy a package.");
      return;
    }

    setSubmitting(true);
    try {
      const slug = uniqueSlug(form.title);
      const { error } = await supabase.from("jobs").insert({
        company_id: company.id,
        posted_by: user.id,
        title: form.title,
        slug,
        category: form.category,
        shift: form.shift,
        employment_type: form.employment_type,
        pay_min: form.pay_min ? Number(form.pay_min) : null,
        pay_max: form.pay_max ? Number(form.pay_max) : null,
        pay_period: form.pay_period,
        location: `${form.city}, ${form.state.toUpperCase()}${form.zip ? ` ${form.zip}` : ""}`,
        city: form.city,
        state: form.state.toUpperCase(),
        zip: form.zip || null,
        description: form.description,
        requirements: form.requirements || null,
        status: "active",
        featured: wantsFeatured,
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      });
      if (error) throw error;

      const { error: cErr } = await supabase
        .from("companies")
        .update({
          posting_credits: postingCredits - 1,
          featured_credits: featuredCredits - (wantsFeatured ? 1 : 0),
        })
        .eq("id", company.id);
      if (cErr) throw cErr;

      toast.success("Job posted!");
      qc.invalidateQueries({ queryKey: ["employer-company", user.id] });
      qc.invalidateQueries({ queryKey: ["employer-jobs", company.id] });
      navigate({ to: "/employer" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post job");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps text-primary">New job</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">Post a warehouse job</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {postingCredits} posting {postingCredits === 1 ? "credit" : "credits"} remaining ·{" "}
          {featuredCredits} featured.
        </p>
      </div>

      {!canPost && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          You're out of posting credits.{" "}
          <Link to="/pricing" className="font-semibold underline">Buy a package</Link> to post this job.
        </div>
      )}

      <form onSubmit={submit} className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="title">Job title *</Label>
            <Input id="title" required placeholder="e.g. Forklift Operator — 2nd Shift" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="Pick a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Shift *</Label>
            <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SHIFTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Employment type *</Label>
            <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Pay range</Label>
            <div className="flex items-center gap-1.5">
              <Input type="number" step="0.5" placeholder="Min" value={form.pay_min} onChange={(e) => setForm({ ...form, pay_min: e.target.value })} />
              <span className="text-muted-foreground">–</span>
              <Input type="number" step="0.5" placeholder="Max" value={form.pay_max} onChange={(e) => setForm({ ...form, pay_max: e.target.value })} />
              <Select value={form.pay_period} onValueChange={(v) => setForm({ ...form, pay_period: v as "hour" | "year" })}>
                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hour">/ hr</SelectItem>
                  <SelectItem value="year">/ yr</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_120px_140px]">
          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input id="city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State *</Label>
            <Input id="state" required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">ZIP</Label>
            <Input id="zip" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Job description *</Label>
          <Textarea
            id="description"
            rows={8}
            required
            placeholder="Describe the role, day-to-day tasks, equipment, team, schedule…"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={5000}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="requirements">Requirements</Label>
          <Textarea
            id="requirements"
            rows={5}
            placeholder="Certifications, experience, physical requirements, etc."
            value={form.requirements}
            onChange={(e) => setForm({ ...form, requirements: e.target.value })}
            maxLength={3000}
          />
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
          <Checkbox
            checked={form.feature_it}
            onCheckedChange={(c) => setForm({ ...form, feature_it: !!c })}
            disabled={featuredCredits < 1}
          />
          <div className="text-sm">
            <p className="font-semibold text-[color:var(--ink)]">Feature this job</p>
            <p className="text-xs text-muted-foreground">
              Highlight with the hazard-yellow badge and pin to the top of search.
              Uses 1 featured credit ({featuredCredits} available).
            </p>
          </div>
        </label>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/employer" })}>Cancel</Button>
          <Button type="submit" disabled={submitting || !canPost} className="btn-primary">
            {submitting ? "Posting…" : "Post job (uses 1 credit)"}
          </Button>
        </div>
      </form>
    </div>
  );
}
