import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BODY = `# WarehouseJobs

> WarehouseJobs (warehousejobs.com) is a U.S. job board dedicated to warehouse and logistics work: forklift operators, pickers/packers, shipping & receiving, order selectors, inventory clerks, and warehouse associates. Free for job seekers; employers pay to post.

## Key pages

- [Job search](https://warehousejobs.com/jobs): search all active warehouse jobs by keyword, location, shift, and pay
- [Forklift Operator jobs](https://warehousejobs.com/jobs/category/forklift-operator)
- [Picker / Packer jobs](https://warehousejobs.com/jobs/category/picker-packer)
- [Shipping & Receiving jobs](https://warehousejobs.com/jobs/category/shipping-receiving)
- [Pricing for employers](https://warehousejobs.com/pricing)
- [FAQ](https://warehousejobs.com/faq)

## Data

- [Sitemap](https://warehousejobs.com/sitemap.xml): all pages including every active job listing
- [Job feed](https://warehousejobs.com/jobs.json): machine-readable JSON of active listings
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(BODY, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
