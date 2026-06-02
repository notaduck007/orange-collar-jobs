import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScreeningQuestionsBuilder,
  type ScreeningQuestionDraft,
} from "@/components/screening-questions-builder";

export const Route = createFileRoute("/employer/jobs/$id/edit")({
  head: () => ({ meta: [{ title: "Edit Job — WarehouseJobs Employers" }] }),
  component: EditJobPage,
});

const SHIFTS = [
  { value: "first", label: "1st Shift" },
  { value: "second", label: "2nd Shift" },
  { value: "third", label: "3rd Shift" },
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

function EditJobPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: job, isLoading } = useQuery({
    queryKey: ["employer-job", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    title: "",
    category: "",
    shift: "first",
    employment_type: "full_time",
    description: "",
    requirements: "",
    city: "",
    state: "",
    zip: "",
    pay_min: "",
    pay_max: "",
    pay_period: "hour" as "hour" | "year",
  });
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<ScreeningQuestionDraft[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);

  const { data: dbQuestions } = useQuery({
    queryKey: ["screening-questions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screening_questions")
        .select("*")
        .eq("job_id", id)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (dbQuestions && !questionsLoaded) {
      setQuestions(
        dbQuestions.map((q: any, i: number) => ({
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          options: Array.isArray(q.options) ? q.options : [],
          required: q.required,
          knockout_answer: q.knockout_answer,
          sort_order: q.sort_order ?? i,
        })),
      );
      setQuestionsLoaded(true);
    }
  }, [dbQuestions, questionsLoaded]);

  useEffect(() => {
    if (!job) return;
    setForm({
      title: job.title ?? "",
      category: job.category ?? "",
      shift: job.shift ?? "first",
      employment_type: job.employment_type ?? "full_time",
      description: job.description ?? "",
      requirements: job.requirements ?? "",
      city: job.city ?? "",
      state: job.state ?? "",
      zip: job.zip ?? "",
      pay_min: job.pay_min?.toString() ?? "",
      pay_max: job.pay_max?.toString() ?? "",
      pay_period: (job.pay_period as "hour" | "year") ?? "hour",
    });
  }, [job]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          title: form.title,
          category: form.category,
          shift: form.shift as never,
          employment_type: form.employment_type as never,
          description: form.description,
          requirements: form.requirements || null,
          city: form.city,
          state: form.state.toUpperCase(),
          zip: form.zip || null,
          location: `${form.city}, ${form.state.toUpperCase()}${form.zip ? ` ${form.zip}` : ""}`,
          pay_min: form.pay_min ? Number(form.pay_min) : null,
          pay_max: form.pay_max ? Number(form.pay_max) : null,
          pay_period: form.pay_period,
        })
        .eq("id", id);
      if (error) throw error;

      // Replace screening questions: simplest approach — wipe and re-insert.
      const { error: delErr } = await supabase
        .from("screening_questions")
        .delete()
        .eq("job_id", id);
      if (delErr) throw delErr;
      const validQs = questions.filter((q) => q.prompt.trim().length > 0);
      if (validQs.length) {
        const rows = validQs.map((q, idx) => ({
          job_id: id,
          prompt: q.prompt.trim(),
          type: q.type,
          options: q.options.filter(Boolean).length
            ? (q.options.filter(Boolean) as unknown as never)
            : null,
          required: q.required,
          knockout_answer: (q.knockout_answer ?? null) as never,
          sort_order: idx,
        }));
        const { error: insErr } = await supabase.from("screening_questions").insert(rows);
        if (insErr) throw insErr;
      }

      toast.success("Job updated");
      qc.invalidateQueries({ queryKey: ["employer-job", id] });
      qc.invalidateQueries({ queryKey: ["employer-jobs"] });
      qc.invalidateQueries({ queryKey: ["screening-questions", id] });
      navigate({ to: "/employer" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading)
    return <div className="p-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!job)
    return <div className="p-12 text-center text-sm text-muted-foreground">Job not found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps text-primary">Edit job</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          {job.title}
        </h1>
      </div>

      <form
        onSubmit={save}
        className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="title">Job title</Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Shift</Label>
            <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.employment_type}
              onValueChange={(v) => setForm({ ...form, employment_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Pay range</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                step="0.5"
                placeholder="Min"
                value={form.pay_min}
                onChange={(e) => setForm({ ...form, pay_min: e.target.value })}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                step="0.5"
                placeholder="Max"
                value={form.pay_max}
                onChange={(e) => setForm({ ...form, pay_max: e.target.value })}
              />
              <Select
                value={form.pay_period}
                onValueChange={(v) => setForm({ ...form, pay_period: v as "hour" | "year" })}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
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
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              required
              value={form.state}
              onChange={(e) =>
                setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">ZIP</Label>
            <Input
              id="zip"
              value={form.zip}
              onChange={(e) => setForm({ ...form, zip: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            rows={8}
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="requirements">Requirements</Label>
          <Textarea
            id="requirements"
            rows={5}
            value={form.requirements}
            onChange={(e) => setForm({ ...form, requirements: e.target.value })}
          />
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <div>
            <h2 className="text-base font-semibold text-[color:var(--ink)]">Screening questions</h2>
            <p className="text-xs text-muted-foreground">
              Ask qualifying questions. Use the knockout setting to auto-flag disqualifying answers.
            </p>
          </div>
          <ScreeningQuestionsBuilder value={questions} onChange={setQuestions} />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/employer" })}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
