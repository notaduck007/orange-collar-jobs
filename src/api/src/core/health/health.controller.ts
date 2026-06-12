import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service.js';
import { Public } from '../auth/public.decorator.js';
import { RedisHealthIndicator } from './redis-health.indicator.js';
import { StorageHealthIndicator } from './storage-health.indicator.js';

@ApiTags('System')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly storageIndicator: StorageHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Platform health check — DB · Redis · Storage' })
  check(): ReturnType<HealthCheckService['check']> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('db', this.prisma),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.storageIndicator.isHealthy('storage'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}
