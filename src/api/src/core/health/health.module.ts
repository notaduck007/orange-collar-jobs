import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HealthController } from "./health.controller.js";
import { RedisHealthIndicator } from "./redis-health.indicator.js";
import { StorageHealthIndicator } from "./storage-health.indicator.js";
import { StorageModule } from "../storage/storage.module.js";

@Module({
  imports: [TerminusModule, StorageModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, StorageHealthIndicator],
})
export class HealthModule {}
