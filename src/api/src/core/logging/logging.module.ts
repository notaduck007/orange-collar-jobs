import { Global, Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env.schema.js";

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env>) => {
        const isProduction = config.get("NODE_ENV", { infer: true }) === "production";
        return {
          pinoHttp: {
            level: config.get("LOG_LEVEL", { infer: true }) ?? "info",
            ...(isProduction
              ? {}
              : {
                  transport: {
                    target: "pino-pretty",
                    options: { colorize: true, singleLine: true },
                  },
                }),
            customProps: () => ({ service: "warehousejobs-api" }),
            redact: ["req.headers.authorization", 'req.headers["x-api-key"]'],
            serializers: {
              req: (req: { method: string; url: string }) => ({
                method: req.method,
                url: req.url,
              }),
            },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
