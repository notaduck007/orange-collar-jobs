import type { ConfigService } from '@nestjs/config';

const ping = jest.fn();
const quit = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({ ping, quit })),
);

import { RedisHealthIndicator } from '@core/health/redis-health.indicator';

describe('RedisHealthIndicator', () => {
  const config = {
    getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
  } as unknown as ConfigService;

  beforeEach(() => {
    ping.mockReset();
    quit.mockReset();
    quit.mockResolvedValue('OK');
  });

  it('reports up when Redis responds to PING', async () => {
    ping.mockResolvedValue('PONG');
    const indicator = new RedisHealthIndicator(config);
    await expect(indicator.isHealthy('redis')).resolves.toEqual({ redis: { status: 'up' } });
    expect(quit).toHaveBeenCalled();
  });

  it('throws a health check error when PING fails', async () => {
    ping.mockRejectedValue(new Error('connection refused'));
    const indicator = new RedisHealthIndicator(config);
    await expect(indicator.isHealthy('redis')).rejects.toThrow();
    expect(quit).toHaveBeenCalled();
  });
});
