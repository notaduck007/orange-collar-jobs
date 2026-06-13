import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

describe('AppModule', () => {
  it('compiles with the full core module graph', async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    expect(module.get(AppModule)).toBeDefined();
    await module.close();
  }, 60_000);
});
