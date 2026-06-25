import type { Job } from "../../../../src/core/database/prisma-client.js";
import {
  toJobDetail,
  toJobResponse,
  toJobSummary,
} from "@domains/jobs/job.mapper";

const baseJob: Job = {
  id: "job-1",
  companyId: "co-1",
  companyPackageId: null,
  title: "Forklift Operator",
  slug: "forklift-dallas-tx",
  category: "Forklift",
  categorySlug: "forklift",
  location: "Dallas, TX",
  city: "Dallas",
  state: "TX",
  zip: "75201",
  lat: 32.78,
  lng: -96.8,
  employmentType: "full_time",
  shift: "first",
  payMin: 18,
  payMax: 22,
  payPeriod: "hour",
  description: "Warehouse job description long enough.",
  requirements: "1 year experience",
  temperatureEnv: "ambient",
  certificationsRequired: ["forklift"],
  liftRequirementLbs: 50,
  overtimeAvailable: true,
  weeklyPay: true,
  quickHire: false,
  featured: true,
  featuredUntil: null,
  status: "published",
  sourceType: "direct",
  externalId: null,
  sourceUrl: null,
  views: 5,
  postedAt: new Date("2026-01-15T12:00:00Z"),
  expiresAt: null,
  createdAt: new Date("2026-01-01T12:00:00Z"),
  updatedAt: new Date("2026-01-01T12:00:00Z"),
};

describe("jobs types mappers", () => {
  it("toJobResponse maps company summary", () => {
    const res = toJobResponse({
      ...baseJob,
      company: {
        id: "co-1",
        name: "Acme",
        slug: "acme",
        verified: true,
        logoUrl: "https://logo.png",
      },
    });
    expect(res.company).toEqual({
      id: "co-1",
      name: "Acme",
      slug: "acme",
      verified: true,
      logoUrl: "https://logo.png",
    });
    expect(res.postedAt).toBe(baseJob.postedAt?.toISOString());
  });

  it("toJobResponse uses createdAt when postedAt is null", () => {
    const createdAt = new Date("2026-02-01T08:00:00Z");
    const res = toJobResponse({
      ...baseJob,
      postedAt: null,
      createdAt,
      company: null,
      featuredUntil: new Date("2026-03-01T00:00:00Z"),
      expiresAt: new Date("2026-12-31T00:00:00Z"),
    });
    expect(res.postedAt).toBe(createdAt.toISOString());
    expect(res.company).toBeNull();
    expect(res.featuredUntil).toBe("2026-03-01T00:00:00.000Z");
    expect(res.expiresAt).toBe("2026-12-31T00:00:00.000Z");
  });

  it("toJobSummary includes company name when present", () => {
    const res = toJobSummary({
      ...baseJob,
      postedAt: null,
      company: { id: "co-1", name: "Acme", slug: "acme", verified: true, logoUrl: null },
    });
    expect(res.company).toEqual({ name: "Acme", slug: "acme", verified: true });
    expect(res.postedAt).toBe(baseJob.createdAt.toISOString());
  });

  it("toJobSummary returns null company when absent", () => {
    const res = toJobSummary({ ...baseJob, company: null });
    expect(res.company).toBeNull();
  });

  it("toJobDetail maps screening questions and interview slots", () => {
    const detail = toJobDetail(
      {
        ...baseJob,
        company: { id: "co-1", name: "Acme", slug: "acme", verified: false, logoUrl: null },
        screeningQuestions: [
          {
            id: "q-1",
            jobId: "job-1",
            prompt: "Certified?",
            type: "yes_no",
            options: [],
            required: true,
            sortOrder: 1,
          },
        ],
      },
      [{ id: "s-1", startsAt: "2026-07-01T10:00:00Z", capacity: 2, remaining: 1 }],
    );
    expect(detail.screeningQuestions[0].prompt).toBe("Certified?");
    expect(detail.interviewSlots[0].remaining).toBe(1);
  });

  it("toJobDetail defaults screening questions to empty array", () => {
    const detail = toJobDetail({
      ...baseJob,
      company: null,
    });
    expect(detail.screeningQuestions).toEqual([]);
    expect(detail.interviewSlots).toEqual([]);
  });
});
