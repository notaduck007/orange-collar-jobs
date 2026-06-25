import { IsEnum, IsString, Length } from "class-validator";

export class VerifyOtpDto {
  @IsEnum(["email", "sms"])
  channel!: "email" | "sms";

  @IsString()
  destination!: string;

  @IsString()
  @Length(4, 8)
  code!: string;

  @IsEnum(["verify_contact", "login_2fa", "enable_2fa"])
  purpose!: "verify_contact" | "login_2fa" | "enable_2fa";
}
