import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
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
import { JobCardSkeletonList, EmptyState } from "@/components/ui/skeleton-list";
import { Briefcase } from "lucide-react";

const searchSchema = z.object({
  q: z.string().optional(),
  loc: z.string().optional(),
  category: z.string().optional(),
  shift: z.string().optional(),
  type: z.string().optional(),
  sort: z.enum(["relevance", "date", "pay_high"]).optional(),
  pay_min: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
});

const RADIUS_OPTIONS = [10, 25, 50, 100] as const;

export const Route = createFileRoute("/jobs")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Warehouse Job Search — WarehouseJobs" },
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

const SORTS = [
  { value: "relevance", label: "Best match" },
  { value: "date", label: "Newest" },
  { value: "pay_high", label: "Highest pay" },
] as const;

function JobsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState(search.q ?? "");
  const [location, setLocation] = useState(search.loc ?? "");

  const sort = search.sort ?? (search.q ? "relevance" : "date");

  const PAGE_SIZE = 20;
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["jobs-search", search, sort],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("search_jobs", {
        p_query: search.q ?? null,
        p_location: search.loc ?? null,
        p_category: search.category ?? null,
        p_shift: search.shift ?? null,
        p_type: search.type ?? null,
        p_pay_min: search.pay_min,
        p_radius_miles: search.loc && search.radius ? search.radius : undefined,
        p_sort: sort,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string; slug: string; title: string; location: string;
        shift: string; employment_type: string;
        pay_min: number | null; pay_max: number | null;
        category: string; featured: boolean;
        company_name: string | null; company_slug: string | null; company_verified: boolean | null;
        total_count: number;
      }>;
      const jobs: JobSummary[] = rows.map((r) => ({
        id: r.id, slug: r.slug, title: r.title, location: r.location,
        shift: r.shift, employment_type: r.employment_type,
        pay_min: r.pay_min, pay_max: r.pay_max, featured: r.featured,
        category: r.category,
        companies: r.company_name ? { name: r.company_name, slug: r.company_slug ?? "", verified: r.company_verified } : null,
      }));
      return { jobs, total: rows[0]?.total_count ?? 0, offset: pageParam };
    },
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.offset + lastPage.jobs.length;
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const jobs = useMemo(
    () => (data?.pages.flatMap((p) => p.jobs) ?? []) as JobSummary[],
    [data],
  );
  const total = data?.pages[0]?.total ?? 0;

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

  const updateSearch = (patch: Partial<typeof search>) => {
    navigate({ to: "/jobs", search: { ...search, ...patch } as never });
  };

  const hasActiveSearch = !!(search.q || search.loc || search.category || search.shift || search.type || search.pay_min || search.radius);

  const shiftLabel = SHIFTS.find((s) => s.value === search.shift)?.label;
  const typeLabel = TYPES.find((t) => t.value === search.type)?.label;
  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (search.q) activeChips.push({ key: "q", label: `"${search.q}"`, clear: () => updateSearch({ q: undefined }) });
  if (search.loc) activeChips.push({ key: "loc", label: search.loc, clear: () => updateSearch({ loc: undefined, radius: undefined }) });
  if (search.loc && search.radius) activeChips.push({ key: "radius", label: `within ${search.radius} mi`, clear: () => updateSearch({ radius: undefined }) });
  if (search.category) activeChips.push({ key: "category", label: search.category, clear: () => updateSearch({ category: undefined }) });
  if (shiftLabel) activeChips.push({ key: "shift", label: shiftLabel, clear: () => updateSearch({ shift: undefined }) });
  if (typeLabel) activeChips.push({ key: "type", label: typeLabel, clear: () => updateSearch({ type: undefined }) });
  if (search.pay_min) activeChips.push({ key: "pay_min", label: `≥ $${search.pay_min}/hr`, clear: () => updateSearch({ pay_min: undefined }) });

  const featured = useMemo(() => jobs.filter((j) => j.featured), [jobs]);
  const rest = useMemo(() => jobs.filter((j) => !j.featured), [jobs]);

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

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasNextPage) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <section className="border-b border-border bg-[color:var(--ink)] py-8" aria-label="Search">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <form onSubmit={submit} role="search" aria-label="Search warehouse jobs" className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-xl sm:flex-row sm:items-stretch">
            <div className="flex flex-1 items-center gap-2 px-3 py-2.5">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="jobs-keyword" className="sr-only">Job title, keyword, or company</label>
              <input id="jobs-keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Job title, keyword, or company" className="w-full bg-transparent text-[color:var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded" />
            </div>
            <div className="flex flex-1 items-center gap-2 border-t border-border px-3 py-2.5 sm:border-l sm:border-t-0">
              <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="jobs-location" className="sr-only">Location (city, state, or ZIP)</label>
              <input id="jobs-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, state, or ZIP" className="w-full bg-transparent text-[color:var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded" />
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
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold text-[color:var(--ink)]">
              {isLoading ? "Searching…" : `${total} warehouse job${total === 1 ? "" : "s"}`}
              {search.q && <span className="text-muted-foreground"> for "{search.q}"</span>}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="filter-pay" className="text-xs text-muted-foreground">Min pay</label>
              <select
                id="filter-pay"
                value={search.pay_min ?? ""}
                onChange={(e) =>
                  updateSearch({ pay_min: e.target.value ? Number(e.target.value) : undefined })
                }
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">Any</option>
                <option value="15">$15+/hr</option>
                <option value="17">$17+/hr</option>
                <option value="18">$18+/hr</option>
                <option value="20">$20+/hr</option>
                <option value="22">$22+/hr</option>
                <option value="25">$25+/hr</option>
              </select>
              <label htmlFor="filter-radius" className="ml-2 text-xs text-muted-foreground">Within</label>
              <select
                id="filter-radius"
                value={search.radius ?? ""}
                onChange={(e) =>
                  updateSearch({ radius: e.target.value ? Number(e.target.value) : undefined })
                }
                disabled={!search.loc}
                title={search.loc ? "Search radius around location" : "Enter a location to enable radius"}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-[color:var(--ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">Any distance</option>
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r} miles</option>
                ))}
              </select>
              <label htmlFor="filter-sort" className="ml-2 text-xs text-muted-foreground">Sort</label>
              <select
                id="filter-sort"
                value={sort}
                onChange={(e) => updateSearch({ sort: e.target.value as "relevance" | "date" | "pay_high" })}
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {hasActiveSearch && (
                <Button variant="outline" size="sm" onClick={createAlertFromSearch} className="gap-1.5">
                  <BellRing className="h-4 w-4 text-primary" aria-hidden="true" /> Get alerts for this search
                </Button>
              )}
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5" role="region" aria-label="Active filters">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.clear}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-[color:var(--ink)] hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {chip.label}
                  <span aria-hidden="true" className="text-muted-foreground">×</span>
                </button>
              ))}
              <button
                onClick={() => navigate({ to: "/jobs", search: {} as never })}
                className="ml-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                Clear all
              </button>
            </div>
          )}

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

          {isLoading ? (
            <JobCardSkeletonList count={6} />
          ) : (
            <>
              <div className="grid gap-3">
                {withAds.map((entry, i) =>
                  entry.kind === "job" ? (
                    <JobCard key={entry.job.id} job={entry.job} />
                  ) : (
                    <AdSlot key={`ad-${i}`} slot="search_inline" />
                  ),
                )}
                {jobs.length === 0 && (
                  <EmptyState
                    icon={Briefcase}
                    title="No jobs match those filters."
                    description="Try widening your search or clearing a filter."
                  />
                )}
              </div>

              {isFetchingNextPage && (
                <div className="mt-3">
                  <JobCardSkeletonList count={3} />
                </div>
              )}

              {hasNextPage ? (
                <div ref={loadMoreRef} className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? "Loading…" : "Load more jobs"}
                  </Button>
                </div>
              ) : jobs.length > 0 ? (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  You've reached the end · {total} job{total === 1 ? "" : "s"} total
                </p>
              ) : null}
            </>
          )}
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
      aria-pressed={active}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-[color:var(--ink)] hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}

