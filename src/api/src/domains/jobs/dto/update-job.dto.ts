import { ApiPropertyOptional } from "@nestjs/swagger";
import { JobStatus } from "../../../core/database/prisma-client.js";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const JOB_STATUSES = [
  JobStatus.draft,
  JobStatus.active,
  JobStatus.published,
  JobStatus.closed,
  JobStatus.expired,
] as const;

export class UpdateJobDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  requirements?: string;

  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsEnum(JOB_STATUSES)
  status?: JobStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  featuredUntil?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  payMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  payMax?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  quickHire?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  weeklyPay?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overtimeAvailable?: boolean;
}
