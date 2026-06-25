import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class CreateCampaignDto {
  @IsString()
  name!: string;

  @IsEnum(["email", "sms"])
  channel!: "email" | "sms";

  @IsOptional()
  @IsObject()
  segment?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  htmlBody?: string;

  @IsOptional()
  @IsString()
  textBody?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class ListCampaignsQueryDto {
  @IsOptional()
  @IsEnum(["draft", "scheduled", "sending", "sent", "cancelled", "failed"])
  status?: "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
