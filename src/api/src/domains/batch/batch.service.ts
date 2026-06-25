import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import type { Queue } from "bull";
import { PrismaService } from "../../core/database/prisma.service.js";
import { NotFoundError, ValidationError } from "../../core/error/errors.js";
import { QUEUE_BATCH_INGEST } from "../../core/queue/queue.module.js";
import { buildJobSlug } from "../jobs/job-slug.util.js";
import type { BatchJobItemDto } from "./dto/ingest-batch.dto.js";
import type {
  BatchItemResult,
  BatchJobData,
  BatchStatusResponse,
  BatchSubmitResponse,
} from "./types.js";

/** Batches with ≤ SYNC_THRESHOLD jobs are processed inline (HTTP 200). */
export const SYNC_THRESHOLD = 100;

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_BATCH_INGEST) private readonly queue: Queue,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Main ingest entry-point.
   * Returns `{ sync: true, data: BatchStatusResponse }` for ≤100 jobs.
   * Returns `{ sync: false, data: BatchSubmitResponse }` for >100 jobs (BullMQ).
   */
  async ingest(
    items: BatchJobItemDto[],
    source?: string,
    companyId?: string | null,
  ): Promise<{ sync: boolean; data: BatchStatusResponse | BatchSubmitResponse }> {
    if (items.length === 0) {
      throw new ValidationError("Batch must contain at least one job");
    }
    if (items.length > 10_000) {
      throw new ValidationError("Batch exceeds maximum of 10,000 jobs");
    }

    const batchRecord = await this.prisma.batchJob.create({
      data: {
        companyId: companyId ?? null,
        status: "queued",
        total: items.length,
      },
    });

    if (items.length <= SYNC_THRESHOLD) {
      return { sync: true, data: await this.processSync(batchRecord.id, items, companyId) };
    }

    await this.enqueueAsync(batchRecord.id, items, companyId, source);
    const response: BatchSubmitResponse = {
      batchId: batchRecord.id,
      status: "queued",
      count: items.length,
      message: `Batch of ${items.length} jobs queued for processing. Poll /api/v1/jobs/batch/${batchRecord.id}/status for progress.`,
    };
    return { sync: false, data: response };
  }

  async getStatus(batchId: string): Promise<BatchStatusResponse> {
    const record = await this.prisma.batchJob.findUnique({ where: { id: batchId } });
    if (!record) throw new NotFoundError("BatchJob", batchId);
    return this.toStatusResponse(record);
  }

  // ── Sync processing (≤ SYNC_THRESHOLD jobs) ──────────────────────────────

  private async processSync(
    batchId: string,
    items: BatchJobItemDto[],
    companyId?: string | null,
  ): Promise<BatchStatusResponse> {
    await this.prisma.batchJob.update({
      where: { id: batchId },
      data: { status: "processing", startedAt: new Date() },
    });

    const results = await this.processItems(items, companyId);
    const counts = this.tally(results);

    const updated = await this.prisma.batchJob.update({
      where: { id: batchId },
      data: {
        status: "completed",
        created: counts.created,
        updated: counts.updated,
        skipped: counts.skipped,
        failed: counts.failed,
        errors: this.buildErrorsJson(results),
        completedAt: new Date(),
      },
    });

    return this.toStatusResponse(updated);
  }

  // ── Async queueing (> SYNC_THRESHOLD jobs) ────────────────────────────────

  private async enqueueAsync(
    batchId: string,
    items: BatchJobItemDto[],
    companyId?: string | null,
    source?: string,
  ): Promise<void> {
    const jobData: BatchJobData = {
      batchId,
      items: items.map((i) => ({ ...i })),
      companyId: companyId ?? null,
      source,
    };
    await this.queue.add("process-batch", jobData, {
      jobId: batchId, // idempotent: prevents duplicate queue entries
    });
    this.logger.log(`Batch ${batchId} enqueued: ${items.length} items`);
  }

  // ── Item processing (shared by sync path and BullMQ worker) ──────────────

  async processItems(
    items: BatchJobItemDto[],
    companyId?: string | null,
  ): Promise<BatchItemResult[]> {
    const results: BatchItemResult[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item) {
        results.push(await this.processItem(item, i, companyId));
      }
    }
    return results;
  }

  async processItem(
    item: BatchJobItemDto,
    index: number,
    companyId?: string | null,
  ): Promise<BatchItemResult> {
    try {
      // Resolve externalId + companyId for deduplication
      if (item.externalId) {
        const existing = await this.prisma.job.findFirst({
          where: {
            externalId: item.externalId,
            companyId: companyId ?? null,
          },
        });

        if (existing) {
          if (this.hasContentChanged(existing, item)) {
            await this.prisma.job.update({
              where: { id: existing.id },
              data: this.buildUpdateData(item),
            });
            return { action: "updated", index, externalId: item.externalId };
          }
          return { action: "skipped", index, externalId: item.externalId };
        }
      }

      // Create new job
      const baseSlug = buildJobSlug(
        item.title,
        item.city ?? item.location.split(",")[0]?.trim() ?? "unknown",
        item.state ?? item.location.split(",")[1]?.trim() ?? "XX",
      );
      const slug = await this.ensureUniqueSlug(baseSlug);

      await this.prisma.job.create({
        data: {
          companyId: companyId ?? null,
          title: item.title,
          slug,
          category: item.category ?? "General",
          categorySlug: (item.category ?? "general")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-"),
          location: item.location,
          city: item.city ?? item.location.split(",")[0]?.trim() ?? "Unknown",
          state: item.state ?? item.location.split(",")[1]?.trim() ?? "XX",
          zip: item.zip ?? null,
          employmentType: item.employmentType,
          shift: item.shift,
          payMin: item.payMin ?? null,
          payMax: item.payMax ?? null,
          payPeriod: item.payPeriod ?? null,
          description: item.description,
          requirements: item.requirements ?? null,
          sourceType: item.sourceType,
          sourceUrl: item.sourceUrl ?? null,
          externalId: item.externalId ?? null,
          status: "published",
          postedAt: new Date(),
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
        },
      });

      return { action: "created", index, externalId: item.externalId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Batch item[${index}] failed: ${message}`);
      return { action: "failed", index, externalId: item.externalId, error: message };
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  private hasContentChanged(
    existing: { title: string; description: string; location: string },
    item: BatchJobItemDto,
  ): boolean {
    return (
      existing.title !== item.title ||
      existing.description !== item.description ||
      existing.location !== item.location
    );
  }

  private buildUpdateData(item: BatchJobItemDto): Record<string, unknown> {
    return {
      title: item.title,
      location: item.location,
      city: item.city ?? item.location.split(",")[0]?.trim(),
      state: item.state ?? item.location.split(",")[1]?.trim(),
      zip: item.zip ?? null,
      employmentType: item.employmentType,
      shift: item.shift,
      payMin: item.payMin ?? null,
      payMax: item.payMax ?? null,
      payPeriod: item.payPeriod ?? null,
      description: item.description,
      requirements: item.requirements ?? null,
      sourceUrl: item.sourceUrl ?? null,
      expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
    };
  }

  private async ensureUniqueSlug(base: string): Promise<string> {
    let slug = base;
    let counter = 1;
    while (await this.prisma.job.findUnique({ where: { slug } })) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private tally(results: BatchItemResult[]): { created: number; updated: number; skipped: number; failed: number } {
    return results.reduce(
      (acc, r) => {
        acc[r.action]++;
        return acc;
      },
      { created: 0, updated: 0, skipped: 0, failed: 0 },
    );
  }

  private buildErrorsJson(results: BatchItemResult[]): Array<{ index: number; externalId: string | null; reason: string }> {
    return results
      .filter((r) => r.action === "failed")
      .map((r) => ({ index: r.index, externalId: r.externalId ?? null, reason: r.error ?? "" }));
  }

  private toStatusResponse(record: {
    id: string;
    status: import("../../core/database/prisma-client.js").BatchStatus;
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    errors: unknown;
    startedAt: Date | null;
    completedAt: Date | null;
  }): BatchStatusResponse {
    return {
      batchId: record.id,
      status: record.status,
      total: record.total,
      created: record.created,
      updated: record.updated,
      skipped: record.skipped,
      failed: record.failed,
      errors: (record.errors as Array<{ index: number; externalId?: string | null; reason: string }>) ?? [],
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
    };
  }
}
