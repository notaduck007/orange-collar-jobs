import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from '@core/logging/logging.module';
import { envSchema } from '@core/config/env.schema';

const validEnv = {
  NODE_ENV: 'development' as const,
  PORT: 3001,
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://wj_user:wj_dev_password@localhost:5433/warehousejobs',
  REDIS_URL: 'redis://localhost:6380',
  JWT_SECRET: 'a'.repeat(40),
  JWT_REFRESH_SECRET: 'b'.repeat(40),
  STORAGE_ENDPOINT: 'http://localhost:9000',
  STORAGE_ACCESS_KEY: 'wj_minio_user',
  STORAGE_SECRET_KEY: 'wj_minio_dev_password',
  EMAIL_API_KEY: 're_test_key',
  EMAIL_FROM: 'noreply@warehousejobs.com',
  API_KEY_HASH: 'local_dev_placeholder_batch_api_key_hash',
  LOG_LEVEL: 'debug' as const,
};

describe('LoggingModule', () => {
  it('compiles with development logging config', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (c) => envSchema.parse(c),
          load: [() => validEnv],
        }),
        LoggingModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });

  it('compiles with production logging config (no pretty transport)', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ ...validEnv, NODE_ENV: 'production' })],
          validate: (cfg) => envSchema.parse(cfg),
        }),
        LoggingModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
