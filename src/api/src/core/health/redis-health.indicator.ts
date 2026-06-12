import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from '../config/env.schema.js';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly config: ConfigService<Env>) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const client = new Redis(this.config.getOrThrow('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      connectTimeout: 3000,
    });

    try {
      await client.ping();
      await client.quit();
      return this.getStatus(key, true);
    } catch (err) {
      await client.quit().catch(() => undefined);
      throw new HealthCheckError('Redis check failed', this.getStatus(key, false, { err }));
    }
  }
}
