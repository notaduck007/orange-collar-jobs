import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { LoggingModule } from "@core/logging/logging.module";
import { envSchema } from "@core/config/env.schema";
import { validTestEnv } from "../../../helpers/test-env";

const validEnv = {
  ...validTestEnv,
  NODE_ENV: "development" as const,
  DATABASE_URL: "postgresql://wj_user:wj_dev_password@localhost:5433/warehousejobs",
  REDIS_URL: "redis://localhost:6380",
};

describe("LoggingModule", () => {
  it("compiles with development logging config", async () => {
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

  it("compiles with production logging config (no pretty transport)", async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ ...validEnv, NODE_ENV: "production" })],
          validate: (cfg) => envSchema.parse(cfg),
        }),
        LoggingModule,
      ],
    }).compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
