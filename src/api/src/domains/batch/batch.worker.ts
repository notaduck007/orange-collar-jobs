import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import type { Job } from "bull";
import type { Prisma } from "../../core/database/prisma-client.js";
import { PrismaService } from "../../core/database/prisma.service.js";
import { QUEUE_BATCH_INGEST } from "../../core/queue/queue.module.js";
import { BatchService } from "./batch.service.js";
import type { BatchJobData } from "./types.js";

/** Type guard for Prisma P2025 error (record not found) */
function isPrismaNotFoundError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "P2025" &&
    "name" in err &&
    err.name === "PrismaClientKnownRequestError"
  );
}

/**
 * Bull worker for async batch ingestion (> SYNC_THRESHOLD jobs).
 * Uses @nestjs/bull (Bull v4) — job.progress(), not BullMQ updateProgress().
 *
 * Lifecycle:
 *  1. Sets BatchJob.status = "processing"
 *  2. Delegates to BatchService.processItems() in chunks of 50
 *  3. Flushes counters to DB after each chunk (live progress visibility)
 *  4. Sets BatchJob.status = "completed" or "failed" on finish
 */
@Processor(QUEUE_BATCH_INGEST)
export class BatchWorker {
  private readonly logger = new Logger(BatchWorker.name);
  private static readonly CHUNK_SIZE = 50;

  constructor(
    private readonly batchService: BatchService,
    private readonly prisma: PrismaService,
  ) {}

  @Process("process-batch")
  async handle(job: Job<BatchJobData>): Promise<void> {
    const { batchId, items, companyId } = job.data;
    this.logger.log(`Processing batch ${batchId}: ${items.length} items`);

    try {
      await this.prisma.batchJob.update({
        where: { id: batchId },
        data: { status: "processing", startedAt: new Date() },
      });
    } catch (err) {
      if (isPrismaNotFoundError(err)) {
        this.logger.warn(`BatchJob ${batchId} not found; skipping processing (likely test cleanup)`);
        return;
      }
      throw err;
    }

    const counters = { created: 0, updated: 0, skipped: 0, failed: 0 };
    const errors: Array<{ index: number; externalId?: string | null; reason: string }> = [];

    try {
      // Process in chunks so progress is visible and memory is bounded
      for (let offset = 0; offset < items.length; offset += BatchWorker.CHUNK_SIZE) {
        const chunk = items.slice(offset, offset + BatchWorker.CHUNK_SIZE);

        // BatchService.processItem expects BatchJobItemDto — cast is safe (same shape)
        const results = await this.batchService.processItems(
          chunk as Parameters<typeof this.batchService.processItems>[0],
          companyId,
        );

        for (const r of results) {
          counters[r.action]++;
          if (r.action === "failed") {
            errors.push({
              index: offset + r.index,
              externalId: r.externalId ?? null,
              reason: r.error ?? "unknown error",
            });
          }
        }

        // Flush incremental progress to DB
        try {
          await this.prisma.batchJob.update({
            where: { id: batchId },
            data: { ...counters, errors },
          });
        } catch (err) {
          if (isPrismaNotFoundError(err)) {
            this.logger.warn(`BatchJob ${batchId} not found during progress flush; skipping update`);
            return;
          }
          throw err;
        }

        // Report progress to BullMQ (0–100)
        const pct = Math.round(((offset + chunk.length) / items.length) * 100);
        await job.progress(pct);
      }

      try {
        await this.prisma.batchJob.update({
          where: { id: batchId },
          data: { status: "completed", completedAt: new Date(), ...counters, errors },
        });
      } catch (err) {
        if (isPrismaNotFoundError(err)) {
          this.logger.warn(`BatchJob ${batchId} not found during completion; skipping final update`);
          return;
        }
        throw err;
      }

      this.logger.log(
        `Batch ${batchId} complete — created:${counters.created} updated:${counters.updated} skipped:${counters.skipped} failed:${counters.failed}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Batch ${batchId} worker failed: ${message}`);

      try {
        await this.prisma.batchJob.update({
          where: { id: batchId },
          data: {
            status: "failed",
            completedAt: new Date(),
            ...counters,
            errors: [...errors, { index: -1, externalId: null, reason: `Worker error: ${message}` }],
          },
        });
      } catch (updateErr) {
        if (isPrismaNotFoundError(updateErr)) {
          this.logger.warn(`BatchJob ${batchId} not found during error update; skipping final update`);
          return;
        }
        // If we can't update the failure status, log it but don't throw again
        this.logger.error(`Failed to update BatchJob ${batchId} error status: ${String(updateErr)}`);
      }

      throw err; // Re-throw so BullMQ can retry per job options
    }
  }
}
