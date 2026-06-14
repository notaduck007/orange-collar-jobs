import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MapPin,
  Clock,
  DollarSign,
  Zap,
  CheckCircle2,
  BadgeCheck,
  Snowflake,
  Forklift,
  CalendarClock,
  Timer,
  Dumbbell,
} from "lucide-react";
import {
  useAppliedJobs,
  useQuickApplyReady,
  useSeekerMatchProfile,
} from "@/hooks/use-applied-jobs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CERT_LABEL, TEMP_LABEL } from "@/lib/warehouse-attrs";
import { ApplySuccessDialog } from "@/components/apply-success-dialog";

export interface JobSummary {
  id: string;
  slug: string;
  title: string;
  location: string;
  shift: string;
  employment_type: string;
  pay_min: number | null;
  pay_max: number | null;
  featured: boolean;
  category: string;
  companies?: { name: string; slug: string; verified?: boolean | null } | null;
  // Warehouse attrs (optional — older callers may not include them)
  temperature_env?: string | null;
  certifications_required?: string[] | null;
  weekly_pay?: boolean | null;
  quick_hire?: boolean | null;
  overtime_available?: boolean | null;
  lift_requirement_lbs?: number | null;
  has_screening?: boolean | null;
}

const shiftLabel: Record<string, string> = {
  first: "1st Shift",
  second: "2nd Shift",
  third: "3rd Shift",
  weekend: "Weekend",
  flexible: "Flexible",
};

const typeLabel: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  temp: "Temp",
  temp_to_hire: "Temp-to-Hire",
  seasonal: "Seasonal",
  contract: "Contract",
};

