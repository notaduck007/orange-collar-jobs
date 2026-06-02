import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Check, ChevronLeft, ChevronRight, FileText, Sparkles, Loader2, Package as PackageIcon } from "lucide-react";
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
import { uniqueSlug } from "@/lib/slug";
import { JOB_TEMPLATES, TEMPLATE_LIST } from "@/lib/job-templates";
import { ScreeningQuestionsBuilder, type ScreeningQuestionDraft } from "@/components/screening-questions-builder";
import { useSiteSettings } from "@/lib/site-settings";
import { checkRateLimit, emailIsVerified, LIMITS } from "@/lib/abuse";
import { JobCard } from "@/components/job-card";
import { startCheckout } from "@/lib/checkout";

type CheckoutSearch = { checkout?: "success" | "cancelled"; draft?: string; session_id?: string };

export const Route = createFileRoute("/employer/jobs/new")({
  head: () => ({ meta: [{ title: "Post a Job — WarehouseJobs Employers" }] }),
  validateSearch: (s: Record<string, unknown>): CheckoutSearch => ({
    checkout: s.checkout === "success" || s.checkout === "cancelled" ? s.checkout : undefined,
    draft: typeof s.draft === "string" ? s.draft : undefined,
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
  }),
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

const STEPS = ["Basics", "Schedule & pay", "Location", "Description", "Screening", "Review & publish"] as const;

type ActivePackage = {
  id: string;
  package_id: string | null;
  package_name: string | null;
  posts_total: number;
  posts_used: number;
  posts_remaining: number;
  featured_total: number;
  featured_used: number;
  featured_remaining: number;
  expires_at: string;
};

type FormState = {
  title: string;
  category: string;
  category_slug: string;
  shift: string;
  employment_type: string;
  description: string;
  requirements: string;
  city: string;
  state: string;
  zip: string;
  pay_min: string;
  pay_max: string;
  pay_period: "hour" | "year";
  feature_it: boolean;
  temperature_env: "" | "ambient" | "cooler" | "freezer";
  certifications_required: string[];
  lift_requirement_lbs: string;
  overtime_available: boolean;
  weekly_pay: boolean;
  quick_hire: boolean;
};

const EMPTY_FORM: FormState = {
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
  pay_period: "hour",
  feature_it: false,
  temperature_env: "",
  certifications_required: [],
  lift_requirement_lbs: "",
  overtime_available: false,
  weekly_pay: false,
  quick_hire: false,
};

function NewJobPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = useSearch({ from: "/employer/jobs/new" });

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

  const { data: activePackage, refetch: refetchPackage } = useQuery<ActivePackage | null>({
    queryKey: ["active-package", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_package", { p_company_id: company!.id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as ActivePackage | undefined) ?? null;
    },
  });

  // Most-recently purchased package id for "Renew" suggestion.
  const { data: lastPackageId } = useQuery({
    queryKey: ["last-purchased-package", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("company_packages")
        .select("package_id, purchased_at")
        .eq("company_id", company!.id)
        .order("purchased_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.package_id ?? null;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["job-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("job_categories").select("*").eq("active", true).order("sort_order").order("name");
      return data ?? [];
    },
  });

  const { settings } = useSiteSettings();

  const [step, setStep] = useState(0);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<ScreeningQuestionDraft[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slots, setSlots] = useState<Array<{ starts_at: string; capacity: number }>>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [success, setSuccess] = useState<{ slug: string; title: string } | null>(null);
  const resumeHandledRef = useRef(false);
  const [resumeOffer, setResumeOffer] = useState<null | {
    form: FormState;
    questions: ScreeningQuestionDraft[];
    slots: Array<{ starts_at: string; capacity: number }>;
    step: number;
    savedAt: number;
  }>(null);
  const lsKey = user ? `wj:job-draft:${user.id}` : null;
  const autosaveReadyRef = useRef(false);
  const lsCheckedRef = useRef(false);

  // On mount: if a local draft exists and we're not resuming a server draft, offer it.
  useEffect(() => {
    if (lsCheckedRef.current) return;
    if (!lsKey) return;
    if (search.draft) { lsCheckedRef.current = true; autosaveReadyRef.current = true; return; }
    lsCheckedRef.current = true;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.form) setResumeOffer(parsed);
      }
    } catch { /* ignore */ }
    // Allow autosave to begin after we've checked (avoid clobbering before offer is shown).
    autosaveReadyRef.current = true;
  }, [lsKey, search.draft]);

  // Debounced autosave of wizard state to localStorage.
  useEffect(() => {
    if (!lsKey || !autosaveReadyRef.current || resumeOffer) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          lsKey,
          JSON.stringify({ form, questions, slots, step, savedAt: Date.now() }),
        );
      } catch { /* ignore quota */ }
    }, 600);
    return () => clearTimeout(t);
  }, [lsKey, form, questions, slots, step, resumeOffer]);

  const clearLocalDraft = () => {
    if (lsKey) {
      try { localStorage.removeItem(lsKey); } catch { /* ignore */ }
    }
  };

  const acceptResume = () => {
    if (!resumeOffer) return;
    setForm(resumeOffer.form);
    setQuestions(resumeOffer.questions ?? []);
    setSlots(resumeOffer.slots ?? []);
    setStep(resumeOffer.step ?? 0);
    setResumeOffer(null);
    toast.success("Draft restored");
  };
  const discardResume = () => {
    clearLocalDraft();
    setResumeOffer(null);
  };

  const addSlot = () => setSlots((s) => [...s, { starts_at: "", capacity: 1 }]);
  const updateSlot = (i: number, patch: Partial<{ starts_at: string; capacity: number }>) =>
    setSlots((s) => s.map((slot, idx) => (idx === i ? { ...slot, ...patch } : slot)));
  const removeSlot = (i: number) => setSlots((s) => s.filter((_, idx) => idx !== i));

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

  // Load draft from URL (post-checkout return) to repopulate the form.
  useEffect(() => {
    if (!search.draft || !company?.id || draftId) return;
    (async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", search.draft!)
        .eq("company_id", company.id)
        .maybeSingle();
      if (!data) return;
      setDraftId(data.id);
      setForm({
        title: data.title ?? "",
        category: data.category ?? "",
        category_slug: data.category ?? "",
        shift: data.shift ?? "first",
        employment_type: data.employment_type ?? "full_time",
        description: data.description ?? "",
        requirements: data.requirements ?? "",
        city: data.city ?? "",
        state: data.state ?? "",
        zip: data.zip ?? "",
        pay_min: data.pay_min?.toString() ?? "",
        pay_max: data.pay_max?.toString() ?? "",
        pay_period: (data.pay_period as "hour" | "year") ?? "hour",
        feature_it: false,
        temperature_env: (data.temperature_env as FormState["temperature_env"]) ?? "",
        certifications_required: data.certifications_required ?? [],
        lift_requirement_lbs: data.lift_requirement_lbs?.toString() ?? "",
        overtime_available: !!data.overtime_available,
        weekly_pay: !!data.weekly_pay,
        quick_hire: !!data.quick_hire,
      });
      // Snap to Review step so user can publish immediately.
      setStep(STEPS.length - 1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.draft, company?.id]);

  // Match category_slug from category text after categories load (drafts only store category name).
  useEffect(() => {
    if (!form.category || form.category_slug || !categories.length) return;
    const match = categories.find((c) => c.name === form.category || c.slug === form.category);
    if (match) setForm((f) => ({ ...f, category: match.name, category_slug: match.slug }));
  }, [form.category, form.category_slug, categories]);

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
    if (i >= stepSchemas.length) return true; // Review / Screening have no schema
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

  // Build payload for jobs table from current form.
  const buildJobPayload = (status: "draft" | "active") => {
    const locationStr = `${form.city}, ${form.state.toUpperCase()}${form.zip ? ` ${form.zip}` : ""}`;
    return {
      company_id: company!.id,
      posted_by: user!.id,
      title: form.title,
      category: form.category,
      shift: form.shift as never,
      employment_type: form.employment_type as never,
      pay_min: form.pay_min ? Number(form.pay_min) : null,
      pay_max: form.pay_max ? Number(form.pay_max) : null,
      pay_period: form.pay_period,
      location: locationStr,
      city: form.city,
      state: form.state.toUpperCase(),
      zip: form.zip || null,
      description: form.description,
      requirements: form.requirements || null,
      temperature_env: form.temperature_env || null,
      certifications_required: form.certifications_required,
      lift_requirement_lbs: form.lift_requirement_lbs ? Number(form.lift_requirement_lbs) : null,
      overtime_available: form.overtime_available,
      weekly_pay: form.weekly_pay,
      quick_hire: form.quick_hire,
      status: status as never,
    };
  };

  // Upsert the current form as a draft, returns the draft id.
  const saveDraft = async (): Promise<string | null> => {
    if (!user || !company) return null;
    if (draftId) {
      const { error } = await supabase.from("jobs").update(buildJobPayload("draft")).eq("id", draftId);
      if (error) {
        toast.error(`Couldn't save draft: ${error.message}`);
        return null;
      }
      return draftId;
    }
    const slug = uniqueSlug(form.title || "draft");
    const { data, error } = await supabase
      .from("jobs")
      .insert({ ...buildJobPayload("draft"), slug })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(`Couldn't save draft: ${error?.message ?? "unknown"}`);
      return null;
    }
    setDraftId(data.id);
    return data.id;
  };

  // Persist screening questions + interview slots to a job id (called after publish).
  const persistChildren = async (jobId: string) => {
    const validQs = questions.filter((q) => q.prompt.trim().length > 0);
    if (validQs.length) {
      const rows = validQs.map((q, idx) => ({
        job_id: jobId,
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
    if (form.quick_hire && slots.length) {
      const slotRows = slots
        .filter((s) => s.starts_at && s.capacity > 0)
        .map((s) => ({
          job_id: jobId,
          starts_at: new Date(s.starts_at).toISOString(),
          capacity: s.capacity,
        }));
      if (slotRows.length) {
        const { error: sErr } = await supabase.from("interview_slots").insert(slotRows);
        if (sErr) toast.error(`Job posted, but interview slots failed: ${sErr.message}`);
      }
    }
  };

  const publishWithPackage = async (jobId: string) => {
    const wantsFeatured = form.feature_it && (activePackage?.featured_remaining ?? 0) >= 1;
    const { error } = await supabase.rpc("consume_post_and_publish", {
      _job_id: jobId,
      _company_id: company!.id,
      _want_featured: wantsFeatured,
    });
    if (error) throw error;
    await persistChildren(jobId);
    qc.invalidateQueries({ queryKey: ["active-package", company!.id] });
    qc.invalidateQueries({ queryKey: ["employer-jobs", company!.id] });
    const { data: row } = await supabase.from("jobs").select("slug, title").eq("id", jobId).maybeSingle();
    setSuccess({ slug: row?.slug ?? "", title: row?.title ?? form.title });
  };

  const submit = async () => {
    if (!user || !company) return;
    if (!emailIsVerified(user, settings.toggles.require_email_verification)) {
      toast.error("Please verify your email before posting a job. Check your inbox for the confirmation link.");
      return;
    }
    for (let i = 0; i < stepSchemas.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }

    // Duplicate-job warning: same company + title + location within 14 days.
    const locationStr = `${form.city}, ${form.state.toUpperCase()}`;
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const { data: dupes } = await supabase
      .from("jobs")
      .select("id, title, location, created_at, status")
      .eq("company_id", company.id)
      .ilike("title", form.title.trim())
      .ilike("location", `${locationStr}%`)
      .in("status", ["active", "published", "paused"])
      .gte("created_at", since)
      .limit(1);
    if (dupes && dupes.length > 0) {
      const ok = window.confirm(
        `You posted a very similar job ("${dupes[0].title}" in ${dupes[0].location}) in the last 14 days. Post another copy anyway?`,
      );
      if (!ok) return;
    }

    // Per-company rate limit.
    const allowed = await checkRateLimit(
      `jobpost:${company.id}`,
      LIMITS.jobPostPerDay.windowSeconds,
      LIMITS.jobPostPerDay.max,
    );
    if (!allowed) {
      toast.error("This company has reached its daily posting limit. Try again tomorrow.");
      return;
    }

    setSubmitting(true);
    try {
      // Always save/refresh the draft first so nothing is lost.
      const id = await saveDraft();
      if (!id) return;

      const canPost =
        !!activePackage &&
        activePackage.posts_remaining >= 1 &&
        (!form.feature_it || activePackage.featured_remaining >= 1);

      if (canPost) {
        await publishWithPackage(id);
      } else {
        setDrawerOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post job");
    } finally {
      setSubmitting(false);
    }
  };

  // Resume flow after Stripe redirect.
  useEffect(() => {
    if (resumeHandledRef.current) return;
    if (!company?.id || !search.checkout) return;

    if (search.checkout === "cancelled") {
      resumeHandledRef.current = true;
      toast.info("Payment cancelled — your draft is saved.");
      setStep(STEPS.length - 1);
      // Strip query.
      navigate({ to: "/employer/jobs/new", search: {}, replace: true });
      return;
    }

    if (search.checkout === "success" && search.draft) {
      resumeHandledRef.current = true;
      setResuming(true);
      (async () => {
        // Poll get_active_package up to ~10s
        let pkg: ActivePackage | null = null;
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.rpc("get_active_package", { p_company_id: company.id });
          const row = (Array.isArray(data) ? data[0] : data) as ActivePackage | undefined;
          if (row && row.posts_remaining >= 1) {
            pkg = row;
            break;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        qc.invalidateQueries({ queryKey: ["active-package", company.id] });
        await refetchPackage();

        if (!pkg) {
          toast.error("Payment received but your package isn't ready yet. Try Publish again in a moment.");
          setResuming(false);
          setStep(STEPS.length - 1);
          navigate({ to: "/employer/jobs/new", search: { draft: search.draft }, replace: true });
          return;
        }

        try {
          // Use server's view of the job + featured intent (post-redirect we lost in-memory feature toggle if user reloaded)
          const wantsFeatured = form.feature_it && pkg.featured_remaining >= 1;
          const { error } = await supabase.rpc("consume_post_and_publish", {
            _job_id: search.draft!,
            _company_id: company.id,
            _want_featured: wantsFeatured,
          });
          if (error) throw error;
          await persistChildren(search.draft!);
          qc.invalidateQueries({ queryKey: ["active-package", company.id] });
          qc.invalidateQueries({ queryKey: ["employer-jobs", company.id] });
          const { data: row } = await supabase.from("jobs").select("slug, title").eq("id", search.draft!).maybeSingle();
          setSuccess({ slug: row?.slug ?? "", title: row?.title ?? form.title });
          navigate({ to: "/employer/jobs/new", search: {}, replace: true });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Couldn't auto-publish your draft");
        } finally {
          setResuming(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id, search.checkout, search.draft]);

  // Success screen.
  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[color:var(--ink)]">Your job is live</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-emerald-900/80">
            "{success.title}" is now visible to job seekers.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {success.slug && (
              <Button asChild className="btn-primary">
                <Link to="/jobs/$slug" params={{ slug: success.slug }}>View listing</Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/employer">Back to dashboard</Link>
            </Button>
          </div>
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
          {activePackage ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {activePackage.posts_remaining} of {activePackage.posts_total} posts left on{" "}
              <span className="font-semibold text-[color:var(--ink)]">{activePackage.package_name}</span>
              {" "}· valid until {formatDate(activePackage.expires_at)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              No active package — you'll pick one when you publish.
            </p>
          )}
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

      {resuming && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-[color:var(--primary-tint)] p-3 text-sm text-[color:var(--ink)]">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Payment received — finishing publishing your draft…
        </div>
      )}

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

            <div className="rounded-lg border border-border bg-background p-4 space-y-4 sm:col-span-2">
              <div>
                <p className="text-sm font-semibold text-[color:var(--ink)]">Warehouse details</p>
                <p className="text-xs text-muted-foreground">These power the niche filters seekers use to qualify themselves.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="temp">Temperature environment</Label>
                  <Select
                    value={form.temperature_env || "unset"}
                    onValueChange={(v) => setForm({ ...form, temperature_env: v === "unset" ? "" : (v as "ambient" | "cooler" | "freezer") })}
                  >
                    <SelectTrigger id="temp"><SelectValue placeholder="Not specified" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">Not specified</SelectItem>
                      <SelectItem value="ambient">Ambient</SelectItem>
                      <SelectItem value="cooler">Cooler (35–55°F)</SelectItem>
                      <SelectItem value="freezer">Freezer (≤0°F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lift">Lift requirement (lbs)</Label>
                  <Input
                    id="lift"
                    type="number"
                    min={0}
                    max={500}
                    placeholder="e.g. 50"
                    value={form.lift_requirement_lbs}
                    onChange={(e) => setForm({ ...form, lift_requirement_lbs: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Equipment certifications required</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: "forklift", l: "Forklift" },
                    { v: "reach", l: "Reach truck" },
                    { v: "cherry_picker", l: "Cherry picker" },
                    { v: "pallet_jack", l: "Electric pallet jack" },
                  ].map((c) => {
                    const checked = form.certifications_required.includes(c.v);
                    return (
                      <label key={c.v} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const set = new Set(form.certifications_required);
                            if (v) set.add(c.v); else set.delete(c.v);
                            setForm({ ...form, certifications_required: Array.from(set) });
                          }}
                        />
                        {c.l}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
                  <Checkbox checked={form.weekly_pay} onCheckedChange={(v) => setForm({ ...form, weekly_pay: !!v })} />
                  Weekly pay
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
                  <Checkbox checked={form.overtime_available} onCheckedChange={(v) => setForm({ ...form, overtime_available: !!v })} />
                  OT available
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
                  <Checkbox checked={form.quick_hire} onCheckedChange={(v) => setForm({ ...form, quick_hire: !!v })} />
                  Same-day / quick hire
                </label>
              </div>

              {form.quick_hire && (
                <div className="space-y-2 rounded-md border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--ink)]">
                        Phone-screen interview slots
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Applicants will pick a time when they apply. Add a few openings.
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addSlot}>
                      Add slot
                    </Button>
                  </div>
                  {slots.length === 0 && (
                    <p className="text-xs text-muted-foreground">No slots yet.</p>
                  )}
                  {slots.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[200px] flex-1 space-y-1">
                        <Label className="text-xs">Date &amp; time</Label>
                        <Input
                          type="datetime-local"
                          value={s.starts_at}
                          onChange={(e) => updateSlot(i, { starts_at: e.target.value })}
                        />
                      </div>
                      <div className="w-24 space-y-1">
                        <Label className="text-xs">Capacity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={s.capacity}
                          onChange={(e) => updateSlot(i, { capacity: Math.max(1, Number(e.target.value) || 1) })}
                        />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeSlot(i)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
              />
              <div className="text-sm">
                <p className="font-semibold text-[color:var(--ink)]">Feature this job</p>
                <p className="text-xs text-muted-foreground">
                  Highlight with the hazard-yellow badge and pin to the top of search. Uses 1 featured
                  upgrade from your active package.
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

        {step === 5 && (
          <ReviewStep form={form} company={company} activePackage={activePackage ?? null} />
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
            <Button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Publishing…" : "Publish job"}
            </Button>
          )}
        </div>
      </form>

      <RenewUpgradeDialog
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        activePackage={activePackage ?? null}
        lastPackageId={lastPackageId ?? null}
        draftId={draftId}
      />
    </div>
  );
}

function ReviewStep({
  form,
  company,
  activePackage,
}: {
  form: FormState;
  company: { id: string; name: string; slug: string; verified?: boolean | null } | null | undefined;
  activePackage: ActivePackage | null;
}) {
  const previewJob = {
    id: "preview",
    slug: "preview",
    title: form.title || "Untitled role",
    location: `${form.city}, ${form.state.toUpperCase()}${form.zip ? ` ${form.zip}` : ""}`,
    shift: form.shift,
    employment_type: form.employment_type,
    pay_min: form.pay_min ? Number(form.pay_min) : null,
    pay_max: form.pay_max ? Number(form.pay_max) : null,
    featured: form.feature_it,
    category: form.category,
    companies: company ? { name: company.name, slug: company.slug, verified: company.verified } : null,
    temperature_env: form.temperature_env || null,
    certifications_required: form.certifications_required,
    weekly_pay: form.weekly_pay,
    quick_hire: form.quick_hire,
    overtime_available: form.overtime_available,
    lift_requirement_lbs: form.lift_requirement_lbs ? Number(form.lift_requirement_lbs) : null,
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[color:var(--ink)]">Review & publish</h2>
        <p className="text-xs text-muted-foreground">This is exactly how your listing will appear to job seekers.</p>
      </div>

      <div className="pointer-events-none">
        <JobCard job={previewJob} />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">Full description preview</h3>
        <div className="whitespace-pre-wrap text-sm text-muted-foreground">{form.description}</div>
        {form.requirements && (
          <>
            <h4 className="pt-2 text-sm font-semibold text-[color:var(--ink)]">Requirements</h4>
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">{form.requirements}</div>
          </>
        )}
      </div>

      <div className="rounded-lg border-2 border-dashed border-border bg-background p-4">
        <div className="flex items-start gap-3">
          <PackageIcon className="mt-0.5 h-5 w-5 text-primary" />
          <div className="text-sm">
            {activePackage ? (
              <>
                <p className="text-[color:var(--ink)]">
                  Publishing uses <span className="font-semibold">1 of {activePackage.posts_remaining} remaining posts</span>{" "}
                  on your <span className="font-semibold">{activePackage.package_name}</span> (valid until{" "}
                  {formatDate(activePackage.expires_at)})
                </p>
                {form.feature_it && (
                  <p className="mt-1 text-[color:var(--ink)]">
                    + 1 featured upgrade ({activePackage.featured_remaining} remaining)
                  </p>
                )}
                {form.feature_it && activePackage.featured_remaining < 1 && (
                  <p className="mt-1 text-amber-700">
                    You don't have featured upgrades left — we'll publish as a standard job.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[color:var(--ink)]">
                You don't have an active package — choose one to publish.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenewUpgradeDialog({
  open,
  onOpenChange,
  activePackage,
  lastPackageId,
  draftId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  activePackage: ActivePackage | null;
  lastPackageId: string | null;
  draftId: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["posting-packages-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("packages")
        .select("*")
        .eq("kind", "posting")
        .eq("active", true)
        .order("sort_order")
        .order("price_cents");
      return data ?? [];
    },
  });

  const renewPkg = packages.find((p) => p.id === lastPackageId) ?? null;
  const upgrades = packages.filter(
    (p) => p.id !== lastPackageId && (renewPkg ? p.posting_count > renewPkg.posting_count : true),
  );
  const popular = upgrades[Math.floor(upgrades.length / 2)] ?? null;

  const reason = !activePackage
    ? "You don't have an active package — pick one to publish your draft."
    : activePackage.posts_remaining < 1
    ? `Your ${activePackage.package_name} is used up — renew it or move up to publish.`
    : `Your ${activePackage.package_name} expired on ${formatDate(activePackage.expires_at)} — renew it or move up to publish.`;

  const handleBuy = async (pkgId: string, intent: "renew" | "upgrade") => {
    setBusy(pkgId);
    const res = await startCheckout(pkgId, intent, draftId);
    if (res?.error) {
      toast.error(res.error);
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Renew or upgrade to publish</DialogTitle>
          <DialogDescription>{reason}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!draftId && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Saving your draft… try again in a second if checkout doesn't open.
            </p>
          )}

          {renewPkg && (
            <div className="rounded-lg border-2 border-primary bg-[color:var(--primary-tint)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="label-caps text-primary">Renew</p>
                  <h3 className="mt-1 text-lg font-bold text-[color:var(--ink)]">{renewPkg.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {renewPkg.posting_count} {renewPkg.posting_count === 1 ? "post" : "posts"}
                    {renewPkg.featured_count > 0 ? ` + ${renewPkg.featured_count} featured` : ""}{" "}
                    · {renewPkg.duration_days}-day validity
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-[color:var(--ink)]">${(renewPkg.price_cents / 100).toFixed(0)}</p>
                  <Button
                    className="btn-primary mt-2"
                    disabled={!draftId || busy === renewPkg.id}
                    onClick={() => handleBuy(renewPkg.id, "renew")}
                  >
                    {busy === renewPkg.id ? "Opening…" : "Renew & publish"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {upgrades.length > 0 && (
            <div>
              <p className="label-caps mb-2">{renewPkg ? "Or upgrade" : "Pick a package"}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {upgrades.map((p) => {
                  const isPopular = popular?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-4 ${
                        isPopular ? "border-primary bg-card shadow-[var(--shadow-card)]" : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <h4 className="text-base font-bold text-[color:var(--ink)]">{p.name}</h4>
                        {isPopular && (
                          <span className="rounded bg-[color:var(--hazard)] px-2 py-0.5 text-[10px] font-bold uppercase text-[color:var(--ink)]">
                            Most popular
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.posting_count} {p.posting_count === 1 ? "post" : "posts"}
                        {p.featured_count > 0 ? ` + ${p.featured_count} featured` : ""} · {p.duration_days}-day
                      </p>
                      <p className="mt-3 text-2xl font-bold text-[color:var(--ink)]">${(p.price_cents / 100).toFixed(0)}</p>
                      <Button
                        size="sm"
                        variant={isPopular ? "default" : "outline"}
                        className={`mt-3 w-full ${isPopular ? "btn-primary" : ""}`}
                        disabled={!draftId || busy === p.id}
                        onClick={() => handleBuy(p.id, "upgrade")}
                      >
                        {busy === p.id ? "Opening…" : "Buy & publish"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
