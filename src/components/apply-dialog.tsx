import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSiteSettings } from "@/lib/site-settings";
import { checkRateLimit, emailIsVerified, LIMITS } from "@/lib/abuse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApplySuccessDialog } from "@/components/apply-success-dialog";

interface ApplyDialogProps {
  jobId: string;
  jobTitle: string;
  quickHire?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

type QuestionRow = {
  id: string;
  prompt: string;
  type: "yes_no" | "single" | "multi" | "number" | "text";
  options: string[] | null;
  required: boolean;
  sort_order: number;
};

export function ApplyDialog({
  jobId,
  jobTitle,
  quickHire,
  open,
  onOpenChange,
  onApplied,
}: ApplyDialogProps) {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [coverNote, setCoverNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [useDefault, setUseDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [slotId, setSlotId] = useState<string>("");

  const { data: profile } = useQuery({
    queryKey: ["seeker-profile-snapshot", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const [{ data: prof }, { data: seeker }] = await Promise.all([
        supabase
          .from("profiles")
          .select("default_resume_url, full_name, display_name, phone")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase
          .from("seeker_profiles")
          .select(
            "headline, skills, certifications, desired_shift, desired_employment_type, willing_to_relocate",
          )
          .eq("user_id", user!.id)
          .maybeSingle(),
      ]);
      return { ...(prof ?? {}), seeker: seeker ?? null } as {
        default_resume_url?: string | null;
        full_name?: string | null;
        display_name?: string | null;
        phone?: string | null;
        seeker: {
          headline?: string | null;
          skills?: string[] | null;
          certifications?: string[] | null;
          desired_shift?: string | null;
          desired_employment_type?: string | null;
          willing_to_relocate?: boolean | null;
        } | null;
      };
    },
  });


  const { data: questions = [] } = useQuery({
    queryKey: ["screening-questions", jobId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screening_questions")
        .select("id, prompt, type, options, required, sort_order")
        .eq("job_id", jobId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as QuestionRow[];
    },
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["interview-slots", jobId],
    enabled: open && !!quickHire,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interview_slots")
        .select("id, starts_at, capacity, booked_count")
        .eq("job_id", jobId)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return (data ?? []).filter((s) => (s.booked_count ?? 0) < s.capacity);
    },
  });

  useEffect(() => {
    if (!open) {
      setCoverNote("");
      setFile(null);
      setUseDefault(true);
      setAnswers({});
      setSlotId("");
    }
  }, [open]);

  const validateAnswers = (): string | null => {
    for (const q of questions) {
      if (!q.required) continue;
      const a = answers[q.id];
      if (a === undefined || a === null || a === "") return `Please answer: "${q.prompt}"`;
      if (q.type === "multi" && Array.isArray(a) && a.length === 0)
        return `Please answer: "${q.prompt}"`;
    }
    return null;
  };

  const submit = async () => {
    if (!user) return;
    if (!emailIsVerified(user, settings.toggles.require_email_verification)) {
      toast.error(
        "Please verify your email before applying. Check your inbox for the confirmation link.",
      );
      return;
    }
    const qErr = validateAnswers();
    if (qErr) {
      toast.error(qErr);
      return;
    }
    if (quickHire && slots.length > 0 && !slotId) {
      toast.error("Pick an interview slot to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const allowed = await checkRateLimit(
        `apply:${user.id}`,
        LIMITS.applyPerHour.windowSeconds,
        LIMITS.applyPerHour.max,
      );
      if (!allowed) {
        toast.error("You've hit the application limit for this hour. Try again later.");
        setSubmitting(false);
        return;
      }
      let resumePath: string | null = null;

      if (useDefault && profile?.default_resume_url) {
        resumePath = profile.default_resume_url;
      } else if (file) {
        const ext = file.name.split(".").pop() ?? "pdf";
        const path = `${user.id}/applications/${jobId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("resumes")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        resumePath = path;
      }

      const seeker = profile?.seeker ?? null;
      const { data: created, error } = await supabase
        .from("applications")
        .insert({
          job_id: jobId,
          applicant_id: user.id,
          cover_letter: coverNote || null,
          resume_url: resumePath,
          applicant_email: user.email ?? null,
          applicant_name: profile?.full_name || profile?.display_name || null,
          applicant_phone: profile?.phone ?? null,
          applicant_headline: seeker?.headline ?? null,
          applicant_skills: seeker?.skills ?? null,
          applicant_certifications: seeker?.certifications ?? null,
          applicant_desired_shift: seeker?.desired_shift ?? null,
          applicant_desired_employment_type: seeker?.desired_employment_type ?? null,
          applicant_willing_to_relocate: seeker?.willing_to_relocate ?? null,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          toast.error("You've already applied to this job.");
        } else {
          throw error;
        }
      } else {
        if (created && questions.length) {
          const rows = questions
            .filter((q) => answers[q.id] !== undefined)
            .map((q) => ({
              application_id: created.id,
              question_id: q.id,
              answer: answers[q.id] as never,
            }));
          if (rows.length) {
            const { error: aErr } = await supabase.from("application_answers").insert(rows);
            if (aErr) toast.error(`Application sent, but answers failed: ${aErr.message}`);
          }
        }
        if (created && quickHire && slotId) {
          const { error: bErr } = await supabase.from("interview_bookings").insert({
            slot_id: slotId,
            application_id: created.id,
            applicant_id: user.id,
          });
          if (bErr) {
            toast.error(`Application sent, but interview booking failed: ${bErr.message}`);
          } else {
            toast.success("Application sent and interview booked! Check your notifications.");
            qc.invalidateQueries({ queryKey: ["interview-slots", jobId] });
            qc.invalidateQueries({ queryKey: ["seeker-apps", user.id] });
            qc.invalidateQueries({ queryKey: ["seeker-applied-ids", user.id] });
            qc.invalidateQueries({ queryKey: ["seeker-stats", user.id] });
            onApplied?.();
            onOpenChange(false);
            return;
          }
        }
        toast.success("Application sent! The employer will be in touch.");
        qc.invalidateQueries({ queryKey: ["seeker-apps", user.id] });
        qc.invalidateQueries({ queryKey: ["seeker-applied-ids", user.id] });
        qc.invalidateQueries({ queryKey: ["seeker-stats", user.id] });
        onApplied?.();
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const hasDefault = !!profile?.default_resume_url;
  const defaultName = profile?.default_resume_url?.split("/").pop() ?? "";

  const setAnswer = (id: string, v: unknown) => setAnswers((p) => ({ ...p, [id]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply to {jobTitle}</DialogTitle>
          <DialogDescription>
            Send your resume and an optional note. The employer will see your full name and any
            cover note you add.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Resume (optional)</Label>
            {hasDefault && (
              <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
                <input
                  type="radio"
                  className="mt-1 accent-[color:var(--primary)]"
                  checked={useDefault}
                  onChange={() => setUseDefault(true)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      Use my default resume
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{defaultName}</p>
                </div>
              </label>
            )}
            <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
              {hasDefault && (
                <input
                  type="radio"
                  className="mt-1 accent-[color:var(--primary)]"
                  checked={!useDefault}
                  onChange={() => setUseDefault(false)}
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  {hasDefault ? "Upload a different resume" : "Upload a resume"}
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  aria-label="Upload resume file (PDF, DOC, or DOCX)"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      setUseDefault(false);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {file ? file.name : "Choose file"}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">PDF / DOC / DOCX</p>
              </div>
            </label>
          </div>

          {questions.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <p className="text-sm font-semibold text-[color:var(--ink)]">Screening questions</p>
              {questions.map((q) => (
                <div key={q.id} className="space-y-1.5">
                  <Label className="text-sm">
                    {q.prompt}
                    {q.required && <span className="ml-1 text-rose-600">*</span>}
                  </Label>
                  {q.type === "yes_no" && (
                    <div className="flex gap-3">
                      {[true, false].map((v) => (
                        <label key={String(v)} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="radio"
                            className="accent-[color:var(--primary)]"
                            checked={answers[q.id] === v}
                            onChange={() => setAnswer(q.id, v)}
                          />
                          {v ? "Yes" : "No"}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "single" && (
                    <div className="space-y-1">
                      {(q.options ?? []).map((opt) => (
                        <label key={opt} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="radio"
                            className="accent-[color:var(--primary)]"
                            checked={answers[q.id] === opt}
                            onChange={() => setAnswer(q.id, opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === "multi" && (
                    <div className="space-y-1">
                      {(q.options ?? []).map((opt) => {
                        const cur = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                        const checked = cur.includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(c) =>
                                setAnswer(q.id, c ? [...cur, opt] : cur.filter((x) => x !== opt))
                              }
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.type === "number" && (
                    <Input
                      type="number"
                      value={(answers[q.id] as number | undefined) ?? ""}
                      onChange={(e) =>
                        setAnswer(q.id, e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  )}
                  {q.type === "text" && (
                    <Input
                      maxLength={500}
                      value={(answers[q.id] as string | undefined) ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {quickHire && (
            <div className="space-y-2 rounded-lg border border-border bg-background p-3">
              <p className="text-sm font-semibold text-[color:var(--ink)]">
                Pick a phone-screen time
              </p>
              {slots.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No interview slots are available right now. You can still apply and the employer
                  will reach out.
                </p>
              ) : (
                <div className="space-y-1">
                  {slots.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"
                    >
                      <input
                        type="radio"
                        name="slot"
                        className="accent-[color:var(--primary)]"
                        checked={slotId === s.id}
                        onChange={() => setSlotId(s.id)}
                      />
                      <span>
                        {new Date(s.starts_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {s.capacity - (s.booked_count ?? 0)} left
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cover">Cover note (optional)</Label>
            <Textarea
              id="cover"
              rows={5}
              maxLength={2000}
              placeholder="Optional — but helpful. E.g. 'Forklift & reach certified, 3 yrs at a 3PL, available 2nd shift, can start immediately.'"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A sentence on your experience, certifications, and availability helps employers reach out faster.
            </p>
            <p className="text-xs text-muted-foreground">{coverNote.length} / 2000</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Send application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
