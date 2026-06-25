import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  EmploymentType,
  JobShift,
  JobSourceType,
  PayPeriod,
} from "../../../core/database/prisma-client.js";

export class BatchJobItemDto {
  @ApiPropertyOptional({
    description: "Unique identifier from source system; used for deduplication",
    example: "ACME-12345",
  })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({ example: "https://source.com/jobs/12345" })
  @IsOptional()
  @IsUrl()
  sourceUrl?: string;

  @ApiPropertyOptional({ description: "Company name; matched or created" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiProperty({ example: "Forklift Operator" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: "Forklift Operator" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiProperty({ example: "Dallas, TX" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  location!: string;

  @ApiPropertyOptional({ example: "Dallas" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: "TX" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  state?: string;

  @ApiPropertyOptional({ example: "75201" })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zip?: string;

  @ApiProperty({ enum: EmploymentType })
  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @ApiProperty({ enum: JobShift })
  @IsEnum(JobShift)
  shift!: JobShift;

  @ApiPropertyOptional({ example: 18.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  payMin?: number;

  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  payMax?: number;

  @ApiPropertyOptional({ enum: PayPeriod })
  @IsOptional()
  @IsEnum(PayPeriod)
  payPeriod?: PayPeriod;

  @ApiProperty({ minLength: 20 })
  @IsString()
  @MinLength(20)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiProperty({ enum: JobSourceType })
  @IsEnum(JobSourceType)
  sourceType!: JobSourceType;

  @ApiPropertyOptional({ description: "ISO-8601 expiry date" })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class BatchRequestDto {
  @ApiProperty({ type: [BatchJobItemDto], minItems: 1, maxItems: 10000 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @ValidateNested({ each: true })
  @Type(() => BatchJobItemDto)
  jobs!: BatchJobItemDto[];

  @ApiPropertyOptional({
    description: 'Human-readable batch label, e.g. "acme-feed-20260612"',
    example: "acme-feed-20260612",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  source?: string;
}
