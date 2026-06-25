import { ApiPropertyOptional } from "@nestjs/swagger";
import { JobSourceType, JobStatus } from "../../../core/database/prisma-client.js";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

const JOB_STATUSES = [
  JobStatus.draft,
  JobStatus.active,
  JobStatus.published,
  JobStatus.closed,
  JobStatus.expired,
] as const;

const JOB_SOURCE_TYPES = [
  JobSourceType.direct,
  JobSourceType.scraped,
  JobSourceType.api,
  JobSourceType.syndicated,
] as const;

export class AdminJobSearchDto {
  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsEnum(JOB_STATUSES)
  status?: JobStatus;

  @ApiPropertyOptional({ enum: JOB_SOURCE_TYPES })
  @IsOptional()
  @IsEnum(JOB_SOURCE_TYPES)
  sourceType?: JobSourceType;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
