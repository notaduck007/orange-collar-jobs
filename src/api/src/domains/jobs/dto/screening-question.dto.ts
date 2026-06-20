import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ScreeningQuestionType } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  Allow,
} from "class-validator";

const QUESTION_TYPES = [
  ScreeningQuestionType.yes_no,
  ScreeningQuestionType.single,
  ScreeningQuestionType.multi,
  ScreeningQuestionType.number,
  ScreeningQuestionType.text,
] as const;

export class ScreeningQuestionDto {
  /** Ignored on job create (server assigns id). Allowed so clients can reuse GET response shapes. */
  @Allow()
  @IsOptional()
  id?: string;

  @ApiProperty({ example: "Do you have a valid forklift certification?" })
  @IsString()
  @MinLength(1)
  prompt!: string;

  @ApiProperty({ enum: QUESTION_TYPES })
  @IsEnum(QUESTION_TYPES)
  type!: ScreeningQuestionType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({ default: false })
  @IsBoolean()
  required!: boolean;

  @ApiProperty()
  @IsInt()
  sortOrder!: number;
}
