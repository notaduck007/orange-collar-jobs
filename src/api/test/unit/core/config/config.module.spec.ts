import { Test } from '@nestjs/testing';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigModule } from '@core/config/config.module';
import { envSchema } from '@core/config/env.schema';
import { validTestEnv } from '../../../helpers/test-env';

describe('ConfigModule', () => {
  it('compiles and validates environment when env vars are provided', async () => {
    const module = await Test.createTestingModule({
      imports: [
        NestConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (c) => envSchema.parse(c),
          load: [() => validTestEnv],
        }),
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });

  it('exports ConfigModule for app wiring', async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