function Badge({
  icon: Icon,
  children,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  tone?: "neutral" | "cold" | "hot" | "money" | "fast";
}) {
  const toneClass = {
    neutral: "bg-muted text-[color:var(--ink)] ring-border",
    cold: "bg-sky-50 text-sky-800 ring-sky-200",
    hot: "bg-amber-50 text-amber-900 ring-amber-200",
    money: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    fast: "bg-rose-50 text-rose-800 ring-rose-200",
  }[tone];
  return (
    <span
      className={`relative z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${toneClass}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}

export function JobCard({ job }: { job: JobSummary }) {
  const { user } = useAuth();
  const appliedIds = useAppliedJobs();
  const applied = appliedIds.has(job.id);
  const quickApply = useQuickApplyReady();
  const seekerMatch = useSeekerMatchProfile();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const pay = job.pay_min && job.pay_max ? `$${job.pay_min}–$${job.pay_max}/hr` : null;

  const showApplyControl = !!user && !applied && quickApply.ready;
  const canQuickApply = showApplyControl && !job.has_screening;

  const handleQuickApply = async () => {
    if (!user || submitting) return;
    setSubmitting(true);
    const [{ data: prof }, { data: seeker }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, display_name, phone")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("seeker_profiles")
        .select(
          "headline, skills, certifications, desired_shift, desired_employment_type, willing_to_relocate",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const { error } = await supabase.from("applications").insert({
      job_id: job.id,
      applicant_id: user.id,
      resume_url: quickApply.resumeUrl ?? null,
      applicant_email: user.email ?? null,
      applicant_name: prof?.full_name || prof?.display_name || null,
      applicant_phone: prof?.phone ?? null,
      applicant_headline: seeker?.headline ?? null,
      applicant_skills: seeker?.skills ?? null,
      applicant_certifications: seeker?.certifications ?? null,
      applicant_desired_shift: seeker?.desired_shift ?? null,
      applicant_desired_employment_type: seeker?.desired_employment_type ?? null,
      applicant_willing_to_relocate: seeker?.willing_to_relocate ?? null,
    });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") toast.message("You've already applied to this job.");
      else toast.error(error.message);
      return;
    }
    toast.success("Application sent!");
    qc.invalidateQueries({ queryKey: ["seeker-applied-ids", user.id] });
    qc.invalidateQueries({ queryKey: ["seeker-apps", user.id] });
    qc.invalidateQueries({ queryKey: ["seeker-stats", user.id] });
    setSuccessOpen(true);
  };

  const certs = job.certifications_required ?? [];
  const hasAttrBadges =
    !!job.temperature_env ||
    certs.length > 0 ||
    job.weekly_pay ||
    job.quick_hire ||
    job.overtime_available ||
    (job.lift_requirement_lbs ?? 0) > 0;

  const matchHints: string[] = [];
  if (user && seekerMatch) {
    const seekerCerts = (seekerMatch.certifications ?? []).map((c) => c.toLowerCase());
    const jobCerts = certs.map((c) => c.toLowerCase());
    const overlap = jobCerts.find((c) => seekerCerts.includes(c));
    if (overlap) {
      const original = certs.find((c) => c.toLowerCase() === overlap) ?? overlap;
      matchHints.push(`Matches your ${CERT_LABEL[original] ?? original} cert`);
    }
    if (seekerMatch.desired_shift && seekerMatch.desired_shift === job.shift) {
      matchHints.push(`${shiftLabel[job.shift] ?? job.shift} — your preference`);
    }
  }
  const hintsToShow = matchHints.slice(0, 2);

  return (
    <>
      <div className="group relative rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]">
        {job.featured && (
          <div className="absolute -top-px right-4 flex items-center gap-1 rounded-b-md bg-[color:var(--hazard)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink)]">
            <Zap className="h-3 w-3" fill="currentColor" aria-hidden /> Featured
          </div>
        )}
        <p className="label-caps">
          {job.category} • {shiftLabel[job.shift]}
        </p>
        <h3 className="mt-1.5 text-lg font-semibold leading-tight text-[color:var(--ink)] group-hover:text-primary">
          <Link
            to="/jobs/$slug"
            params={{ slug: job.slug }}
            className="before:absolute before:inset-0 before:content-['']"
          >
            {job.title}
          </Link>
        </h3>
        {job.companies && (
          <div className="mt-0.5 flex items-center gap-1.5">
            {job.companies.slug ? (
              <Link
                to="/companies/$slug"
                params={{ slug: job.companies.slug }}
                className="relative z-10 text-sm font-medium text-foreground hover:text-primary hover:underline"
              >
                {job.companies.name}
              </Link>
            ) : (
              <span className="text-sm font-medium text-foreground">{job.companies.name}</span>
            )}
            {job.companies.verified && (
              <span
                title="Verified employer"
                className="relative z-10 inline-flex items-center text-blue-600"
              >
                <BadgeCheck className="h-4 w-4" aria-hidden />
              </span>
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {job.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden /> {typeLabel[job.employment_type]}
          </span>
          {pay && (
            <span className="inline-flex items-center gap-1 font-medium text-[color:var(--ink)]">
              <DollarSign className="h-3.5 w-3.5" aria-hidden /> {pay}
            </span>
          )}
        </div>

        {hasAttrBadges && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {job.quick_hire && (
              <Badge icon={Timer} tone="fast">
                Same-day hire
              </Badge>
            )}
            {job.weekly_pay && (
              <Badge icon={DollarSign} tone="money">
                Weekly pay
              </Badge>
            )}
            {job.temperature_env && job.temperature_env !== "ambient" && (
              <Badge icon={Snowflake} tone="cold">
                {TEMP_LABEL[job.temperature_env] ?? job.temperature_env}
              </Badge>
            )}
            {certs.map((c) => (
              <Badge key={c} icon={Forklift}>
                {CERT_LABEL[c] ?? c}
              </Badge>
            ))}
            {job.overtime_available && (
              <Badge icon={CalendarClock} tone="hot">
                OT available
              </Badge>
            )}
            {(job.lift_requirement_lbs ?? 0) > 0 && (
              <Badge icon={Dumbbell}>Lift {job.lift_requirement_lbs}+ lbs</Badge>
            )}
          </div>
        )}

        {hintsToShow.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hintsToShow.map((h) => (
              <span
                key={h}
                className="relative z-10 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
              >
                <CheckCircle2 className="h-3 w-3" aria-hidden /> {h}
              </span>
            ))}
          </div>
        )}

        {applied ? (
          <span className="relative z-10 mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Applied
          </span>
        ) : showApplyControl ? (
          <div className="relative z-10 mt-3">
            {canQuickApply ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleQuickApply();
                }}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {submitting ? "Applying…" : "Quick apply"}
              </button>
            ) : (
              <Link
                to="/jobs/$slug"
                params={{ slug: job.slug }}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Apply
              </Link>
            )}
          </div>
        ) : null}
      </div>
      <ApplySuccessDialog open={successOpen} onOpenChange={setSuccessOpen} />
    </>
  );
}
