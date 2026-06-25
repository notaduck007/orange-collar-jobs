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

/** Seed a test API key row. Idempotent (upsert by keyHash). */
export async function seedApiKey(
  prisma: PrismaService,
  description = "Integration test key",
): Promise<{ id: string; keyHash: string }> {
  return prisma.apiKey.upsert({
    where: { keyHash: TEST_API_KEY_HASH },
    create: { keyHash: TEST_API_KEY_HASH, description },
    update: {},
  });
}

/** Remove all batch_jobs rows created during a test run. */
export async function cleanupBatchData(prisma: PrismaService): Promise<void> {
  // Delete jobs created by batch tests (externalId starts with FIXTURE- or AUTO- or Batch Job)
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
      ],
    },
  });
  await prisma.batchJob.deleteMany({});
  await prisma.company.deleteMany({ where: { name: "Priority Test Co" } });
  await prisma.apiKey.deleteMany({ where: { keyHash: TEST_API_KEY_HASH } });
}
