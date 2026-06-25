import { Injectable, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import type { Request } from "express";
import { PrismaService } from "../../core/database/prisma.service.js";
import type { Env } from "../../core/config/env.schema.js";

/**
 * Guards the batch endpoints.
 *
 * Accepts either:
 *   1. `X-Api-Key: <raw-key>` — hashed with SHA-256, looked up in `api_keys` table,
 *      or compared against `API_KEY_HASH` env var as a dev/CI fallback.
 *   2. `Authorization: Bearer <jwt>` — delegated to the `jwt` Passport strategy
 *      (admin or vendor roles are checked in the controller).
 *
 * When API key auth succeeds, `req.apiKeyAuth` is set so the controller can
 * scope deduplication to the key's `companyId`.
 */
@Injectable()
export class BatchAuthGuard extends AuthGuard("jwt") {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const apiKey = req.headers["x-api-key"] as string | undefined;

    if (apiKey) {
      return this.validateApiKey(context, apiKey);
    }

    // No API key — fall through to JWT Bearer validation
    return super.canActivate(context) as Promise<boolean>;
  }

  private async validateApiKey(context: ExecutionContext, rawKey: string): Promise<boolean> {
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    // Primary path: DB lookup
    const record = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (record && (!record.expiresAt || record.expiresAt > new Date())) {
      await this.prisma.apiKey.update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      });
      const req = context.switchToHttp().getRequest<Request>();
      req.apiKeyAuth = { apiKeyId: record.id, companyId: record.companyId ?? null };
      return true;
    }

    // Dev/CI fallback: compare hash against API_KEY_HASH env var
    const envHash = this.config.get("API_KEY_HASH", { infer: true });
    if (keyHash === envHash) {
      const req = context.switchToHttp().getRequest<Request>();
      req.apiKeyAuth = { apiKeyId: null, companyId: null };
      return true;
    }

    throw new UnauthorizedException("Invalid or expired API key");
  }
}
