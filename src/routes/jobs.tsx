import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
import { TEMP_ENVS, CERTIFICATIONS, CERT_LABEL, TEMP_LABEL } from "@/lib/warehouse-attrs";
import jobsStrip from "@/assets/jobs-strip.webp";
import { canonical } from "@/lib/seo";

const searchSchema = z.object({
  q: z.string().optional(),
  loc: z.string().optional(),
  category: z.string().optional(),
  shift: z.string().optional(),
  type: z.string().optional(),
  sort: z.enum(["relevance", "date", "pay_high"]).optional(),
  pay_min: z.coerce.number().optional(),
  radius: z.coerce.number().optional(),
  temp: z.enum(["ambient", "cooler", "freezer"]).optional(),
  certs: z.string().optional(), // comma-separated cert values
  weekly_pay: z.coerce.boolean().optional(),
  quick_hire: z.coerce.boolean().optional(),
  overtime: z.coerce.boolean().optional(),
  max_lift: z.coerce.number().optional(),
});

const RADIUS_OPTIONS = [10, 25, 50, 100] as const;

const PAGE_SIZE = 20;

async function fetchDefaultJobsPage() {
  const { data, error } = await supabase.rpc("search_jobs", {
    p_query: null,
    p_location: null,
    p_category: null,
    p_shift: null,
    p_type: null,
    p_pay_min: undefined,
    p_radius_miles: undefined,
    p_sort: "date",
    p_limit: PAGE_SIZE,
    p_offset: 0,
    p_temperature_env: null,
    p_certifications: null,
    p_weekly_pay: null,
    p_quick_hire: null,
    p_overtime: null,
    p_max_lift: null,
  } as never);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    slug: string;
    title: string;
    location: string;
    shift: string;
    employment_type: string;
    pay_min: number | null;
    pay_max: number | null;
    category: string;
    featured: boolean;
    company_name: string | null;
    company_slug: string | null;
    company_verified: boolean | null;
    temperature_env: string | null;
    certifications_required: string[] | null;
    weekly_pay: boolean | null;
    quick_hire: boolean | null;
    overtime_available: boolean | null;
    lift_requirement_lbs: number | null;
    has_screening: boolean | null;
    total_count: number;
  }>;
  const jobs: JobSummary[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    location: r.location,
    shift: r.shift,
    employment_type: r.employment_type,
    pay_min: r.pay_min,
    pay_max: r.pay_max,
    featured: r.featured,
    category: r.category,
    companies: r.company_name
      ? { name: r.company_name, slug: r.company_slug ?? "", verified: r.company_verified }
      : null,
    temperature_env: r.temperature_env,
    certifications_required: r.certifications_required,
    weekly_pay: r.weekly_pay,
    quick_hire: r.quick_hire,
    overtime_available: r.overtime_available,
    lift_requirement_lbs: r.lift_requirement_lbs,
    has_screening: !!r.has_screening,
  }));
  return { jobs, total: rows[0]?.total_count ?? 0, offset: 0 };
}

export const Route = createFileRoute("/jobs")({
  validateSearch: searchSchema,
  loader: async () => {
    const initialPage = await fetchDefaultJobsPage();
    return { initialPage };
  },
  head: () => ({
    meta: [
      { title: "Warehouse Job Search — WarehouseJobs.com" },
      {
        name: "description",
        content: "Search warehouse jobs by role, shift, employment type, and location.",
      },
    ],
    links: [{ rel: "canonical", href: canonical("/jobs") }],
  }),
  component: JobsPage,
});

const SHIFTS = [
  { value: "first", labelKey: "jobs.shift_first" },
  { value: "second", labelKey: "jobs.shift_second" },
  { value: "third", labelKey: "jobs.shift_third" },
  { value: "weekend", labelKey: "jobs.shift_weekend" },
];
const TYPES = [
  { value: "full_time", labelKey: "jobs.type_full_time" },
  { value: "part_time", labelKey: "jobs.type_part_time" },
  { value: "temp", labelKey: "jobs.type_temp" },
  { value: "temp_to_hire", labelKey: "jobs.type_temp_to_hire" },
  { value: "seasonal", labelKey: "jobs.type_seasonal" },
  { value: "contract", labelKey: "jobs.type_contract" },
];

const SORTS = [
  { value: "relevance", labelKey: "jobs.sort_relevance" },
  { value: "date", labelKey: "jobs.sort_date" },
  { value: "pay_high", labelKey: "jobs.sort_pay_high" },
] as const;

