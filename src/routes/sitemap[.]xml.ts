import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://warehousejobs.com";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/jobs", changefreq: "hourly", priority: "0.9" },
          { path: "/pricing", changefreq: "weekly", priority: "0.7" },
          { path: "/about", changefreq: "monthly", priority: "0.5" },
          { path: "/contact", changefreq: "monthly", priority: "0.5" },
          { path: "/faq", changefreq: "monthly", priority: "0.5" },
          { path: "/mission", changefreq: "monthly", priority: "0.5" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/jobs/category/forklift-operator", changefreq: "daily", priority: "0.8" },
          { path: "/jobs/category/picker-packer", changefreq: "daily", priority: "0.8" },
          { path: "/jobs/category/shipping-receiving", changefreq: "daily", priority: "0.8" },
          { path: "/jobs/category/order-selector", changefreq: "daily", priority: "0.8" },
          { path: "/jobs/category/inventory-clerk", changefreq: "daily", priority: "0.8" },
          { path: "/jobs/category/warehouse-associate", changefreq: "daily", priority: "0.8" },
        ];

        try {
          const url = process.env.SUPABASE_URL!;
          const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
          if (url && key) {
            const supabase = createClient(url, key);

            // Dynamic job listings
            const { data: jobs } = await supabase
              .from("jobs")
              .select("slug, created_at")
              .in("status", ["active", "published"])
              .order("created_at", { ascending: false })
              .limit(5000);
            (jobs ?? []).forEach((j: { slug: string; created_at: string }) => {
              const lastmod = j.created_at;
              entries.push({
                path: `/jobs/${j.slug}`,
                lastmod: lastmod?.slice(0, 10),
                changefreq: "daily",
                priority: "0.8",
              });
            });

            // Dynamic company listings — only companies with at least one active/published job
            const { data: companyJobs } = await supabase
              .from("jobs")
              .select("companies(slug)")
              .in("status", ["active", "published"])
              .limit(5000);
            const slugs = new Set<string>();
            (companyJobs ?? []).forEach((row: { companies: { slug: string } | { slug: string }[] | null }) => {
              const c = row.companies;
              const slug = Array.isArray(c) ? c[0]?.slug : c?.slug;
              if (slug) slugs.add(slug);
            });
            slugs.forEach((slug) => {
              entries.push({
                path: `/companies/${slug}`,
                changefreq: "weekly",
                priority: "0.6",
              });
            });

            // Dynamic location pages — distinct city/state from active jobs
            const { data: locJobs } = await supabase
              .from("jobs")
              .select("city, state")
              .in("status", ["active", "published"])
              .not("city", "is", null)
              .not("state", "is", null)
              .limit(5000);
            const citySlugs = new Set<string>();
            (locJobs ?? []).forEach((row: { city: string | null; state: string | null }) => {
              const city = (row.city ?? "").trim();
              const state = (row.state ?? "").trim();
              if (!city || !state) return;
              const c = city
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-");
              citySlugs.add(`${c}-${state.toLowerCase()}`);
            });
            citySlugs.forEach((slug) => {
              entries.push({
                path: `/warehouse-jobs/${slug}`,
                changefreq: "daily",
                priority: "0.8",
              });
            });
          }
        } catch {
          // Best-effort; still return static entries
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
