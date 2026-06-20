import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EmploymentType, JobShift, JobStatus, PayPeriod, TemperatureEnv } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ScreeningQuestionDto } from "./screening-question.dto.js";

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

const JOB_STATUSES = [
  JobStatus.draft,
  JobStatus.active,
  JobStatus.published,
  JobStatus.closed,
  JobStatus.expired,
] as const;

const PAY_PERIODS = [
  PayPeriod.hour,
  PayPeriod.day,
  PayPeriod.week,
  PayPeriod.month,
  PayPeriod.year,
] as const;

const TEMP_ENVS = [TemperatureEnv.ambient, TemperatureEnv.cooler, TemperatureEnv.freezer] as const;

/** Accepts standard UUID shape (Prisma ids); does not enforce RFC version nibble. */
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateJobDto {
  @ApiProperty({ minLength: 3, maxLength: 120 })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  category!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categorySlug?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @Matches(UUID_LIKE, { message: "companyId must be a UUID" })
  companyId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  location!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiProperty({ minLength: 2, maxLength: 2 })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  state!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiProperty({ enum: EMPLOYMENT_TYPES })
  @IsEnum(EMPLOYMENT_TYPES)
  employmentType!: EmploymentType;

  @ApiProperty({ enum: JOB_SHIFTS })
  @IsEnum(JOB_SHIFTS)
  shift!: JobShift;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  payMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  payMax?: number;

  @ApiPropertyOptional({ enum: PAY_PERIODS })
  @IsOptional()
  @IsEnum(PAY_PERIODS)
  payPeriod?: PayPeriod;

  @ApiProperty({ minLength: 30, maxLength: 5000 })
  @IsString()
  @MinLength(30)
  @MaxLength(5000)
  description!: string;

  @ApiPropertyOptional({ maxLength: 3000 })
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  requirements?: string;

  @ApiPropertyOptional({ enum: TEMP_ENVS })
  @IsOptional()
  @IsEnum(TEMP_ENVS)
  temperatureEnv?: TemperatureEnv;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificationsRequired?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  liftRequirementLbs?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  overtimeAvailable?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  weeklyPay?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  quickHire?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @Matches(UUID_LIKE, { message: "companyPackageId must be a UUID" })
  companyPackageId?: string;

  @ApiPropertyOptional({ type: [ScreeningQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreeningQuestionDto)
  screeningQuestions?: ScreeningQuestionDto[];

  @ApiPropertyOptional({ enum: JOB_STATUSES })
  @IsOptional()
  @IsEnum(JOB_STATUSES)
  status?: JobStatus;
}
