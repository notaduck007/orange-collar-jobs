/** Default CMS copy when Supabase `site_pages` / Nest content API is unavailable. */

export type DefaultFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const DEFAULT_FAQ_PAGE = {
  title: "Questions, answered.",
  body: "Everything job seekers and employers ask us most — from applying and alerts to posting packages and account help.",
};

export const DEFAULT_FAQ_ITEMS: DefaultFaqItem[] = [
  {
    id: "apply",
    question: "How do I apply for a warehouse job?",
    answer: `Search by job title, city, or ZIP on [Find Jobs](/jobs), open a listing, and click **Apply**. Most roles can be completed in under a minute on your phone.

Create a free job seeker account to save jobs, track applications, and enable one-click apply when your profile is complete.`,
  },
  {
    id: "cost-seeker",
    question: "Does WarehouseJobs cost anything for job seekers?",
    answer:
      "No. Searching, applying, saving jobs, and setting up job alerts are **always free** for workers.",
  },
  {
    id: "cost-employer",
    question: "How much does it cost to post a job?",
    answer: `Employers pay a **flat rate per posting** — no contracts and no per-applicant fees. Packages include featured placement options for hard-to-fill shifts.

See current pricing on [For Employers](/pricing). Your first post can be used to try the platform before buying additional credits.`,
  },
  {
    id: "alerts",
    question: "How do job alerts work?",
    answer: `Sign up for a free account and create alerts from the job search page or your [seeker dashboard](/seeker/alerts). We email you when new openings match your role, location, and filters.

You can pause, edit, or delete alerts anytime.`,
  },
  {
    id: "roles",
    question: "What kinds of jobs are listed here?",
    answer: `WarehouseJobs focuses on **warehouse and logistics roles**: forklift and reach-truck operators, pickers and packers, shipping and receiving clerks, material handlers, inventory specialists, supervisors, and seasonal peak-season help.

Listings show shift, pay range, certifications, and environment (ambient, cooler, freezer) when employers provide them.`,
  },
  {
    id: "employer-post",
    question: "How do employers post a job?",
    answer: `Create an employer account, complete your company profile, choose a posting package, and publish from [Post a Job](/employer/jobs/new). You can save drafts, add screening questions, and manage applicants from your dashboard.

Need many listings at once? Contact us about **batch ingestion** for feeds and ATS exports.`,
  },
  {
    id: "password",
    question: "I forgot my password — what do I do?",
    answer: `Use **Forgot password?** on the [sign-in page](/auth?mode=login). We'll email a reset link. Check spam if it doesn't arrive within a few minutes, or [contact us](/contact) if you're still stuck.`,
  },
  {
    id: "account-types",
    question: "Can I use one account as both a job seeker and an employer?",
    answer:
      "Accounts are tied to a single role at sign-up (job seeker or employer). If you need both, use separate email addresses or contact support — we're happy to help you get set up correctly.",
  },
  {
    id: "listing-accuracy",
    question: "A job listing looks wrong or expired — what should I do?",
    answer: `Use the **Report** button on the job detail page, or [contact us](/contact) with the job link. Employers are responsible for keeping listings accurate; we review reports and take down closed or misleading posts.`,
  },
  {
    id: "support",
    question: "How do I reach the WarehouseJobs team?",
    answer: `Use the form on our [Contact](/contact) page. We typically respond within one business day. For employer sales and batch feeds, choose **Employer / sales** as the topic.`,
  },
];

export const DEFAULT_ABOUT_PAGE = {
  title: "About WarehouseJobs",
  meta_description:
    "WarehouseJobs is a job board dedicated to warehouse and logistics work — forklift, picking, packing, shipping and receiving roles across the U.S.",
  body: `WarehouseJobs.com is a job board built for **warehouse and logistics work** — the roles that keep freight moving: forklift operators, pickers and packers, shipping and receiving clerks, material handlers, and site leads.

We started with a simple idea: hiring for the dock floor should be as fast and honest as the work itself. Job seekers shouldn't wade through generic listings meant for office jobs. Employers shouldn't pay enterprise prices to reach people who already know what a reach truck is.

## What we do

- **For job seekers** — Search by role, shift, and location. Apply in minutes on mobile. Job alerts when new openings match your criteria. Always free.
- **For employers** — Post openings, manage applicants, and reach workers who understand warehouse operations. Flat, transparent pricing without long-term contracts.

## Who we serve

We focus on **distribution centers, 3PLs, e-commerce fulfillment, cold storage, and manufacturing warehouses** across the United States. Whether you're hiring one forklift driver or ingesting hundreds of roles from a feed, the platform is built for high-volume, high-turnover hiring.

## Our commitment

We believe stable warehouse work changes families and communities. We're building tools that respect workers' time and help employers fill shifts faster — with clear pay, shift, and certification information on every listing.

Questions? Visit [Contact](/contact) or browse open roles on [Find Jobs](/jobs).`,
};
