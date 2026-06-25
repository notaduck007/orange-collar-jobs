import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CompaniesController } from "../../../../src/domains/companies/companies.controller.js";
import { CompaniesService } from "../../../../src/domains/companies/companies.service.js";
import type { AuthUser } from "../../../../src/core/auth/jwt.strategy.js";

const OWNER_ID = "owner-uuid-1";
const COMPANY_ID = "company-uuid-1";

function makeUser(): AuthUser {
  return { id: OWNER_ID, email: "owner@test.com", role: "vendor" };
}

function makeCompany() {
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
  };
}

describe("CompaniesController", () => {
  let controller: CompaniesController;
  let serviceMock: jest.Mocked<Pick<CompaniesService, "findByOwner" | "create" | "update">>;

  beforeEach(async () => {
    serviceMock = {
      findByOwner: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [CompaniesController],
      providers: [{ provide: CompaniesService, useValue: serviceMock }],
    }).compile();

    controller = module.get(CompaniesController);
  });

  describe("getMyCompany", () => {
    it("returns company when found", async () => {
      serviceMock.findByOwner.mockResolvedValue(makeCompany());
      const result = await controller.getMyCompany(makeUser());
      expect(result).toMatchObject({ id: COMPANY_ID });
    });

    it("throws NotFoundException when no company exists", async () => {
      serviceMock.findByOwner.mockResolvedValue(null);
      await expect(controller.getMyCompany(makeUser())).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("delegates to service and returns created company", async () => {
      serviceMock.create.mockResolvedValue(makeCompany());
      const dto = { name: "Acme Corp", industry: "Logistics", hqCity: "Dallas", hqState: "TX" };
      const result = await controller.create(dto as never, makeUser());
      expect(serviceMock.create).toHaveBeenCalledWith(OWNER_ID, dto);
      expect(result).toMatchObject({ id: COMPANY_ID });
    });
  });

  describe("update", () => {
    it("delegates to service and returns updated company", async () => {
      serviceMock.update.mockResolvedValue(makeCompany());
      const dto = { name: "Acme Corp", industry: "Logistics", hqCity: "Dallas", hqState: "TX" };
      const result = await controller.update(COMPANY_ID, dto as never, makeUser());
      expect(serviceMock.update).toHaveBeenCalledWith(OWNER_ID, COMPANY_ID, dto);
      expect(result).toMatchObject({ id: COMPANY_ID });
    });
  });
});
