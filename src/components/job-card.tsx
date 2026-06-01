import { Link } from "@tanstack/react-router";
import { MapPin, Clock, DollarSign, Zap, CheckCircle2 } from "lucide-react";
import { useAppliedJobs } from "@/hooks/use-applied-jobs";

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
  companies?: { name: string; slug: string } | null;
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

export function JobCard({ job }: { job: JobSummary }) {
  const pay = job.pay_min && job.pay_max ? `$${job.pay_min}–$${job.pay_max}/hr` : null;
  return (
    <Link
      to="/jobs/$slug"
      params={{ slug: job.slug }}
      className="group relative block rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-card-hover)]"
    >
      {job.featured && (
        <div className="absolute -top-px right-4 flex items-center gap-1 rounded-b-md bg-[color:var(--hazard)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--ink)]">
          <Zap className="h-3 w-3" fill="currentColor" /> Featured
        </div>
      )}
      <p className="label-caps">{job.category} • {shiftLabel[job.shift]}</p>
      <h3 className="mt-1.5 text-lg font-semibold leading-tight text-[color:var(--ink)] group-hover:text-primary">
        {job.title}
      </h3>
      {job.companies && (
        <p className="mt-0.5 text-sm font-medium text-foreground">{job.companies.name}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {job.location}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {typeLabel[job.employment_type]}</span>
        {pay && <span className="inline-flex items-center gap-1 font-medium text-[color:var(--ink)]"><DollarSign className="h-3.5 w-3.5" /> {pay}</span>}
      </div>
    </Link>
  );
}
