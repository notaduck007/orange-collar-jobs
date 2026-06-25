import { IsBoolean, IsOptional } from "class-validator";

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailTransactional?: boolean;

  @IsOptional()
  @IsBoolean()
  emailMarketing?: boolean;

  @IsOptional()
  @IsBoolean()
  smsTransactional?: boolean;

  @IsOptional()
  @IsBoolean()
  smsMarketing?: boolean;

  @IsOptional()
  @IsBoolean()
  inApp?: boolean;
}
