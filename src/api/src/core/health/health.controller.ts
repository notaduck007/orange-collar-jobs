import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
} from "@nestjs/terminus";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import type { Env } from "../config/env.schema.js";
import { PrismaService } from "../database/prisma.service.js";
import { Public } from "../auth/public.decorator.js";
import { RedisHealthIndicator } from "./redis-health.indicator.js";
import { StorageHealthIndicator } from "./storage-health.indicator.js";

/** Heap threshold for production liveness — omitted in dev/test (Jest loads a large graph). */
const PRODUCTION_HEAP_BYTES = 300 * 1024 * 1024;

/**
 * GET /api/health  (VERSION_NEUTRAL — no version segment)
 *
 * Liveness/readiness check used by load balancers and uptime monitors.
 * Always public; responds 200 when all deps are up, 503 otherwise.
 */
@ApiTags("System")
@Controller({ path: "health", version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly storageIndicator: StorageHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env>,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: "Platform health check — DB · Redis · Storage" })
  check(): ReturnType<HealthCheckService["check"]> {
    const indicators = [
      () => this.prismaIndicator.pingCheck("db", this.prisma),
      () => this.redisIndicator.isHealthy("redis"),
      () => this.storageIndicator.isHealthy("storage"),
    ];

    if (this.config.get("NODE_ENV", { infer: true }) === "production") {
      indicators.push(() => this.memory.checkHeap("memory_heap", PRODUCTION_HEAP_BYTES));
    }

    return this.health.check(indicators);
  }
}
