import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";

import { ConfigModule } from "./core/config/config.module.js";
import { DatabaseModule } from "./core/database/database.module.js";
import { LoggingModule } from "./core/logging/logging.module.js";
import { HealthModule } from "./core/health/health.module.js";
import { ErrorModule } from "./core/error/error.module.js";
import { QueueModule } from "./core/queue/queue.module.js";
import { StorageModule } from "./core/storage/storage.module.js";
import { AuthCoreModule } from "./core/auth/auth-core.module.js";
import { SmsModule } from "./core/sms/sms.module.js";
import { EmailModule } from "./core/email/email.module.js";
import { AuthModule } from "./domains/auth/auth.module.js";
import { JobsModule } from "./domains/jobs/jobs.module.js";
import { BatchModule } from "./domains/batch/batch.module.js";
import { NotificationsModule } from "./domains/notifications/notifications.module.js";
import { CompaniesModule } from "./domains/companies/companies.module.js";
import { UploadsModule } from "./domains/uploads/uploads.module.js";
import { ApiContractModule } from "./domains/api-contract/api-contract.module.js";

@Module({
  imports: [
    // ── Core — always loaded, globally available ──────────────────────────
    ConfigModule,
    LoggingModule,
    DatabaseModule,
    ErrorModule,
    EmailModule,
    AuthCoreModule,
    QueueModule,
    StorageModule,
    SmsModule,

    // ── Rate limiting — applied globally (skipped in NODE_ENV=test for integration/E2E) ──
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: "default",
          ttl: 60_000,
          limit: 60,
        },
      ],
      skipIf: () => process.env.NODE_ENV === "test",
    }),

    // ── Health check endpoint ─────────────────────────────────────────────
    HealthModule,

    // ── Domain modules (added as phases are implemented) ─────────────────
    AuthModule,
    JobsModule,
    BatchModule,
    NotificationsModule,
    CompaniesModule,
    UploadsModule,
    ApiContractModule,
    // Phase 5: ApplicationsModule
    // Phase 6: AdminModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
