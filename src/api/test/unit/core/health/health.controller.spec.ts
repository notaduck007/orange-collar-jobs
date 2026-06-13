import type {
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import type { ConfigService } from '@nestjs/config';
import { HealthController } from '@core/health/health.controller';
import type { PrismaService } from '@core/database/prisma.service';
import type { RedisHealthIndicator } from '@core/health/redis-health.indicator';
import type { StorageHealthIndicator } from '@core/health/storage-health.indicator';

function buildController(nodeEnv: 'development' | 'production' | 'test'): HealthController {
  const prismaIndicator = {
    pingCheck: jest.fn().mockResolvedValue({ db: { status: 'up' } }),
  } as unknown as PrismaHealthIndicator;
  const redisIndicator = {
    isHealthy: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
  } as unknown as RedisHealthIndicator;
  const storageIndicator = {
    isHealthy: jest.fn().mockResolvedValue({ storage: { status: 'up' } }),
  } as unknown as StorageHealthIndicator;
  const memory = {
    checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
  } as unknown as MemoryHealthIndicator;
  const health = {
    check: jest.fn(async (indicators: Array<() => Promise<unknown>>) => {
      await Promise.all(indicators.map((fn) => fn()));
      return { status: 'ok' };
    }),
  } as unknown as HealthCheckService;
  const config = {
    get: jest.fn().mockReturnValue(nodeEnv),
  } as unknown as ConfigService;

  return new HealthController(
    health,
    prismaIndicator,
    redisIndicator,
    storageIndicator,
    memory,
    {} as PrismaService,
    config,
  );
}

describe('HealthController', () => {
  it('runs db, redis, and storage checks in development (no heap check)', async () => {
    const controller = buildController('development');
    const health = controller['health'] as HealthCheckService;
    const memory = controller['memory'] as MemoryHealthIndicator;

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(memory.checkHeap).not.toHaveBeenCalled();
    expect(health.check).toHaveBeenCalledWith(
      expect.arrayContaining([expect.any(Function)]),
    );
    const indicators = (health.check as jest.Mock).mock.calls[0][0] as Array<() => Promise<unknown>>;
    expect(indicators).toHaveLength(3);
  });

  it('includes heap check in production', async () => {
    const controller = buildController('production');
    const memory = controller['memory'] as MemoryHealthIndicator;
    const health = controller['health'] as HealthCheckService;

    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(memory.checkHeap).toHaveBeenCalledWith('memory_heap', 300 * 1024 * 1024);
    const indicators = (health.check as jest.Mock).mock.calls[0][0] as Array<() => Promise<unknown>>;
    expect(indicators).toHaveLength(4);
  });
});
