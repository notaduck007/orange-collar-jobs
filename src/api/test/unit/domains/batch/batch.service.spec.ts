import { BatchService, SYNC_THRESHOLD } from "@domains/batch/batch.service";
import { NotFoundError, ValidationError } from "@core/error/errors";
import { BATCH_JOB_ITEM, BATCH_JOB_ITEM_EXT, buildBatchItems } from "../../../helpers/batch.fixtures";

// ── Prisma mock ───────────────────────────────────────────────────────────────

const batchJobId = "batch-uuid-001";

const prismaMock = {
  batchJob: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  job: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// ── BullMQ Queue mock ────────────────────────────────────────────────────────

const queueMock = { add: jest.fn() };

// ── Service under test ────────────────────────────────────────────────────────

let svc: BatchService;

beforeEach(() => {
  jest.clearAllMocks();

  svc = new BatchService(prismaMock as never, queueMock as never);

  // Default: batchJob.create returns a row
  prismaMock.batchJob.create.mockResolvedValue({
    id: batchJobId,
    status: "queued",
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    startedAt: null,
    completedAt: null,
  });

  // Default: batchJob.update echoes the update data + id
  prismaMock.batchJob.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: batchJobId,
      status: data.status ?? "completed",
      total: 1,
      created: data.created ?? 0,
      updated: data.updated ?? 0,
      skipped: data.skipped ?? 0,
      failed: data.failed ?? 0,
      errors: data.errors ?? [],
      startedAt: data.startedAt ?? null,
      completedAt: data.completedAt ?? null,
    }),
  );

  // Default: slug uniqueness check → no conflict
  prismaMock.job.findUnique.mockResolvedValue(null);

  // Default: no existing job (dedup miss)
  prismaMock.job.findFirst.mockResolvedValue(null);

  // Default: job create succeeds
  prismaMock.job.create.mockResolvedValue({ id: "job-uuid-1" });
});

// ── ingest — validation ────────────────────────────────────────────────────────

describe("BatchService.ingest", () => {
  it("throws ValidationError on empty items array", async () => {
    await expect(svc.ingest([])).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ValidationError when items exceed 10,000", async () => {
    await expect(svc.ingest(buildBatchItems(10_001))).rejects.toBeInstanceOf(ValidationError);
  });

  // ── Sync path (≤ SYNC_THRESHOLD) ─────────────────────────────────────────

  it(`returns sync=true for ${SYNC_THRESHOLD} items`, async () => {
    const items = buildBatchItems(SYNC_THRESHOLD);
    prismaMock.batchJob.create.mockResolvedValueOnce({ id: batchJobId, status: "queued", total: items.length });

    const result = await svc.ingest(items);

    expect(result.sync).toBe(true);
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it("creates a BatchJob record on sync ingest", async () => {
    await svc.ingest([BATCH_JOB_ITEM]);
    expect(prismaMock.batchJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "queued", total: 1 }) }),
    );
  });

  it("marks BatchJob as completed after sync processing", async () => {
    await svc.ingest([BATCH_JOB_ITEM]);
    expect(prismaMock.batchJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "completed" }) }),
    );
  });

  it("returns created=1 for a new job with no externalId", async () => {
    await svc.ingest([BATCH_JOB_ITEM]);
    expect(prismaMock.job.create).toHaveBeenCalledTimes(1);
  });

  // ── Async path (> SYNC_THRESHOLD) ────────────────────────────────────────

  it(`returns sync=false for ${SYNC_THRESHOLD + 1} items`, async () => {
    const items = buildBatchItems(SYNC_THRESHOLD + 1);
    const result = await svc.ingest(items);

    expect(result.sync).toBe(false);
    expect(queueMock.add).toHaveBeenCalledWith(
      "process-batch",
      expect.objectContaining({ batchId: batchJobId, items: expect.any(Array) }),
      expect.objectContaining({ jobId: batchJobId }),
    );
  });

  it("async response includes batchId, status=queued, count", async () => {
    const items = buildBatchItems(SYNC_THRESHOLD + 1);
    const result = await svc.ingest(items);
    const data = result.data as { batchId: string; status: string; count: number };
    expect(data.batchId).toBe(batchJobId);
    expect(data.status).toBe("queued");
    expect(data.count).toBe(items.length);
  });
});

// ── processItem — deduplication ───────────────────────────────────────────────

describe("BatchService.processItem — deduplication", () => {
  it("creates when no existing job matches externalId", async () => {
    prismaMock.job.findFirst.mockResolvedValueOnce(null);
    const result = await svc.processItem(BATCH_JOB_ITEM_EXT, 0, null);
    expect(result.action).toBe("created");
    expect(prismaMock.job.create).toHaveBeenCalledTimes(1);
  });

  it("skips when content is identical", async () => {
    prismaMock.job.findFirst.mockResolvedValueOnce({
      id: "existing-job",
      title: BATCH_JOB_ITEM_EXT.title,
      description: BATCH_JOB_ITEM_EXT.description,
      location: BATCH_JOB_ITEM_EXT.location,
    });
    const result = await svc.processItem(BATCH_JOB_ITEM_EXT, 0, null);
    expect(result.action).toBe("skipped");
    expect(prismaMock.job.create).not.toHaveBeenCalled();
    expect(prismaMock.job.update).not.toHaveBeenCalled();
  });

  it("updates when title differs from stored record", async () => {
    prismaMock.job.findFirst.mockResolvedValueOnce({
      id: "existing-job",
      title: "OLD TITLE",
      description: BATCH_JOB_ITEM_EXT.description,
      location: BATCH_JOB_ITEM_EXT.location,
    });
    const result = await svc.processItem(
      {
        ...BATCH_JOB_ITEM_EXT,
        title: "NEW TITLE",
        city: undefined,
        state: undefined,
        location: "Houston, TX",
        expiresAt: "2026-12-31T00:00:00.000Z",
      },
      0,
      null,
    );
    expect(result.action).toBe("updated");
    expect(prismaMock.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          city: "Houston",
          state: "TX",
          expiresAt: new Date("2026-12-31T00:00:00.000Z"),
        }),
      }),
    );
  });

  it("returns failed on DB error", async () => {
    prismaMock.job.create.mockRejectedValueOnce(new Error("DB constraint"));
    const result = await svc.processItem(BATCH_JOB_ITEM, 0, null);
    expect(result.action).toBe("failed");
    expect(result.error).toContain("DB constraint");
  });
});

