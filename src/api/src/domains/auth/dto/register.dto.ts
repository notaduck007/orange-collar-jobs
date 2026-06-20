import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "../../../core/database/prisma-client.js";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

const REGISTER_ROLES = [UserRole.seeker, UserRole.vendor] as const;

export class RegisterDto {
  @ApiProperty({ example: "jane@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: "SecureP@ss1" })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: REGISTER_ROLES, example: "seeker" })
  @IsEnum(REGISTER_ROLES)
  role!: (typeof REGISTER_ROLES)[number];

  @ApiPropertyOptional({ example: "Jane Smith" })
  @IsOptional()
  @IsString()
  fullName?: string;
}
