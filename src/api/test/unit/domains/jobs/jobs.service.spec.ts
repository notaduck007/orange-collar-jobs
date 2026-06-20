import type { Job, UserRole } from "../../../../src/core/database/prisma-client.js";
import { JobsService } from "@domains/jobs/jobs.service";
import type { PrismaService } from "@core/database/prisma.service";
import type { AuthUser } from "@core/auth/jwt.strategy";
import { BadRequestError, ForbiddenError, NotFoundError } from "@core/error/errors";
import { JOB_CREATE_BODY } from "../../../helpers/jobs.fixtures";

const companyRow = {
  id: "co-1",
  name: "Co",
  slug: "co",
  verified: true,
  logoUrl: null,
};

const baseJob: Job = {
  id: "job-1",
  companyId: "co-1",
  companyPackageId: "pkg-1",
  title: JOB_CREATE_BODY.title,
  slug: "reach-truck-operator-2nd-shift-dallas-tx",
  category: JOB_CREATE_BODY.category,
  categorySlug: "forklift-operator",
  location: JOB_CREATE_BODY.location,
  city: JOB_CREATE_BODY.city,
  state: JOB_CREATE_BODY.state,
  zip: JOB_CREATE_BODY.zip,
  lat: null,
  lng: null,
  employmentType: JOB_CREATE_BODY.employmentType,
  shift: JOB_CREATE_BODY.shift,
  payMin: JOB_CREATE_BODY.payMin,
  payMax: JOB_CREATE_BODY.payMax,
  payPeriod: JOB_CREATE_BODY.payPeriod,
  description: JOB_CREATE_BODY.description,
  requirements: JOB_CREATE_BODY.requirements,
  temperatureEnv: null,
  certificationsRequired: [],
  liftRequirementLbs: null,
  overtimeAvailable: true,
  weeklyPay: true,
  quickHire: false,
  featured: false,
  featuredUntil: null,
  status: "published",
  sourceType: "direct",
  externalId: null,
  sourceUrl: null,
  views: 0,
  postedAt: new Date("2026-01-01"),
  expiresAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function authUser(role: UserRole, id = "user-1"): AuthUser {
  return { id, email: "u@test.com", role };
}

function makePrisma(): PrismaService {
  return {
    job: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn(),
    },
    companyPackage: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
}

describe("JobsService", () => {
  let prisma: PrismaService;
  let svc: JobsService;

  beforeEach(() => {
    prisma = makePrisma();
    svc = new JobsService(prisma);
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("admin creates job with published status when companyId provided", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.job.create as jest.Mock).mockResolvedValue({ ...baseJob, company: companyRow });

      const result = await svc.create(
        { ...JOB_CREATE_BODY, companyId: "co-1", companyPackageId: "pkg-1" },
        authUser("admin"),
      );

      expect(result.id).toBe("job-1");
      expect(prisma.job.create).toHaveBeenCalled();
    });

    it("admin without companyId throws BadRequestError", async () => {
      await expect(svc.create(JOB_CREATE_BODY, authUser("admin"))).rejects.toBeInstanceOf(
        BadRequestError,
      );
    });

    it("seeker cannot create jobs", async () => {
      await expect(
        svc.create({ ...JOB_CREATE_BODY, companyId: "co-1" }, authUser("seeker")),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("vendor without company profile throws BadRequestError", async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        svc.create({ ...JOB_CREATE_BODY, companyPackageId: "pkg-1" }, authUser("vendor")),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("vendor without companyPackageId throws BadRequestError", async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({ id: "co-1", ownerId: "user-1" });
      await expect(svc.create(JOB_CREATE_BODY, authUser("vendor"))).rejects.toBeInstanceOf(
        BadRequestError,
      );
    });

    it("vendor with invalid package throws BadRequestError", async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({ id: "co-1", ownerId: "user-1" });
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(prisma));
      (prisma.companyPackage.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        svc.create({ ...JOB_CREATE_BODY, companyPackageId: "pkg-1" }, authUser("vendor")),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("vendor with insufficient credits throws BadRequestError", async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({ id: "co-1", ownerId: "user-1" });
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(prisma));
      (prisma.companyPackage.findFirst as jest.Mock).mockResolvedValue({
        id: "pkg-1",
        companyId: "co-1",
        totalCredits: 5,
        usedCredits: 5,
        expiresAt: null,
      });

      await expect(
        svc.create({ ...JOB_CREATE_BODY, companyPackageId: "pkg-1" }, authUser("vendor")),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("vendor with expired package throws BadRequestError", async () => {
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({ id: "co-1", ownerId: "user-1" });
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(prisma));
      (prisma.companyPackage.findFirst as jest.Mock).mockResolvedValue({
        id: "pkg-1",
        companyId: "co-1",
        totalCredits: 10,
        usedCredits: 0,
        expiresAt: new Date("2020-01-01"),
      });

      await expect(
        svc.create({ ...JOB_CREATE_BODY, companyPackageId: "pkg-1" }, authUser("vendor")),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("vendor creates job and decrements package credit", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({ id: "co-1", ownerId: "user-1" });
      (prisma.$transaction as jest.Mock).mockImplementation(async (fn) => fn(prisma));
      (prisma.companyPackage.findFirst as jest.Mock).mockResolvedValue({
        id: "pkg-1",
        companyId: "co-1",
        totalCredits: 10,
        usedCredits: 2,
        expiresAt: null,
      });
      (prisma.companyPackage.update as jest.Mock).mockResolvedValue({});
      (prisma.job.create as jest.Mock).mockResolvedValue({ ...baseJob, company: companyRow });

      const result = await svc.create(
        {
          ...JOB_CREATE_BODY,
          companyPackageId: "pkg-1",
          screeningQuestions: [
            {
              prompt: "Certified?",
              type: "yes_no",
              required: true,
              sortOrder: 1,
              options: ["yes"],
            },
          ],
        },
        authUser("vendor"),
      );

      expect(result.id).toBe("job-1");
      expect(prisma.companyPackage.update).toHaveBeenCalled();
    });

    it("admin creates draft job without postedAt", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.job.create as jest.Mock).mockResolvedValue({
        ...baseJob,
        status: "draft",
        postedAt: null,
        company: companyRow,
      });

      await svc.create(
        { ...JOB_CREATE_BODY, companyId: "co-1", status: "draft" },
        authUser("admin"),
      );

      const createArg = (prisma.job.create as jest.Mock).mock.calls[0][0];
      expect(createArg.data.postedAt).toBeNull();
    });

    it("generates unique slug when base slug collides", async () => {
      (prisma.job.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: "existing" })
        .mockResolvedValueOnce(null);
      (prisma.job.create as jest.Mock).mockResolvedValue({ ...baseJob, company: companyRow });

      await svc.create({ ...JOB_CREATE_BODY, companyId: "co-1" }, authUser("admin"));

      const createArg = (prisma.job.create as jest.Mock).mock.calls[0][0];
      expect(createArg.data.slug).toContain("-2");
    });
  });

  describe("search", () => {
    it("ranks direct jobs above scraped at same recency", async () => {
      const scraped: Job = {
        ...baseJob,
        id: "scraped",
        slug: "scraped-job",
        sourceType: "scraped",
        featured: false,
        postedAt: new Date("2026-06-01"),
      };
      const direct: Job = {
        ...baseJob,
        id: "direct",
        slug: "direct-job",
        sourceType: "direct",
        featured: false,
        postedAt: new Date("2026-06-01"),
      };
      (prisma.job.findMany as jest.Mock).mockResolvedValue([
        { ...scraped, company: null },
        { ...direct, company: null },
      ]);

      const result = await svc.search({ page: 1, pageSize: 10 });
      expect(result.data[0].id).toBe("direct");
      expect(result.data[1].id).toBe("scraped");
    });

    it("featured jobs rank first", async () => {
      const plain: Job = { ...baseJob, id: "plain", featured: false, sourceType: "direct" };
      const featured: Job = { ...baseJob, id: "feat", featured: true, sourceType: "scraped" };
      (prisma.job.findMany as jest.Mock).mockResolvedValue([
        { ...plain, company: null },
        { ...featured, company: null },
      ]);

      const result = await svc.search({ page: 1, pageSize: 10 });
      expect(result.data[0].id).toBe("feat");
    });

    it("applies search filters and paginates", async () => {
      const jobs = Array.from({ length: 25 }, (_, i) => ({
        ...baseJob,
        id: `job-${i}`,
        slug: `job-${i}`,
        company: companyRow,
      }));
      (prisma.job.findMany as jest.Mock).mockResolvedValue(jobs);

      const result = await svc.search({
        page: 2,
        pageSize: 10,
        q: "reach",
        category: "Forklift Operator",
        city: "Dallas",
        state: "tx",
        zip: "75201",
        shift: "second",
        employmentType: "full_time",
        payMin: 15,
        featured: true,
        quickHire: false,
        temperatureEnv: "freezer",
      });

      expect(result.meta.page).toBe(2);
      expect(result.meta.total).toBe(25);
      expect(result.data.length).toBe(10);
      const where = (prisma.job.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.categorySlug).toBe("forklift-operator");
    });

    it("sorts by createdAt when postedAt is null", async () => {
      const older: Job = {
        ...baseJob,
        id: "older",
        postedAt: null,
        createdAt: new Date("2026-01-01"),
        featured: false,
        sourceType: "direct",
      };
      const newer: Job = {
        ...baseJob,
        id: "newer",
        postedAt: null,
        createdAt: new Date("2026-06-01"),
        featured: false,
        sourceType: "direct",
      };
      (prisma.job.findMany as jest.Mock).mockResolvedValue([
        { ...older, company: null },
        { ...newer, company: null },
      ]);

      const result = await svc.search({ page: 1, pageSize: 10 });
      expect(result.data[0].id).toBe("newer");
      expect(result.data[1].id).toBe("older");
    });
  });

  describe("findBySlug", () => {
    it("throws NotFoundError when job missing", async () => {
      (prisma.job.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(svc.findBySlug("missing")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("returns detail and increments views", async () => {
      const slot = {
        id: "slot-1",
        startsAt: new Date("2026-07-01T10:00:00Z"),
        maxBookings: 3,
        bookedCount: 1,
      };
      (prisma.job.findFirst as jest.Mock).mockResolvedValue({
        ...baseJob,
        quickHire: true,
        company: companyRow,
        screeningQuestions: [
          {
            id: "q-1",
            prompt: "Cert?",
            type: "yes_no",
            options: [],
            required: true,
            sortOrder: 1,
          },
        ],
        interviewSlots: [slot],
      });
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      const detail = await svc.findBySlug(baseJob.slug);
      expect(detail.views).toBe(1);
      expect(detail.screeningQuestions.length).toBe(1);
      expect(detail.interviewSlots[0].remaining).toBe(2);
    });

    it("omits interview slots when not quickHire", async () => {
      (prisma.job.findFirst as jest.Mock).mockResolvedValue({
        ...baseJob,
        quickHire: false,
        company: companyRow,
        screeningQuestions: [],
        interviewSlots: [],
      });
      (prisma.job.update as jest.Mock).mockResolvedValue({});

      const detail = await svc.findBySlug(baseJob.slug);
      expect(detail.interviewSlots).toEqual([]);
    });
  });

  describe("update", () => {
    it("admin updates job and sets postedAt when publishing", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        ...baseJob,
        status: "draft",
        postedAt: null,
        company: companyRow,
      });
      (prisma.job.update as jest.Mock).mockResolvedValue({
        ...baseJob,
        status: "published",
        featured: true,
        company: companyRow,
      });

      const result = await svc.update(
        "job-1",
        {
          status: "published",
          featured: true,
          payMin: 20,
          payMax: 25,
          quickHire: true,
          weeklyPay: false,
          overtimeAvailable: true,
          description: "Updated description long enough for validation.",
          requirements: "Updated reqs",
          title: "New title",
        },
        authUser("admin"),
      );

      expect(result.featured).toBe(true);
      expect(prisma.job.update).toHaveBeenCalled();
    });

    it("updates featuredUntil and expiresAt", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        ...baseJob,
        company: companyRow,
      });
      (prisma.job.update as jest.Mock).mockResolvedValue({
        ...baseJob,
        featuredUntil: new Date("2026-08-01"),
        expiresAt: new Date("2026-12-01"),
        company: companyRow,
      });

      await svc.update(
        "job-1",
        {
          featuredUntil: new Date("2026-08-01"),
          expiresAt: new Date("2026-12-01"),
        },
        authUser("admin"),
      );

      const updateArg = (prisma.job.update as jest.Mock).mock.calls[0][0];
      expect(updateArg.data.featuredUntil).toEqual(new Date("2026-08-01"));
      expect(updateArg.data.expiresAt).toEqual(new Date("2026-12-01"));
    });

    it("throws NotFoundError when job missing", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.update("missing", {}, authUser("admin"))).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("vendor cannot update another company job", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({ ...baseJob, companyId: "other-co" });
      (prisma.company.findUnique as jest.Mock).mockResolvedValue({ id: "co-1", ownerId: "user-1" });

      await expect(svc.update("job-1", {}, authUser("vendor"))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });
  });

  describe("softDelete", () => {
    it("seeker cannot close jobs", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(baseJob);
      await expect(svc.softDelete("job-1", authUser("seeker"))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it("admin closes job", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(baseJob);
      (prisma.job.update as jest.Mock).mockResolvedValue({ ...baseJob, status: "closed" });

      await svc.softDelete("job-1", authUser("admin"));
      expect(prisma.job.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "closed" } }),
      );
    });

    it("throws NotFoundError when job missing", async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc.softDelete("missing", authUser("admin"))).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });
});