// ── ensureUniqueSlug — slug collision branch ──────────────────────────────────

describe("BatchService.processItem — slug collision", () => {
  it("appends counter when base slug already exists", async () => {
    // First findUnique (for slug 'forklift-operator-dallas-tx') returns a conflict
    // Second findUnique (for slug 'forklift-operator-dallas-tx-1') returns null → no conflict
    prismaMock.job.findUnique
      .mockResolvedValueOnce({ id: "existing-slug-job" }) // slug collision
      .mockResolvedValueOnce(null); // free slug
    prismaMock.job.findFirst.mockResolvedValueOnce(null); // no externalId match

    const result = await svc.processItem(BATCH_JOB_ITEM, 0, null);

    expect(result.action).toBe("created");
    // The job.create call should use the suffixed slug
    const createCall = prismaMock.job.create.mock.calls[0] as [{ data: { slug: string } }];
    expect(createCall[0].data.slug).toMatch(/-1$/);
  });
});

// ── getStatus ─────────────────────────────────────────────────────────────────

describe("BatchService.getStatus", () => {
  it("returns mapped status response when batch exists", async () => {
    prismaMock.batchJob.findUnique.mockResolvedValueOnce({
      id: batchJobId,
      status: "completed",
      total: 5,
      created: 3,
      updated: 1,
      skipped: 1,
      failed: 0,
      errors: [],
      startedAt: new Date("2026-06-01T12:00:00Z"),
      completedAt: new Date("2026-06-01T12:00:05Z"),
    });

    const result = await svc.getStatus(batchJobId);

    expect(result.batchId).toBe(batchJobId);
    expect(result.status).toBe("completed");
    expect(result.created).toBe(3);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.startedAt).toBeTruthy();
    expect(result.completedAt).toBeTruthy();
  });

  it("throws NotFoundError when batch does not exist", async () => {
    prismaMock.batchJob.findUnique.mockResolvedValueOnce(null);
    await expect(svc.getStatus("no-such-id")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("maps null startedAt and completedAt to null in status response", async () => {
    prismaMock.batchJob.findUnique.mockResolvedValueOnce({
      id: batchJobId,
      status: "queued",
      total: 1,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: null,
      startedAt: null,
      completedAt: null,
    });
    const result = await svc.getStatus(batchJobId);
    expect(result.startedAt).toBeNull();
    expect(result.completedAt).toBeNull();
    expect(result.errors).toEqual([]);
  });
});

describe("BatchService.processItem — location parsing", () => {
  it("derives city and state from location when omitted", async () => {
    prismaMock.job.findFirst.mockResolvedValueOnce(null);
    prismaMock.job.findUnique.mockResolvedValueOnce(null);
    const item = {
      ...BATCH_JOB_ITEM,
      city: undefined,
      state: undefined,
      location: "Austin, TX",
    };
    await svc.processItem(item, 0, null);
    const createCall = prismaMock.job.create.mock.calls[0] as [{ data: { city: string; state: string } }];
    expect(createCall[0].data.city).toBe("Austin");
    expect(createCall[0].data.state).toBe("TX");
  });

  it("returns failed with string error when create throws non-Error", async () => {
    prismaMock.job.findFirst.mockResolvedValueOnce(null);
    prismaMock.job.findUnique.mockResolvedValueOnce(null);
    prismaMock.job.create.mockRejectedValueOnce("constraint");
    const result = await svc.processItem(BATCH_JOB_ITEM, 0, null);
    expect(result.action).toBe("failed");
    expect(result.error).toBe("constraint");
  });
});

describe("BatchService.processSync — error aggregation", () => {
  it("records failed items in sync ingest errors json", async () => {
    prismaMock.job.create.mockRejectedValueOnce(new Error("boom"));
    prismaMock.batchJob.update.mockResolvedValue({
      id: batchJobId,
      status: "completed",
      total: 1,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 1,
      errors: [{ index: 0, externalId: null, reason: "boom" }],
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await svc.ingest([BATCH_JOB_ITEM]);
    expect(result.sync).toBe(true);
    if (result.sync) {
      expect(result.data.failed).toBe(1);
      expect(result.data.errors[0]?.reason).toBe("boom");
    }
  });
});

describe("BatchService.processItem — expiresAt and updates", () => {
  it("creates job with expiresAt when provided", async () => {
    prismaMock.job.findFirst.mockResolvedValueOnce(null);
    prismaMock.job.findUnique.mockResolvedValueOnce(null);
    const expiresAt = "2026-12-31T00:00:00.000Z";
    await svc.processItem({ ...BATCH_JOB_ITEM, expiresAt }, 0, null);
    const createCall = prismaMock.job.create.mock.calls[0] as [{ data: { expiresAt: Date } }];
    expect(createCall[0].data.expiresAt).toEqual(new Date(expiresAt));
  });
});
