import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://warehousejobs.com";
const API_BASE = process.env.API_URL ?? "http://localhost:3001";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  head: () => ({ meta: [{ title: "Sitemap" }] }),
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
          const res = await fetch(`${API_BASE}/api/v1/jobs?status=published&pageSize=1000&page=1`);
          if (res.ok) {
            const body = (await res.json()) as {
              data?: { slug: string; updatedAt?: string; companySlug?: string }[];
            };
            const companySlugs = new Set<string>();
            for (const job of body.data ?? []) {
              entries.push({
                path: `/jobs/${job.slug}`,
                lastmod: job.updatedAt?.slice(0, 10),
                changefreq: "daily",
                priority: "0.8",
              });
              if (job.companySlug) companySlugs.add(job.companySlug);
            }
            companySlugs.forEach((slug) => {
              entries.push({ path: `/companies/${slug}`, changefreq: "weekly", priority: "0.6" });
            });
          }
        } catch {
          // best-effort; static entries still returned
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
