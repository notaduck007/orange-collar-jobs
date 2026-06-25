import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://warehousejobs.com";
const API_BASE = process.env.API_URL ?? "http://localhost:3001";

export const Route = createFileRoute("/jobs.json")({
  server: {
    handlers: {
      GET: async () => {
        let items: unknown[] = [];

        try {
          const res = await fetch(`${API_BASE}/api/v1/jobs?status=published&pageSize=1000&page=1`);
          if (res.ok) {
            const body = (await res.json()) as {
              data?: {
                title: string;
                slug: string;
                category: string;
                city: string | null;
                state: string | null;
                employmentType: string;
                payMin: number | null;
                payMax: number | null;
                payPeriod: string | null;
                postedAt: string | null;
                updatedAt: string | null;
                companyName: string | null;
              }[];
            };

            items = (body.data ?? []).map((j) => {
              const item: Record<string, unknown> = {
                title: j.title,
                company: j.companyName,
                category: j.category,
                location: { city: j.city, state: j.state },
                employment_type: j.employmentType,
                posted_at: j.postedAt ?? j.updatedAt,
                url: `${BASE_URL}/jobs/${j.slug}`,
              };
              if (j.payMin !== null || j.payMax !== null) {
                item.pay = {
                  min: j.payMin,
                  max: j.payMax,
                  period: j.payPeriod ?? "hour",
                  currency: "USD",
                };
              }
              return item;
            });
          }
        } catch {
          // best-effort
        }

        return new Response(
          JSON.stringify({
            site: "WarehouseJobs",
            url: BASE_URL,
            generated_at: new Date().toISOString(),
            job_count: items.length,
            jobs: items,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=900",
            },
          },
        );
      },
    },
  },
});
