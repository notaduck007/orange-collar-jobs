import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";

export class Enable2faDto {
  @IsEnum(["sms", "email"])
  method!: "sms" | "email";

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
