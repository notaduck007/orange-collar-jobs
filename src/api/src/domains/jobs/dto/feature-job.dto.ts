import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDate, IsOptional } from "class-validator";

export class FeatureJobDto {
  @ApiProperty()
  @IsBoolean()
  featured!: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  featuredUntil?: Date | null;
}
