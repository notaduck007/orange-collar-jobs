import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.schema.js";

export const QUEUE_BATCH_INGEST = "batch-ingest";
export const QUEUE_NOTIFICATIONS = "notifications";
export const QUEUE_JOB_ALERTS = "job-alerts";

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env>) => ({
        url: config.getOrThrow("REDIS_URL", { infer: true }),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86400 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_BATCH_INGEST },
      { name: QUEUE_NOTIFICATIONS },
      { name: QUEUE_JOB_ALERTS },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
