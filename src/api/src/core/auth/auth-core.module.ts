import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { RolesGuard } from "./roles.guard.js";
import { MeController } from "./me.controller.js";
import type { Env } from "../config/env.schema.js";

@Global()
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env>) => ({
        secret: config.getOrThrow("JWT_SECRET", { infer: true }),
        signOptions: {
          expiresIn: config.get("JWT_ACCESS_EXPIRES_IN", { infer: true }) ?? "15m",
        },
      }),
    }),
  ],
  controllers: [MeController],
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtModule, PassportModule],
})
export class AuthCoreModule {}
