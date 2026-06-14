import { Test } from "@nestjs/testing";
import { PrismaService } from "@core/database/prisma.service";

describe("PrismaService", () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get(PrismaService);
  });

  it("is defined", () => {
    expect(service).toBeDefined();
  });

  it("exposes $connect and $disconnect", () => {
    expect(typeof service.$connect).toBe("function");
    expect(typeof service.$disconnect).toBe("function");
  });

  it("connects on module init", async () => {
    const connect = jest.spyOn(service, "$connect").mockResolvedValue(undefined);
    await service.onModuleInit();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("disconnects on module destroy", async () => {
    const disconnect = jest.spyOn(service, "$disconnect").mockResolvedValue(undefined);
    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
