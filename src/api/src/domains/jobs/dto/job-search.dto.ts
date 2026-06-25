import { ApiPropertyOptional } from "@nestjs/swagger";
import { EmploymentType, JobShift, TemperatureEnv } from "../../../core/database/prisma-client.js";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

const EMPLOYMENT_TYPES = [
  EmploymentType.full_time,
  EmploymentType.part_time,
  EmploymentType.temp,
  EmploymentType.temp_to_hire,
  EmploymentType.contract,
  EmploymentType.seasonal,
] as const;

const JOB_SHIFTS = [
  JobShift.first,
  JobShift.second,
  JobShift.third,
  JobShift.weekend,
  JobShift.flexible,
] as const;

const TEMP_ENVS = [TemperatureEnv.ambient, TemperatureEnv.cooler, TemperatureEnv.freezer] as const;

export class JobSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  radius?: number;

  @ApiPropertyOptional({ enum: JOB_SHIFTS })
  @IsOptional()
  @IsEnum(JOB_SHIFTS)
  shift?: JobShift;

  @ApiPropertyOptional({ enum: EMPLOYMENT_TYPES })
  @IsOptional()
  @IsEnum(EMPLOYMENT_TYPES)
  employmentType?: EmploymentType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  payMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  quickHire?: boolean;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  weeklyPay?: boolean;

  @ApiPropertyOptional({ enum: TEMP_ENVS })
  @IsOptional()
  @IsEnum(TEMP_ENVS)
  temperatureEnv?: TemperatureEnv;

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
