import { StorageHealthIndicator } from '@core/health/storage-health.indicator';
import type { StorageService } from '@core/storage/storage.service';

describe('StorageHealthIndicator', () => {
  it('reports up when storage responds', async () => {
    const storage = { ping: jest.fn().mockResolvedValue(undefined) } as unknown as StorageService;
    const indicator = new StorageHealthIndicator(storage);
    await expect(indicator.isHealthy('storage')).resolves.toEqual({ storage: { status: 'up' } });
  });

  it('throws a health check error when storage is unreachable', async () => {
    const storage = {
      ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    } as unknown as StorageService;
    const indicator = new StorageHealthIndicator(storage);
    await expect(indicator.isHealthy('storage')).rejects.toThrow();
  });
});
