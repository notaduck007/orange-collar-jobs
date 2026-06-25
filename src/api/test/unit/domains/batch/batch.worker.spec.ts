import { BatchWorker } from "@domains/batch/batch.worker";
import type { BatchJobData } from "@domains/batch/types";
import { BATCH_JOB_ITEM, buildBatchItems } from "../../../helpers/batch.fixtures";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prismaMock = {
  batchJob: {
    update: jest.fn(),
  },
};

const batchServiceMock = {
  processItems: jest.fn(),
};

const bullJobMock = {
  data: {} as BatchJobData,
  progress: jest.fn(),
};

let worker: BatchWorker;

beforeEach(() => {
  jest.clearAllMocks();
  worker = new BatchWorker(batchServiceMock as never, prismaMock as never);
  prismaMock.batchJob.update.mockResolvedValue({});
  bullJobMock.progress.mockResolvedValue(undefined);
});

// ── handle() ─────────────────────────────────────────────────────────────────

describe("BatchWorker.handle", () => {
  const batchId = "worker-batch-001";

  it("marks batch processing and then completed on success", async () => {
    batchServiceMock.processItems.mockResolvedValueOnce([{ action: "created", index: 0 }]);
    bullJobMock.data = { batchId, items: [BATCH_JOB_ITEM], companyId: null };

    await worker.handle(bullJobMock as never);

    // First update → processing
    expect(prismaMock.batchJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "processing" }) }),
    );
    // Last update → completed
    const lastCall = prismaMock.batchJob.update.mock.calls.at(-1) as [{ data: { status: string } }];
    expect(lastCall[0].data.status).toBe("completed");
  });

  it("accumulates created counter across chunks", async () => {
    const items = buildBatchItems(3);
    bullJobMock.data = { batchId, items, companyId: null };
    batchServiceMock.processItems.mockResolvedValue(
      items.map((_, i) => ({ action: "created", index: i })),
    );

    await worker.handle(bullJobMock as never);

    const lastCall = prismaMock.batchJob.update.mock.calls.at(-1) as [{ data: Record<string, unknown> }];
    expect(lastCall[0].data.created).toBe(3);
  });

  it("marks batch failed and re-throws on worker error", async () => {
    bullJobMock.data = { batchId, items: [BATCH_JOB_ITEM], companyId: null };
    batchServiceMock.processItems.mockRejectedValueOnce(new Error("Redis down"));

    await expect(worker.handle(bullJobMock as never)).rejects.toThrow("Redis down");

    const failCall = prismaMock.batchJob.update.mock.calls.find(
      (c: [{ data: { status: string } }]) => c[0].data.status === "failed",
    ) as [{ data: { status: string } }] | undefined;
    expect(failCall).toBeDefined();
  });

  it("reports progress via Bull job.progress", async () => {
    const items = buildBatchItems(5);
    bullJobMock.data = { batchId, items, companyId: null };
    batchServiceMock.processItems.mockResolvedValue(
      items.map((_, i) => ({ action: "created", index: i })),
    );

    await worker.handle(bullJobMock as never);

    expect(bullJobMock.progress).toHaveBeenCalledWith(100);
  });

  it("pushes to errors array when processItems returns failed items", async () => {
    const items = buildBatchItems(2);
    bullJobMock.data = { batchId, items, companyId: null };
    batchServiceMock.processItems.mockResolvedValueOnce([
      { action: "failed", index: 0, externalId: "AUTO-1", error: "DB error" },
      { action: "created", index: 1 },
    ]);

    await worker.handle(bullJobMock as never);

    const lastCall = prismaMock.batchJob.update.mock.calls.at(-1) as [{ data: { failed: number; errors: unknown[] } }];
    expect(lastCall[0].data.failed).toBe(1);
    expect(lastCall[0].data.errors).toHaveLength(1);
    expect((lastCall[0].data.errors[0] as { reason: string }).reason).toBe("DB error");
  });

  it("uses r.externalId ?? null and r.error ?? fallback for errors entry", async () => {
    bullJobMock.data = { batchId, items: [BATCH_JOB_ITEM], companyId: null };
    batchServiceMock.processItems.mockResolvedValueOnce([
      { action: "failed", index: 0 }, // no externalId, no error
    ]);

    await worker.handle(bullJobMock as never);

    const lastCall = prismaMock.batchJob.update.mock.calls.at(-1) as [{ data: { errors: Array<{ externalId: null; reason: string }> } }];
    expect(lastCall[0].data.errors[0].externalId).toBeNull();
    expect(lastCall[0].data.errors[0].reason).toBe("unknown error");
  });

  it("marks batch failed when worker throws non-Error", async () => {
    bullJobMock.data = { batchId, items: [BATCH_JOB_ITEM], companyId: "co-1" };
    batchServiceMock.processItems.mockRejectedValueOnce("worker crash");

    await expect(worker.handle(bullJobMock as never)).rejects.toBe("worker crash");

    const failCall = prismaMock.batchJob.update.mock.calls.find(
      (c: [{ data: { status: string; errors: Array<{ reason: string }> } }]) => c[0].data.status === "failed",
    ) as [{ data: { errors: Array<{ reason: string }> } }] | undefined;
    expect(failCall?.[0].data.errors.at(-1)?.reason).toContain("worker crash");
  });

  it("processes multiple chunks when batch exceeds chunk size", async () => {
    const items = buildBatchItems(75);
    bullJobMock.data = { batchId, items, companyId: null };
    batchServiceMock.processItems
      .mockResolvedValueOnce(items.slice(0, 50).map((_, i) => ({ action: "created", index: i })))
      .mockResolvedValueOnce(items.slice(50).map((_, i) => ({ action: "created", index: i })));

    await worker.handle(bullJobMock as never);

    expect(batchServiceMock.processItems).toHaveBeenCalledTimes(2);
    expect(bullJobMock.progress).toHaveBeenCalledWith(67);
    expect(bullJobMock.progress).toHaveBeenCalledWith(100);
  });
});
