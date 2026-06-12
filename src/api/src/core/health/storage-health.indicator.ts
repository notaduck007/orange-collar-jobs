import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { StorageService } from '../storage/storage.service.js';

@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.storage.ping();
      return this.getStatus(key, true);
    } catch (err) {
      throw new HealthCheckError('Storage check failed', this.getStatus(key, false, { err }));
    }
  }
}
