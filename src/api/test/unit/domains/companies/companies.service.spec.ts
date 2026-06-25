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
    };
    companyPackage: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      company: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      companyPackage: { findFirst: jest.fn() },
      $queryRaw: jest.fn(),
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
});
