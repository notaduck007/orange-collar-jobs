import { createHash } from "node:crypto";
import type { PrismaService } from "../../src/core/database/prisma.service.js";
import type { BatchJobItemDto } from "../../src/domains/batch/dto/ingest-batch.dto.js";

/** Plaintext test API key shared across integration and E2E specs. */
export const TEST_API_KEY = "wj-batch-test-api-key-integration";

/** SHA-256 of TEST_API_KEY — stored in api_keys.key_hash. */
export const TEST_API_KEY_HASH = createHash("sha256").update(TEST_API_KEY).digest("hex");

/** Minimal valid BatchJobItemDto for use in tests. */
export const BATCH_JOB_ITEM: BatchJobItemDto = {
  title: "Forklift Operator",
  location: "Dallas, TX",
  city: "Dallas",
  state: "TX",
  employmentType: "full_time",
  shift: "first",
  description: "Operate forklifts in a busy warehouse environment. Safety first.",
  sourceType: "scraped",
};

/** Batch item with a stable externalId for dedup tests. */
export const BATCH_JOB_ITEM_EXT: BatchJobItemDto = {
  ...BATCH_JOB_ITEM,
  externalId: "FIXTURE-EXT-001",
  title: "Reach Truck Operator",
};

/** Build N minimal batch items (each gets a unique externalId). */
export function buildBatchItems(n: number, base?: Partial<BatchJobItemDto>): BatchJobItemDto[] {
  return Array.from({ length: n }, (_, i) => ({
    ...BATCH_JOB_ITEM,
    externalId: `AUTO-${i + 1}`,
    title: `Batch Job ${i + 1}`,
    ...base,
  }));
}

export interface BatchTestCompany {
  companyId: string;
  companyPackageId: string;
}

/** Seed a test company + package + API key scoped to that company. Idempotent. */
export async function seedBatchCompany(prisma: PrismaService): Promise<BatchTestCompany> {
  const admin = await prisma.user.upsert({
    where: { email: "batch-fixture-admin@test.com" },
    create: {
      email: "batch-fixture-admin@test.com",
      passwordHash: "unused",
      role: "admin",
      fullName: "Batch Fixture Admin",
      emailVerifiedAt: new Date(),
    },
    update: {},
  });

  const company = await prisma.company.upsert({
    where: { slug: "batch-fixture-co" },
    create: {
      ownerId: admin.id,
      name: "Batch Fixture Co",
      slug: "batch-fixture-co",
    },
    update: {},
  });

  let pkg = await prisma.companyPackage.findFirst({
    where: { companyId: company.id },
    orderBy: [{ purchasedAt: "asc" }, { id: "asc" }],
  });
  if (!pkg) {
    pkg = await prisma.companyPackage.create({
      data: {
        companyId: company.id,
        name: "Starter Pack",
        totalCredits: 500,
        usedCredits: 0,
      },
    });
  }

  await seedApiKey(prisma, company.id);

  return { companyId: company.id, companyPackageId: pkg.id };
}

/** Seed a test API key row. Idempotent (upsert by keyHash). */
export async function seedApiKey(
  prisma: PrismaService,
  companyId?: string,
  description = "Integration test key",
): Promise<{ id: string; keyHash: string }> {
  return prisma.apiKey.upsert({
    where: { keyHash: TEST_API_KEY_HASH },
    create: { keyHash: TEST_API_KEY_HASH, description, companyId: companyId ?? null },
    update: { companyId: companyId ?? null },
  });
}

/** Remove all batch_jobs rows created during a test run. */
export async function cleanupBatchData(prisma: PrismaService): Promise<void> {
  const fixtureCompany = await prisma.company.findUnique({
    where: { slug: "batch-fixture-co" },
    select: { id: true },
  });

  await prisma.job.deleteMany({
    where: {
      OR: [
        { externalId: { startsWith: "FIXTURE-" } },
        { externalId: { startsWith: "AUTO-" } },
        { externalId: "priority-test-scraped" },
        { title: { startsWith: "Batch Job" } },
        { title: "Forklift Operator" },
        { title: "Reach Truck Operator" },
        { title: { contains: "Priority Test" } },
        ...(fixtureCompany ? [{ companyId: fixtureCompany.id }] : []),
      ],
    },
  });
  await prisma.batchJob.deleteMany({});
  await prisma.company.deleteMany({ where: { name: "Priority Test Co" } });
  if (fixtureCompany) {
    await prisma.companyPackage.deleteMany({ where: { companyId: fixtureCompany.id } });
    await prisma.company.deleteMany({ where: { id: fixtureCompany.id } });
  }
  await prisma.user.deleteMany({ where: { email: "batch-fixture-admin@test.com" } });
  await prisma.apiKey.deleteMany({ where: { keyHash: TEST_API_KEY_HASH } });
}
