import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CompaniesService } from "../../../../src/domains/companies/companies.service.js";
import { PrismaService } from "../../../../src/core/database/prisma.service.js";
import type { UpsertCompanyDto } from "../../../../src/domains/companies/dto/upsert-company.dto.js";

const OWNER_ID = "owner-uuid-1";
const COMPANY_ID = "company-uuid-1";

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPANY_ID,
    ownerId: OWNER_ID,
    name: "Acme Corp",
    slug: "acme-corp",
    description: null,
    website: null,
    logoUrl: null,
    industry: "Logistics",
    hqCity: "Dallas",
    hqState: "TX",
    location: "Dallas, TX",
    verified: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeDto(overrides: Partial<UpsertCompanyDto> = {}): UpsertCompanyDto {
  return {
    name: "Acme Corp",
    industry: "Logistics",
    hqCity: "Dallas",
    hqState: "TX",
    ...overrides,
  };
}

describe("CompaniesService", () => {
  let service: CompaniesService;
  let prismaMock: {
    company: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
      findMany: jest.Mock;
    };
    companyPackage: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      company: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      companyPackage: { findFirst: jest.fn() },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $transaction: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(CompaniesService);
  });

  describe("findByOwner", () => {
    it("returns the company when found", async () => {
      prismaMock.company.findUnique.mockResolvedValue(makeCompany());
      const result = await service.findByOwner(OWNER_ID);
      expect(result?.id).toBe(COMPANY_ID);
    });

    it("returns null when not found", async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);
      const result = await service.findByOwner(OWNER_ID);
      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("creates a company and returns it", async () => {
      prismaMock.company.findUnique.mockResolvedValueOnce(null); // no existing
      prismaMock.company.findUnique.mockResolvedValueOnce(null); // slug check
      prismaMock.company.create.mockResolvedValue(makeCompany());
      prismaMock.companyPackage.findFirst.mockResolvedValue(null);
      prismaMock.$queryRaw.mockResolvedValue([]); // no starter package found → warn + skip

      const result = await service.create(OWNER_ID, makeDto());
      expect(result.id).toBe(COMPANY_ID);
      expect(prismaMock.company.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerId: OWNER_ID, name: "Acme Corp" }),
        }),
      );
    });

    it("throws ConflictException if owner already has a company", async () => {
      prismaMock.company.findUnique.mockResolvedValue(makeCompany());
      await expect(service.create(OWNER_ID, makeDto())).rejects.toThrow(ConflictException);
    });

    it("appends random suffix when slug is taken", async () => {
      prismaMock.company.findUnique
        .mockResolvedValueOnce(null)       // no existing owner
        .mockResolvedValueOnce(makeCompany()) // slug "acme-corp" taken
        .mockResolvedValueOnce(null);      // slug "acme-corp-xxxx" free
      prismaMock.company.create.mockResolvedValue(makeCompany({ slug: "acme-corp-ab12" }));
      prismaMock.companyPackage.findFirst.mockResolvedValue(null);
      prismaMock.$queryRaw.mockResolvedValue([]);

      const result = await service.create(OWNER_ID, makeDto());
      const createCall = prismaMock.company.create.mock.calls[0][0];
      expect(createCall.data.slug).toMatch(/^acme-corp-[0-9a-f]{4}$/);
      expect(result).toBeDefined();
    });
  });

  describe("update", () => {
    it("updates and returns the company", async () => {
      prismaMock.company.findUnique.mockResolvedValue(makeCompany());
      prismaMock.company.update.mockResolvedValue(makeCompany({ name: "New Name" }));

      const result = await service.update(OWNER_ID, COMPANY_ID, makeDto({ name: "New Name" }));
      expect(result.name).toBe("New Name");
    });

    it("throws NotFoundException when company not found", async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);
      await expect(service.update(OWNER_ID, COMPANY_ID, makeDto())).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ForbiddenException when requester is not the owner", async () => {
      prismaMock.company.findUnique.mockResolvedValue(makeCompany({ ownerId: "other-user" }));
      await expect(service.update(OWNER_ID, COMPANY_ID, makeDto())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("adminList", () => {
    it("returns paginated companies with meta", async () => {
      const companies = [makeCompany(), makeCompany({ id: "company-uuid-2" })];
      prismaMock.company.count.mockResolvedValue(2);
      prismaMock.company.findMany.mockResolvedValue(companies);

      const result = await service.adminList({ page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it("applies name search filter when q is provided", async () => {
      prismaMock.company.count.mockResolvedValue(1);
      prismaMock.company.findMany.mockResolvedValue([makeCompany()]);

      await service.adminList({ q: "acme", page: 1, pageSize: 10 });

      expect(prismaMock.company.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ name: { contains: "acme", mode: "insensitive" } }),
        }),
      );
    });

    it("applies verificationStatus filter", async () => {
      prismaMock.company.count.mockResolvedValue(0);
      prismaMock.company.findMany.mockResolvedValue([]);

      await service.adminList({ verificationStatus: "pending", page: 1, pageSize: 10 });

      expect(prismaMock.company.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ verificationStatus: "pending" }) }),
      );
    });

    it("applies status filter", async () => {
      prismaMock.company.count.mockResolvedValue(0);
      prismaMock.company.findMany.mockResolvedValue([]);

      await service.adminList({ status: "active", page: 1, pageSize: 10 });

      expect(prismaMock.company.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: "active" }) }),
      );
    });

    it("computes correct totalPages for partial last page", async () => {
      prismaMock.company.count.mockResolvedValue(25);
      prismaMock.company.findMany.mockResolvedValue([]);

      const result = await service.adminList({ page: 3, pageSize: 10 });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe("adminUpdate", () => {
    it("returns null when company not found", async () => {
      prismaMock.company.findUnique.mockResolvedValue(null);

      const result = await service.adminUpdate(COMPANY_ID, "admin-1", { status: "active" });

      expect(result).toBeNull();
      expect(prismaMock.company.update).not.toHaveBeenCalled();
    });

    it("updates status and returns the company", async () => {
      prismaMock.company.findUnique.mockResolvedValue(makeCompany());
      prismaMock.company.update.mockResolvedValue(makeCompany({ status: "suspended" }));

      const result = await service.adminUpdate(COMPANY_ID, "admin-1", { status: "suspended" });

      expect(prismaMock.company.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "suspended" }) }),
      );
      expect(result).toBeDefined();
    });

    it("sets verifiedAt and verifiedBy when approving (verificationStatus=verified + verified=true)", async () => {
      prismaMock.company.findUnique.mockResolvedValue(makeCompany());
      prismaMock.company.update.mockResolvedValue(makeCompany({ verified: true }));

      await service.adminUpdate(COMPANY_ID, "admin-uuid", {
        verified: true,
        verificationStatus: "verified",
      });

      const updateData = prismaMock.company.update.mock.calls[0][0].data as Record<string, unknown>;
      expect(updateData.verifiedBy).toBe("admin-uuid");
      expect(updateData.verifiedAt).toBeInstanceOf(Date);
    });

    it("sets verifiedAt to null when rejecting (verificationStatus=rejected)", async () => {
      prismaMock.company.findUnique.mockResolvedValue(makeCompany());
      prismaMock.company.update.mockResolvedValue(makeCompany());

      await service.adminUpdate(COMPANY_ID, "admin-uuid", { verificationStatus: "rejected" });

      const updateData = prismaMock.company.update.mock.calls[0][0].data as Record<string, unknown>;
      expect(updateData.verifiedAt).toBeNull();
      expect(updateData.verifiedBy).toBe("admin-uuid");
    });

    it("does not set verifiedAt/verifiedBy for a plain status-only patch", async () => {
      prismaMock.company.findUnique.mockResolvedValue(makeCompany());
      prismaMock.company.update.mockResolvedValue(makeCompany());

      await service.adminUpdate(COMPANY_ID, "admin-1", { verificationNote: "looks good" });

      const updateData = prismaMock.company.update.mock.calls[0][0].data as Record<string, unknown>;
      expect(updateData.verifiedAt).toBeUndefined();
      expect(updateData.verifiedBy).toBeUndefined();
    });
  });

  describe("grantStarterPackage (via create)", () => {
    it("skips grant when company already has a package", async () => {
      prismaMock.company.findUnique
        .mockResolvedValueOnce(null)   // no existing owner
        .mockResolvedValueOnce(null);  // slug check
      prismaMock.company.create.mockResolvedValue(makeCompany());
      prismaMock.companyPackage.findFirst.mockResolvedValue({ id: "pkg-1" }); // already has package

      await service.create(OWNER_ID, makeDto());

      expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("executes transaction when starter package exists", async () => {
      prismaMock.company.findUnique
        .mockResolvedValueOnce(null)  // no existing owner
        .mockResolvedValueOnce(null); // slug check
      prismaMock.company.create.mockResolvedValue(makeCompany());
      prismaMock.companyPackage.findFirst.mockResolvedValue(null); // no existing package
      // SELECT starter package → found
      prismaMock.$queryRaw.mockResolvedValueOnce([
        { id: "starter-pkg-1", posting_count: 3, featured_count: 1 },
      ]);
      // Simulate $transaction by invoking the callback with a tx proxy
      const txMock = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: "order-uuid-1" }]),
        $executeRaw: jest.fn().mockResolvedValue(1),
      };
      prismaMock.$transaction.mockImplementation(
        async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock),
      );

      await service.create(OWNER_ID, makeDto());

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(txMock.$queryRaw).toHaveBeenCalled(); // INSERT orders
      expect(txMock.$executeRaw).toHaveBeenCalled(); // INSERT company_packages
    });
  });
});
