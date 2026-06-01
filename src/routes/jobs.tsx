import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Search, MapPin, Filter as FilterIcon, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JobCard, type JobSummary } from "@/components/job-card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { AdSlot } from "@/components/ad-slot";

const searchSchema = z.object({
  q: z.string().optional(),
  loc: z.string().optional(),
  category: z.string().optional(),
  shift: z.string().optional(),
  type: z.string().optional(),
});

export const Route = createFileRoute("/jobs")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Warehouse Job Search — DockHire" },
      { name: "description", content: "Search warehouse jobs by role, shift, employment type, and location." },
    ],
  }),
  component: JobsPage,
});

const SHIFTS = [
  { value: "first", label: "1st Shift" },
  { value: "second", label: "2nd Shift" },
  { value: "third", label: "3rd Shift" },
  { value: "weekend", label: "Weekend" },
];
const TYPES = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "temp", label: "Temp" },
  { value: "temp_to_hire", label: "Temp-to-Hire" },
  { value: "seasonal", label: "Seasonal" },
  { value: "contract", label: "Contract" },
];

function JobsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState(search.q ?? "");
  const [location, setLocation] = useState(search.loc ?? "");

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["jobs", search],
    queryFn: async () => {
      let q = supabase
        .from("jobs")
        .select("id, slug, title, location, shift, employment_type, pay_min, pay_max, featured, category, companies(name, slug)")
        .in("status", ["active", "published"])
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (search.q) q = q.ilike("title", `%${search.q}%`);
      if (search.loc) q = q.ilike("location", `%${search.loc}%`);
      if (search.category) q = q.eq("category", search.category);
      if (search.shift) q = q.eq("shift", search.shift as never);
      if (search.type) q = q.eq("employment_type", search.type as never);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as JobSummary[];
    },
  });

  const createAlertFromSearch = async () => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login", next: "/jobs" } as never });
      return;
    }
    if (role && role !== "job_seeker" && role !== "admin") {
      toast.error("Only job seekers can create alerts.");
      return;
    }
    if (!search.q && !search.loc && !search.category) {
      toast.error("Add a keyword, location, or category to create an alert.");
      return;
    }
    const [city, state] = (search.loc ?? "").split(",").map((s: string) => s.trim());
    const { error } = await supabase.from("job_alerts").insert({
      applicant_id: user.id,
      keyword: search.q || null,
      city: city || null,
      state: state ? state.toUpperCase().slice(0, 2) : null,
      frequency: "daily",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Alert created — manage it in your dashboard.");
      qc.invalidateQueries({ queryKey: ["seeker-alerts", user.id] });
    }
  };

  const hasActiveSearch = !!(search.q || search.loc || search.category || search.shift || search.type);

  const featured = useMemo(() => jobs.filter((j) => j.featured), [jobs]);
  const rest = useMemo(() => jobs.filter((j) => !j.featured), [jobs]);

  const updateSearch = (patch: Partial<typeof search>) => {
    navigate({ to: "/jobs", search: { ...search, ...patch } as never });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch({ q: keyword || undefined, loc: location || undefined });
  };

  // interleave one ad after every 6 results
  const withAds: Array<{ kind: "job"; job: JobSummary } | { kind: "ad" }> = [];
  rest.forEach((j, i) => {
    withAds.push({ kind: "job", job: j });
    if ((i + 1) % 6 === 0) withAds.push({ kind: "ad" });
  });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-[color:var(--ink)] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-xl sm:flex-row sm:items-stretch">
            <div className="flex flex-1 items-center gap-2 px-3 py-2.5">
              <Search className="h-5 w-5 text-muted-foreground" />
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Job title, keyword, or company" className="w-full bg-transparent text-[color:var(--ink)] focus:outline-none" />
            </div>
            <div className="flex flex-1 items-center gap-2 border-t border-border px-3 py-2.5 sm:border-l sm:border-t-0">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, state, or ZIP" className="w-full bg-transparent text-[color:var(--ink)] focus:outline-none" />
            </div>
            <button type="submit" className="btn-primary sm:px-6">Search</button>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[260px_1fr]">
        {/* FILTERS */}
        <aside className="space-y-6">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-primary" />
            <p className="label-caps">Filters</p>
          </div>

          <FilterGroup label="Shift">
            {SHIFTS.map((s) => (
              <FilterChip key={s.value} active={search.shift === s.value} onClick={() => updateSearch({ shift: search.shift === s.value ? undefined : s.value })}>{s.label}</FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="Employment Type">
            {TYPES.map((t) => (
              <FilterChip key={t.value} active={search.type === t.value} onClick={() => updateSearch({ type: search.type === t.value ? undefined : t.value })}>{t.label}</FilterChip>
            ))}
          </FilterGroup>

          {(search.q || search.loc || search.category || search.shift || search.type) && (
            <button onClick={() => navigate({ to: "/jobs", search: {} as never })} className="text-xs font-semibold text-primary hover:underline">Clear all filters</button>
          )}
        </aside>

        {/* RESULTS */}
        <main>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold text-[color:var(--ink)]">
              {isLoading ? "Searching…" : `${jobs.length} warehouse job${jobs.length === 1 ? "" : "s"}`}
              {search.q && <span className="text-muted-foreground"> for "{search.q}"</span>}
            </h1>
            {hasActiveSearch && (
              <Button
                variant="outline"
                size="sm"
                onClick={createAlertFromSearch}
                className="gap-1.5"
              >
                <BellRing className="h-4 w-4 text-primary" /> Create alert from this search
              </Button>
            )}
          </div>

          {featured.length > 0 && (
            <div className="mb-6">
              <p className="label-caps mb-3 flex items-center gap-2 text-primary">
                <span className="hazard-stripes inline-block h-3 w-3 rounded-sm" /> Featured
              </p>
              <div className="grid gap-3">
                {featured.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            </div>
          )}

          <div className="grid gap-3">
            {withAds.map((entry, i) =>
              entry.kind === "job" ? (
                <JobCard key={entry.job.id} job={entry.job} />
              ) : (
                <AdSlot key={`ad-${i}`} slot="search_inline" />
              ),
            )}
            {!isLoading && jobs.length === 0 && (
              <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
                <p className="text-base font-semibold text-[color:var(--ink)]">No jobs match those filters.</p>
                <p className="mt-1 text-sm text-muted-foreground">Try widening your search or clearing a filter.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-[color:var(--ink)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-[color:var(--ink)] hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

