import { Test } from '@nestjs/testing';
import { ConfigModule } from '@core/config/config.module';

describe('ConfigModule', () => {
  it('compiles and validates environment from root .env', async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