function JobsPage() {
  const search = Route.useSearch();
  const { initialPage } = Route.useLoaderData();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState(search.q ?? "");
  const [location, setLocation] = useState(search.loc ?? "");

  const sort = search.sort ?? (search.q ? "relevance" : "date");

  const isDefaultSearch =
    !search.q &&
    !search.loc &&
    !search.category &&
    !search.shift &&
    !search.type &&
    search.pay_min === undefined &&
    search.radius === undefined &&
    !search.temp &&
    !search.certs &&
    !search.weekly_pay &&
    !search.quick_hire &&
    !search.overtime &&
    search.max_lift === undefined &&
    !search.sort;

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["jobs-search", search, sort],
    initialPageParam: 0,
    initialData: isDefaultSearch
      ? { pages: [initialPage], pageParams: [0] }
      : undefined,
    queryFn: async ({ pageParam }) => {
      const certsArr = search.certs ? search.certs.split(",").filter(Boolean) : null;
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
        p_temperature_env: search.temp ?? null,
        p_certifications: certsArr && certsArr.length ? certsArr : null,
        p_weekly_pay: search.weekly_pay ? true : null,
        p_quick_hire: search.quick_hire ? true : null,
        p_overtime: search.overtime ? true : null,
        p_max_lift: search.max_lift ?? null,
      } as never);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string;
        slug: string;
        title: string;
        location: string;
        shift: string;
        employment_type: string;
        pay_min: number | null;
        pay_max: number | null;
        category: string;
        featured: boolean;
        company_name: string | null;
        company_slug: string | null;
        company_verified: boolean | null;
        temperature_env: string | null;
        certifications_required: string[] | null;
        weekly_pay: boolean | null;
        quick_hire: boolean | null;
        overtime_available: boolean | null;
        lift_requirement_lbs: number | null;
        has_screening: boolean | null;
        total_count: number;
      }>;
      const jobs: JobSummary[] = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        location: r.location,
        shift: r.shift,
        employment_type: r.employment_type,
        pay_min: r.pay_min,
        pay_max: r.pay_max,
        featured: r.featured,
        category: r.category,
        companies: r.company_name
          ? { name: r.company_name, slug: r.company_slug ?? "", verified: r.company_verified }
          : null,
        temperature_env: r.temperature_env,
        certifications_required: r.certifications_required,
        weekly_pay: r.weekly_pay,
        quick_hire: r.quick_hire,
        overtime_available: r.overtime_available,
        lift_requirement_lbs: r.lift_requirement_lbs,
        has_screening: !!r.has_screening,
      }));
      return { jobs, total: rows[0]?.total_count ?? 0, offset: pageParam };
    },
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.offset + lastPage.jobs.length;
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  const jobs = useMemo(() => (data?.pages.flatMap((p) => p.jobs) ?? []) as JobSummary[], [data]);
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

  const hasActiveSearch = !!(
    search.q ||
    search.loc ||
    search.category ||
    search.shift ||
    search.type ||
    search.pay_min ||
    search.radius ||
    search.temp ||
    search.certs ||
    search.weekly_pay ||
    search.quick_hire ||
    search.overtime ||
    search.max_lift
  );

  const shiftLabel = SHIFTS.find((s) => s.value === search.shift)?.labelKey
    ? (t(SHIFTS.find((s) => s.value === search.shift)!.labelKey) as string)
    : undefined;
  const typeLabel = TYPES.find((tt) => tt.value === search.type)?.labelKey
    ? (t(TYPES.find((tt) => tt.value === search.type)!.labelKey) as string)
    : undefined;
  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (search.q)
    activeChips.push({
      key: "q",
      label: `"${search.q}"`,
      clear: () => updateSearch({ q: undefined }),
    });
  if (search.loc)
    activeChips.push({
      key: "loc",
      label: search.loc,
      clear: () => updateSearch({ loc: undefined, radius: undefined }),
    });
  if (search.loc && search.radius)
    activeChips.push({
      key: "radius",
      label: `within ${search.radius} mi`,
      clear: () => updateSearch({ radius: undefined }),
    });
  if (search.category)
    activeChips.push({
      key: "category",
      label: search.category,
      clear: () => updateSearch({ category: undefined }),
    });
  if (shiftLabel)
    activeChips.push({
      key: "shift",
      label: shiftLabel,
      clear: () => updateSearch({ shift: undefined }),
    });
  if (typeLabel)
    activeChips.push({
      key: "type",
      label: typeLabel,
      clear: () => updateSearch({ type: undefined }),
    });
  if (search.pay_min)
    activeChips.push({
      key: "pay_min",
      label: `≥ $${search.pay_min}/hr`,
      clear: () => updateSearch({ pay_min: undefined }),
    });
  if (search.temp)
    activeChips.push({
      key: "temp",
      label: TEMP_LABEL[search.temp] ?? search.temp,
      clear: () => updateSearch({ temp: undefined }),
    });
  if (search.certs) {
    search.certs
      .split(",")
      .filter(Boolean)
      .forEach((c: string) => {
        activeChips.push({
          key: `cert-${c}`,
          label: CERT_LABEL[c] ?? c,
          clear: () => {
            const next = (search.certs ?? "")
              .split(",")
              .filter(Boolean)
              .filter((x: string) => x !== c);
            updateSearch({ certs: next.length ? next.join(",") : undefined });
          },
        });
      });
  }
  if (search.weekly_pay)
    activeChips.push({
      key: "weekly",
      label: t("jobs.weeklyPay") as string,
      clear: () => updateSearch({ weekly_pay: undefined }),
    });
  if (search.quick_hire)
    activeChips.push({
      key: "quick",
      label: t("jobs.quickHire") as string,
      clear: () => updateSearch({ quick_hire: undefined }),
    });
  if (search.overtime)
    activeChips.push({
      key: "ot",
      label: t("jobs.overtime") as string,
      clear: () => updateSearch({ overtime: undefined }),
    });
  if (search.max_lift)
    activeChips.push({
      key: "lift",
      label: `≤ ${search.max_lift} lbs`,
      clear: () => updateSearch({ max_lift: undefined }),
    });

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

      <section
        className="relative border-b border-border bg-[color:var(--ink)] py-8"
        aria-label="Search"
      >
        <img
          src={jobsStrip}
          alt="Three smiling warehouse workers walking through a sunlit pallet-rack aisle in a distribution center."
          width={1920}
          height={600}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--ink)] via-[color:var(--ink)]/80 to-[color:var(--ink)]/60" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <form
            onSubmit={submit}
            role="search"
            aria-label={t("common.searchJobs") as string}
            className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-xl sm:flex-row sm:items-stretch"
          >
            <div className="flex flex-1 items-center gap-2 px-3 py-2.5">
              <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="jobs-keyword" className="sr-only">
                {t("common.keyword")}
              </label>
              <input
                id="jobs-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t("common.keyword") as string}
                className="w-full bg-transparent text-[color:var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              />
            </div>
            <div className="flex flex-1 items-center gap-2 border-t border-border px-3 py-2.5 sm:border-l sm:border-t-0">
              <MapPin className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="jobs-location" className="sr-only">
                {t("common.locationPlaceholder")}
              </label>
              <input
                id="jobs-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("common.locationPlaceholder") as string}
                className="w-full bg-transparent text-[color:var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              />
            </div>
            <button type="submit" className="btn-primary sm:px-6">
              {t("common.search")}
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[260px_1fr]">
        {/* FILTERS */}
        <aside className="space-y-6">
          <div className="flex items-center gap-2">
            <FilterIcon className="h-4 w-4 text-primary" />
            <p className="label-caps">{t("jobs.filters")}</p>
          </div>

          <FilterGroup label={t("jobs.shift") as string}>
            {SHIFTS.map((s) => (
              <FilterChip
                key={s.value}
                active={search.shift === s.value}
                onClick={() =>
                  updateSearch({ shift: search.shift === s.value ? undefined : s.value })
                }
              >
                {t(s.labelKey)}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label={t("jobs.employmentType") as string}>
            {TYPES.map((ty) => (
              <FilterChip
                key={ty.value}
                active={search.type === ty.value}
                onClick={() =>
                  updateSearch({ type: search.type === ty.value ? undefined : ty.value })
                }
              >
                {t(ty.labelKey)}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="Temperature">
            {TEMP_ENVS.map((t) => (
              <FilterChip
                key={t.value}
                active={search.temp === t.value}
                onClick={() =>
                  updateSearch({ temp: search.temp === t.value ? undefined : t.value })
                }
              >
                {t.short}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label={t("jobs.certifications") as string}>
            {CERTIFICATIONS.map((c) => {
              const active = (search.certs ?? "").split(",").filter(Boolean).includes(c.value);
              return (
                <FilterChip
                  key={c.value}
                  active={active}
                  onClick={() => {
                    const cur = (search.certs ?? "").split(",").filter(Boolean);
                    const next = active
                      ? cur.filter((x: string) => x !== c.value)
                      : [...cur, c.value];
                    updateSearch({ certs: next.length ? next.join(",") : undefined });
                  }}
                >
                  {c.label}
                </FilterChip>
              );
            })}
          </FilterGroup>

          <FilterGroup label={t("jobs.perks") as string}>
            <FilterChip
              active={!!search.weekly_pay}
              onClick={() => updateSearch({ weekly_pay: search.weekly_pay ? undefined : true })}
            >
              {t("jobs.weeklyPay")}
            </FilterChip>
            <FilterChip
              active={!!search.quick_hire}
              onClick={() => updateSearch({ quick_hire: search.quick_hire ? undefined : true })}
            >
              {t("jobs.quickHire")}
            </FilterChip>
            <FilterChip
              active={!!search.overtime}
              onClick={() => updateSearch({ overtime: search.overtime ? undefined : true })}
            >
              {t("jobs.overtime")}
            </FilterChip>
          </FilterGroup>

          <div>
            <label
              htmlFor="filter-lift"
              className="mb-2 block text-sm font-semibold text-[color:var(--ink)]"
            >
              {t("jobs.maxLift")}
            </label>
            <select
              id="filter-lift"
              value={search.max_lift ?? ""}
              onChange={(e) =>
                updateSearch({ max_lift: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">{t("jobs.any")}</option>
              <option value="25">≤ 25 lbs</option>
              <option value="50">≤ 50 lbs</option>
              <option value="75">≤ 75 lbs</option>
              <option value="100">≤ 100 lbs</option>
            </select>
          </div>

          {hasActiveSearch && (
            <button
              onClick={() => navigate({ to: "/jobs", search: {} as never })}
              className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {t("jobs.clearAll")}
            </button>
          )}
        </aside>

        {/* RESULTS */}
        <main>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold text-[color:var(--ink)]">
              {isLoading
                ? t("jobs.pageTitleSearching")
                : t("jobs.resultsCount", { count: total })}
              {search.q && <span className="text-muted-foreground"> {t("jobs.forQuery", { q: search.q })}</span>}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="filter-pay" className="text-xs text-muted-foreground">
                {t("jobs.minPay")}
              </label>
              <select
                id="filter-pay"
                value={search.pay_min ?? ""}
                onChange={(e) =>
                  updateSearch({ pay_min: e.target.value ? Number(e.target.value) : undefined })
                }
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">{t("jobs.any")}</option>
                <option value="15">$15+/hr</option>
                <option value="17">$17+/hr</option>
                <option value="18">$18+/hr</option>
                <option value="20">$20+/hr</option>
                <option value="22">$22+/hr</option>
                <option value="25">$25+/hr</option>
              </select>
              <label htmlFor="filter-radius" className="ml-2 text-xs text-muted-foreground">
                {t("jobs.within")}
              </label>
              <select
                id="filter-radius"
                value={search.radius ?? ""}
                onChange={(e) =>
                  updateSearch({ radius: e.target.value ? Number(e.target.value) : undefined })
                }
                disabled={!search.loc}
                title={
                  search.loc ? "Search radius around location" : "Enter a location to enable radius"
                }
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-[color:var(--ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="">{t("jobs.anyDistance")}</option>
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r} miles
                  </option>
                ))}
              </select>
              <label htmlFor="filter-sort" className="ml-2 text-xs text-muted-foreground">
                {t("jobs.sort")}
              </label>
              <select
                id="filter-sort"
                value={sort}
                onChange={(e) =>
                  updateSearch({ sort: e.target.value as "relevance" | "date" | "pay_high" })
                }
                className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {t(s.labelKey)}
                  </option>
                ))}
              </select>
              {hasActiveSearch && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={createAlertFromSearch}
                  className="gap-1.5"
                >
                  <BellRing className="h-4 w-4 text-primary" aria-hidden="true" /> {t("jobs.getAlerts")}
                </Button>
              )}
            </div>
          </div>

          {activeChips.length > 0 && (
            <div
              className="mb-4 flex flex-wrap items-center gap-1.5"
              role="region"
              aria-label="Active filters"
            >
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  onClick={chip.clear}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-[color:var(--ink)] hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {chip.label}
                  <span aria-hidden="true" className="text-muted-foreground">
                    ×
                  </span>
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
                <span className="hazard-stripes inline-block h-3 w-3 rounded-sm" /> {t("jobs.featured")}
              </p>
              <div className="grid gap-3">
                {featured.map((j) => (
                  <JobCard key={j.id} job={j} />
                ))}
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
                    title={t("jobs.emptyTitle") as string}
                    description={t("jobs.emptyBody") as string}
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
                    {isFetchingNextPage ? t("common.loading") : t("jobs.loadMore")}
                  </Button>
                </div>
              ) : jobs.length > 0 ? (
                <p className="mt-6 text-center text-xs text-muted-foreground">
                  {t("jobs.endOfResults", { total })}
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
