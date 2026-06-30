import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from "@nestjs/swagger";
import { parse } from "csv-parse/sync";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { Request as ExpressRequest, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../core/auth/public.decorator.js";
import { ValidationError } from "../../core/error/errors.js";
import { BatchAuthGuard } from "./batch-auth.guard.js";
import { BatchRequestDto, BatchJobItemDto } from "./dto/ingest-batch.dto.js";
import { BatchService } from "./batch.service.js";
import type { BatchStatusResponse, BatchSubmitResponse } from "./types.js";

@ApiTags("Batch")
@Public()
@Controller({ path: "jobs/batch", version: "1" })
@UseGuards(BatchAuthGuard)
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  // ── POST /api/v1/jobs/batch (JSON or CSV multipart) ───────────────────────

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "ingestBatch",
    summary: "Ingest a batch of jobs",
    description:
      "Accepts JSON (`application/json` with a `jobs` array) or CSV (`multipart/form-data` with a `file` field). " +
      "≤100 jobs: processed inline (200). >100 jobs: queued via BullMQ (202 + batchId to poll).",
  })
  @ApiConsumes("application/json", "multipart/form-data")
  @ApiBody({
    description: "JSON body or multipart CSV upload",
    schema: {
      oneOf: [
        { $ref: "#/components/schemas/BatchRequest" },
        {
          type: "object",
          required: ["file"],
          properties: {
            file: { type: "string", format: "binary" },
            source: { type: "string" },
          },
        },
      ],
    },
  })
  @ApiBearerAuth()
  @ApiSecurity("ApiKeyAuth")
  @ApiResponse({ status: 200, description: "Sync result (≤100 jobs processed immediately)" })
  @ApiResponse({ status: 202, description: "Async result (>100 jobs queued)" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 422, description: "Validation error" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor("file"))
  async ingest(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<BatchStatusResponse | BatchSubmitResponse> {
    const apiKeyCompanyId = req.apiKeyAuth?.companyId ?? null;

    let items: BatchJobItemDto[];
    let source: string | undefined;
    let requestCompanyId: string | undefined;

    if (file) {
      items = this.parseCsvFile(file);
      source = this.extractMultipartSource(req.body);
      requestCompanyId = this.extractMultipartCompanyId(req.body);
    } else {
      const dto = await this.validateJsonBody(body);
      items = dto.jobs;
      source = dto.source;
      requestCompanyId = dto.companyId;
    }

    const result = await this.batchService.ingest(items, source, apiKeyCompanyId, requestCompanyId);
    if (!result.sync) {
      res.status(HttpStatus.ACCEPTED);
    }
    return result.data;
  }

  // ── GET /api/v1/jobs/batch/:batchId/status ────────────────────────────────

  @Get(":batchId/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "getBatchStatus",
    summary: "Poll batch status",
    description: "Returns processing progress for a batch job.",
  })
  @ApiBearerAuth()
  @ApiSecurity("ApiKeyAuth")
  @ApiResponse({ status: 200, description: "Batch status" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Batch not found" })
  getStatus(@Param("batchId") batchId: string): Promise<BatchStatusResponse> {
    return this.batchService.getStatus(batchId);
  }

  /** @internal — exposed for unit tests */
  parseCsvFile(file: Express.Multer.File): BatchJobItemDto[] {
    if (!file) throw new ValidationError("No CSV file uploaded");

    let rows: BatchJobItemDto[];
    try {
      rows = parse(file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value: string, context: { column?: string | number }) => {
          if (context.column === "payMin" || context.column === "payMax") {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? undefined : parsed;
          }
          return value === "" ? undefined : value;
        },
      }) as BatchJobItemDto[];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ValidationError(`CSV parse error: ${msg}`);
    }

    if (!rows.length) throw new ValidationError("CSV file contains no data rows");
    return rows;
  }

  private async validateJsonBody(body: unknown): Promise<BatchRequestDto> {
    const dto = plainToInstance(BatchRequestDto, body);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new ValidationError("Request validation failed", { errors });
    }
    return dto;
  }

  private extractMultipartSource(body: unknown): string | undefined {
    if (
      body !== null &&
      typeof body === "object" &&
      "source" in body &&
      typeof (body as Record<string, unknown>)["source"] === "string"
    ) {
      return (body as Record<string, unknown>)["source"] as string;
    }
    return undefined;
  }

  private extractMultipartCompanyId(body: unknown): string | undefined {
    if (
      body !== null &&
      typeof body === "object" &&
      "companyId" in body &&
      typeof (body as Record<string, unknown>)["companyId"] === "string"
    ) {
      return (body as Record<string, unknown>)["companyId"] as string;
    }
    return undefined;
  }
}
