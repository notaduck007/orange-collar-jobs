import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '@core/queue/queue.module';
import { envSchema } from '@core/config/env.schema';

describe('QueueModule', () => {
  it('compiles and registers Bull queues', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (c) => envSchema.parse(c),
          load: [
            () => ({
              NODE_ENV: 'development',
              PORT: 3001,
              CORS_ORIGIN: 'http://localhost:5173',
              DATABASE_URL: 'postgresql://wj_user:wj_dev_password@localhost:5433/warehousejobs',
              REDIS_URL: 'redis://localhost:6380',
              JWT_SECRET: 'a'.repeat(40),
              JWT_REFRESH_SECRET: 'b'.repeat(40),
              STORAGE_ENDPOINT: 'http://localhost:9000',
              STORAGE_ACCESS_KEY: 'k',
              STORAGE_SECRET_KEY: 's',
              EMAIL_API_KEY: 're_test',
              EMAIL_FROM: 'noreply@test.com',
              API_KEY_HASH: 'hash',
            }),
          ],
        }),
        QueueModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  }, 30_000);
});
