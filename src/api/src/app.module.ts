import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ConfigModule } from './core/config/config.module.js';
import { DatabaseModule } from './core/database/database.module.js';
import { LoggingModule } from './core/logging/logging.module.js';
import { HealthModule } from './core/health/health.module.js';
import { ErrorModule } from './core/error/error.module.js';
import { QueueModule } from './core/queue/queue.module.js';
import { StorageModule } from './core/storage/storage.module.js';
import { AuthCoreModule } from './core/auth/auth-core.module.js';
import { SmsModule } from './core/sms/sms.module.js';

@Module({
  imports: [
    // ── Core — always loaded, globally available ──────────────────────────
    ConfigModule,
    LoggingModule,
    DatabaseModule,
    ErrorModule,
    AuthCoreModule,
    QueueModule,
    StorageModule,
    SmsModule,

    // ── Rate limiting — applied globally ──────────────────────────────────
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),

    // ── Health check endpoint ─────────────────────────────────────────────
    HealthModule,

    // ── Domain modules (added as phases are implemented) ─────────────────
    // Phase 2: AuthModule
    // Phase 3: JobsModule
    // Phase 4: BatchModule
    // Phase 5: ApplicationsModule
    // Phase 6: CompaniesModule, AdminModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
