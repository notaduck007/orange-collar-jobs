import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Check, ChevronLeft, ChevronRight, FileText, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { uniqueSlug } from "@/lib/slug";
import { JOB_TEMPLATES, TEMPLATE_LIST } from "@/lib/job-templates";
import { ScreeningQuestionsBuilder, type ScreeningQuestionDraft } from "@/components/screening-questions-builder";
import { useSiteSettings } from "@/lib/site-settings";
import { checkRateLimit, emailIsVerified, LIMITS } from "@/lib/abuse";

export const Route = createFileRoute("/employer/jobs/new")({
  head: () => ({ meta: [{ title: "Post a Job — WarehouseJobs Employers" }] }),
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

const stepSchemas = [
  z.object({
    title: z.string().trim().min(3, "Job title must be at least 3 characters").max(120),
    category: z.string().min(1, "Pick a category"),
    category_slug: z.string().min(1),
  }),
  z.object({
    employment_type: z.string().min(1),
    shift: z.string().min(1),
    pay_min: z.string().optional(),
    pay_max: z.string().optional(),
    pay_period: z.enum(["hour", "year"]),
  }),
  z.object({
    city: z.string().trim().min(1, "City is required").max(80),
    state: z.string().trim().length(2, "Use 2-letter state code"),
    zip: z.string().trim().max(10).optional(),
  }),
  z.object({
    description: z.string().trim().min(30, "Add at least 30 characters of description").max(5000),
    requirements: z.string().trim().max(3000).optional(),
  }),
];

const STEPS = ["Basics", "Schedule & pay", "Location", "Description", "Screening"] as const;

function NewJobPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ["employer-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: owned } = await supabase
        .from("companies").select("*").eq("owner_id", user!.id).maybeSingle();
      if (owned) return owned;
      const { data: mem } = await supabase
        .from("company_members").select("company_id").eq("user_id", user!.id).eq("status", "active").limit(1).maybeSingle();
      if (!mem?.company_id) return null;
      const { data } = await supabase.from("companies").select("*").eq("id", mem.company_id).maybeSingle();
      return data;
    },
  });

  const { data: credits = [] } = useQuery({
    queryKey: ["company-credits", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase.from("company_credits").select("*").eq("company_id", company!.id);
      return data ?? [];
    },
  });
  const postingCredits = credits.find((c) => c.credit_type === "post")?.balance ?? 0;
  const featuredCredits = credits.find((c) => c.credit_type === "featured")?.balance ?? 0;
  const canPost = postingCredits > 0;

  const { data: categories = [] } = useQuery({
    queryKey: ["job-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("job_categories").select("*").eq("active", true).order("sort_order").order("name");
      return data ?? [];
    },
  });

  // Site-wide default job duration (configurable in /admin/settings)
  const { settings } = useSiteSettings();
  const defaultDuration = settings.defaults.job_duration_days || 30;

  // Look up the most recent completed order's package duration to set expires_at.
  const { data: lastOrderDuration } = useQuery({
    queryKey: ["last-package-duration", company?.id, defaultDuration],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data: order } = await supabase
        .from("orders")
        .select("package_id, status, created_at")
        .eq("company_id", company!.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!order?.package_id) return defaultDuration;
      const { data: pkg } = await supabase
        .from("packages")
        .select("duration_days")
        .eq("id", order.package_id)
        .maybeSingle();
      return pkg?.duration_days ?? defaultDuration;
    },
  });
  const durationDays = lastOrderDuration ?? defaultDuration;


  const [step, setStep] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<ScreeningQuestionDraft[]>([]);
  const [form, setForm] = useState({
    title: "",
    category: "",
    category_slug: "",
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
    feature_it: false,
  });

  // Prefill city/state from company on first render (after company loads).
  useMemo(() => {
    if (company && !form.city && !form.state) {
      setForm((f) => ({
        ...f,
        city: company.hq_city ?? "",
        state: company.hq_state ?? "",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);


  const applyTemplate = (slug: string) => {
    const tpl = JOB_TEMPLATES[slug];
    if (!tpl) return;
    const matchedCat = categories.find((c) => c.slug === slug);
    setForm((f) => ({
      ...f,
      title: f.title || tpl.title,
      category: matchedCat?.name ?? f.category,
      category_slug: matchedCat?.slug ?? slug,
      description: tpl.description,
      requirements: tpl.requirements,
    }));
    setTemplateOpen(false);
    toast.success(`Loaded "${tpl.title}" template`);
  };

  const validateStep = (i: number) => {
    const result = stepSchemas[i].safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return false;
    }
    return true;
  };

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    if (!user || !company) return;
    if (!canPost) {
      toast.error("Out of posting credits.");
      navigate({ to: "/pricing" });
      return;
    }
    for (let i = 0; i < stepSchemas.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    const wantsFeatured = form.feature_it;
    if (wantsFeatured && featuredCredits < 1) {
      toast.error("Out of featured credits. Uncheck the featured option or buy a package.");
      return;
    }

    setSubmitting(true);
    try {
      // Atomically consume the posting credit first; if it fails, do not insert the job.
      const { data: postOk, error: postCreditErr } = await supabase.rpc("consume_credit", {
        _company_id: company.id,
        _credit_type: "post",
      });
      if (postCreditErr) throw postCreditErr;
      if (!postOk) {
        toast.error("Out of posting credits.");
        navigate({ to: "/pricing" });
        return;
      }

      let featuredConsumed = false;
      if (wantsFeatured) {
        const { data: featOk, error: featErr } = await supabase.rpc("consume_credit", {
          _company_id: company.id,
          _credit_type: "featured",
        });
        if (featErr) throw featErr;
        if (!featOk) {
          toast.error("Out of featured credits — posting as a standard job.");
        } else {
          featuredConsumed = true;
        }
      }

      const slug = uniqueSlug(form.title);
      const expiresAt = new Date(Date.now() + durationDays * 86400_000).toISOString();
      const featuredUntil = featuredConsumed ? expiresAt : null;
      const { data: created, error } = await supabase.from("jobs").insert({
        company_id: company.id,
        posted_by: user.id,
        title: form.title,
        slug,
        category: form.category,
        shift: form.shift as never,
        employment_type: form.employment_type as never,
        pay_min: form.pay_min ? Number(form.pay_min) : null,
        pay_max: form.pay_max ? Number(form.pay_max) : null,
        pay_period: form.pay_period,
        location: `${form.city}, ${form.state.toUpperCase()}${form.zip ? ` ${form.zip}` : ""}`,
        city: form.city,
        state: form.state.toUpperCase(),
        zip: form.zip || null,
        description: form.description,
        requirements: form.requirements || null,
        status: "active" as never,
        featured: featuredConsumed,
        featured_until: featuredUntil,
        posted_at: new Date().toISOString(),
        expires_at: expiresAt,
      }).select("id").single();
      if (error) throw error;

      const validQs = questions.filter((q) => q.prompt.trim().length > 0);
      if (created && validQs.length) {
        const rows = validQs.map((q, idx) => ({
          job_id: created.id,
          prompt: q.prompt.trim(),
          type: q.type,
          options: q.options.filter(Boolean).length ? (q.options.filter(Boolean) as unknown as never) : null,
          required: q.required,
          knockout_answer: (q.knockout_answer ?? null) as never,
          sort_order: idx,
        }));
        const { error: qErr } = await supabase.from("screening_questions").insert(rows);
        if (qErr) toast.error(`Job posted, but screening questions failed: ${qErr.message}`);
      }

      toast.success("Job posted!");
      qc.invalidateQueries({ queryKey: ["company-credits", company.id] });
      qc.invalidateQueries({ queryKey: ["employer-jobs", company.id] });
      navigate({ to: "/employer" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post job");
    } finally {
      setSubmitting(false);
    }
  };


  // Hard block: no credits → redirect-style banner with CTA.
  if (company && !canPost) {
    return (
      <div className="space-y-6">
        <div>
          <p className="label-caps text-primary">New job</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
            Post a warehouse job
          </h1>
        </div>
        <div className="rounded-xl border-2 border-[color:var(--accent)] bg-[color:var(--primary-tint)] p-8 text-center">
          <h2 className="text-xl font-bold text-[color:var(--ink)]">You're out of posting credits</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Pick up a posting package to publish this role. Plans start small for one-off hires
            and scale up for high-volume seasons.
          </p>
          <Button asChild className="btn-primary mt-5">
            <Link to="/pricing">Buy a package</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps text-primary">New job</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
            Post a warehouse job
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {postingCredits} posting {postingCredits === 1 ? "credit" : "credits"} ·{" "}
            {featuredCredits} featured · expires in {durationDays} days
          </p>
        </div>
        <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" type="button">
              <FileText className="mr-2 h-4 w-4" /> Use a template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Pre-written warehouse templates</DialogTitle>
              <DialogDescription>
                Pick a role to pre-fill the title, description, and requirements. You can edit
                everything afterwards.
              </DialogDescription>
            </DialogHeader>
            <div className="grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {TEMPLATE_LIST.map((tpl) => (
                <button
                  key={tpl.slug}
                  type="button"
                  onClick={() => applyTemplate(tpl.slug)}
                  className="group rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary hover:bg-[color:var(--primary-tint)]"
                >
                  <p className="font-semibold text-[color:var(--ink)] group-hover:text-primary">
                    {tpl.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {tpl.description.split("\n")[0]}
                  </p>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : done
                    ? "border-primary bg-[color:var(--primary-tint)] text-primary"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={active ? "text-[color:var(--ink)]" : "text-muted-foreground"}>
                {label}
              </span>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </li>
          );
        })}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === STEPS.length - 1) submit();
          else next();
        }}
        className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8"
      >
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="title">Job title *</Label>
              <Input
                id="title"
                required
                placeholder="e.g. Forklift Operator — 2nd Shift"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Category *</Label>
              <Select
                value={form.category_slug}
                onValueChange={(v) => {
                  const cat = categories.find((c) => c.slug === v);
                  setForm({ ...form, category_slug: v, category: cat?.name ?? "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.category_slug && JOB_TEMPLATES[form.category_slug] && (
                <button
                  type="button"
                  onClick={() => applyTemplate(form.category_slug)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Sparkles className="h-3 w-3" /> Pre-fill description from the{" "}
                  {JOB_TEMPLATES[form.category_slug].title} template
                </button>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Employment type *</Label>
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
              <Label>Shift *</Label>
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
            <div className="sm:col-span-2 space-y-1.5">
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
                  onValueChange={(v) =>
                    setForm({ ...form, pay_period: v as "hour" | "year" })
                  }
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
              <p className="text-xs text-muted-foreground">
                Listings with a posted pay range get 2–3× more applicants.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 sm:grid-cols-[1fr_120px_140px]">
            <div className="space-y-1.5">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State *</Label>
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
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="description">Job description *</Label>
              <Textarea
                id="description"
                rows={10}
                required
                placeholder="Describe the role, day-to-day tasks, equipment, team, schedule…"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={5000}
              />
              <p className="text-xs text-muted-foreground">
                {form.description.length} / 5000
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea
                id="requirements"
                rows={6}
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
                  Highlight with the hazard-yellow badge and pin to the top of search. Uses 1
                  featured credit ({featuredCredits} available).
                  {featuredCredits < 1 && (
                    <>
                      {" "}
                      <Link to="/pricing" className="font-semibold text-primary hover:underline">
                        Buy more
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </label>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-[color:var(--ink)]">Screening questions (optional)</h2>
              <p className="text-xs text-muted-foreground">
                Ask qualifying questions to filter applicants. Use the knockout setting to auto-flag
                disqualifying answers on the applicants board.
              </p>
            </div>
            <ScreeningQuestionsBuilder value={questions} onChange={setQuestions} />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={step === 0 ? () => navigate({ to: "/employer" }) : back}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="submit" className="btn-primary">
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="submit"
                      disabled={submitting || !canPost}
                      className="btn-primary"
                    >
                      {submitting ? "Publishing…" : "Publish job (uses 1 credit)"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canPost && (
                  <TooltipContent>
                    Out of posting credits —{" "}
                    <Link to="/pricing" className="underline">
                      buy a package
                    </Link>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </form>
    </div>
  );
}
