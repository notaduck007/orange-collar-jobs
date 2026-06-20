import { resolve } from "node:path";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../core/database/prisma.service.js";
import { AppModule } from "../../app.module.js";
import { ApiContractService } from "./api-contract.service.js";
import { OpenApiSpecLoader } from "./openapi-spec.loader.js";
import type { ContractDriftReport } from "./types.js";

const DEFAULT_SPEC_PATH = resolve(process.cwd(), "../../docs/api/openapi.yaml");

function ensureGuardEnv(): void {
  process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
  process.env.PORT = process.env.PORT ?? "3001";
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:8080";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ??
    "postgresql://contract_guard:contract_guard@localhost:5432/contract_guard";
  process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? "contract_guard_jwt_secret_min_32_chars";
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? "contract_guard_refresh_secret_min_32";
  process.env.STORAGE_ENDPOINT = process.env.STORAGE_ENDPOINT ?? "http://localhost:9000";
  process.env.STORAGE_ACCESS_KEY = process.env.STORAGE_ACCESS_KEY ?? "minio";
  process.env.STORAGE_SECRET_KEY = process.env.STORAGE_SECRET_KEY ?? "minio123";
  process.env.EMAIL_API_KEY = process.env.EMAIL_API_KEY ?? "re_contract_guard_key";
  process.env.EMAIL_FROM = process.env.EMAIL_FROM ?? "noreply@warehousejobs.test";
  process.env.API_KEY_HASH = process.env.API_KEY_HASH ?? "contract_guard_api_key_hash";
}

async function buildContext(): Promise<TestingModule> {
  const prismaStub = {
    $connect: async (): Promise<void> => undefined,
    $disconnect: async (): Promise<void> => undefined,
    $transaction: async (fn: (tx: unknown) => unknown): Promise<unknown> => fn(prismaStub),
  };

  return Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaStub)
    .compile();
}

export async function detectContractDrift(
  absoluteSpecPath = DEFAULT_SPEC_PATH,
): Promise<ContractDriftReport> {
  ensureGuardEnv();
  const moduleRef = await buildContext();
  try {
    const contract = moduleRef.get(ApiContractService, { strict: false });
    const loader = moduleRef.get(OpenApiSpecLoader, { strict: false });
    const codeSurface = contract.extractRouteSurface();
    const specSurface = loader.loadFromFile(absoluteSpecPath, { implementedOnly: true });
    return contract.diff(codeSurface, specSurface);
  } finally {
    await moduleRef.close();
  }
}
