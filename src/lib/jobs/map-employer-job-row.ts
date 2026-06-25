import type { Job } from "@/lib/api/contracts/jobs";

/** Maps full Nest `Job` → employer dashboard table row. */
export function mapJobToEmployerRow(
  job: Job,
  extras: { companyId: string; postedBy?: string | null; applicantCount?: number },
) {
  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    status: job.status,
    views: job.views,
    featured: job.featured,
    posted_at: job.postedAt ?? job.createdAt,
    expires_at: job.expiresAt ?? null,
    created_at: job.createdAt,
    category: job.category,
    shift: job.shift,
    employment_type: job.employmentType,
    pay_min: job.payMin ?? null,
    pay_max: job.payMax ?? null,
    pay_period: job.payPeriod ?? null,
    location: job.location,
    city: job.city,
    state: job.state,
    zip: job.zip ?? null,
    description: job.description,
    requirements: job.requirements ?? null,
    company_id: extras.companyId,
    posted_by: extras.postedBy ?? null,
    applicant_count: extras.applicantCount ?? 0,
    source_type: job.sourceType,
  };
}

export type EmployerJobRow = ReturnType<typeof mapJobToEmployerRow>;
