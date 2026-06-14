import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { QueueModule } from "@core/queue/queue.module";
import { envSchema } from "@core/config/env.schema";
import { validTestEnv } from "../../../helpers/test-env";

describe("QueueModule", () => {
  it("compiles and registers Bull queues", async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: (c) => envSchema.parse(c),
          load: [
            () => ({
              ...validTestEnv,
              NODE_ENV: "development",
              DATABASE_URL: "postgresql://wj_user:wj_dev_password@localhost:5433/warehousejobs",
              REDIS_URL: "redis://localhost:6380",
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
