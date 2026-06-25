import { IsEnum, IsOptional, IsString } from "class-validator";

export class SendOtpDto {
  @IsEnum(["email", "sms"])
  channel!: "email" | "sms";

  @IsString()
  destination!: string;

  @IsOptional()
  @IsEnum(["verify_contact", "login_2fa", "enable_2fa"])
  purpose?: "verify_contact" | "login_2fa" | "enable_2fa" = "verify_contact";
}
