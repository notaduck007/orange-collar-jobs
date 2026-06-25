import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import type { Job } from "bull";
import { PrismaService } from "../../core/database/prisma.service.js";
import { QUEUE_BATCH_INGEST } from "../../core/queue/queue.module.js";
import { BatchService } from "./batch.service.js";
import type { BatchJobData } from "./types.js";

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

    await this.prisma.batchJob.update({
      where: { id: batchId },
      data: { status: "processing", startedAt: new Date() },
    });

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
        await this.prisma.batchJob.update({
          where: { id: batchId },
          data: { ...counters, errors },
        });

        // Report progress to BullMQ (0–100)
        const pct = Math.round(((offset + chunk.length) / items.length) * 100);
        await job.progress(pct);
      }

      await this.prisma.batchJob.update({
        where: { id: batchId },
        data: { status: "completed", completedAt: new Date(), ...counters, errors },
      });

      this.logger.log(
        `Batch ${batchId} complete — created:${counters.created} updated:${counters.updated} skipped:${counters.skipped} failed:${counters.failed}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Batch ${batchId} worker failed: ${message}`);

      await this.prisma.batchJob.update({
        where: { id: batchId },
        data: {
          status: "failed",
          completedAt: new Date(),
          ...counters,
          errors: [...errors, { index: -1, externalId: null, reason: `Worker error: ${message}` }],
        },
      });

      throw err; // Re-throw so BullMQ can retry per job options
    }
  }
}
