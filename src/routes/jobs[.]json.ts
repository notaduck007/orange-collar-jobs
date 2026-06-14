import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://warehousejobs.com";

interface JobRow {
  title: string;
  slug: string;
  category: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  employment_type: string;
  pay_min: number | null;
  pay_max: number | null;
  pay_period: string | null;
  posted_at: string | null;
  created_at: string | null;
  expires_at: string | null;
  companies: { name: string } | { name: string }[] | null;
}

export const Route = createFileRoute("/jobs.json")({
  server: {
    handlers: {
      GET: async () => {
        let jobs: JobRow[] = [];
        try {
          const url = process.env.SUPABASE_URL!;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
          if (url && key) {
            const supabase = createClient(url, key);
            const { data } = await supabase
              .from("jobs")
              .select(
                "title, slug, category, city, state, zip, employment_type, pay_min, pay_max, pay_period, posted_at, created_at, expires_at, companies(name)",
              )
              .in("status", ["active", "published"])
              .order("created_at", { ascending: false })
              .limit(1000);
            jobs = (data ?? []) as JobRow[];
          }
        } catch {
          // Best-effort
        }

        const items = jobs.map((j) => {
          const company = Array.isArray(j.companies)
            ? (j.companies[0]?.name ?? null)
            : (j.companies?.name ?? null);
          const item: Record<string, unknown> = {
            title: j.title,
            company,
            category: j.category,
            location: { city: j.city, state: j.state, zip: j.zip },
            employment_type: j.employment_type,
            posted_at: j.posted_at ?? j.created_at,
            expires_at: j.expires_at,
            url: `${BASE_URL}/jobs/${j.slug}`,
          };
          if (j.pay_min !== null || j.pay_max !== null) {
            item.pay = {
              min: j.pay_min,
              max: j.pay_max,
              period: j.pay_period ?? "hour",
              currency: "USD",
            };
          }
          return item;
        });

        const body = {
          site: "WarehouseJobs",
          url: BASE_URL,
          generated_at: new Date().toISOString(),
          job_count: items.length,
          jobs: items,
        };

        return new Response(JSON.stringify(body), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=900",
          },
        });
      },
    },
  },
});
