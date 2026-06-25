import { IsString, IsUUID, Length, ValidateIf } from "class-validator";

export class Verify2faDto {
  @IsString()
  @Length(4, 8)
  code!: string;

  @ValidateIf((o: Verify2faDto) => o.challengeId !== undefined)
  @IsUUID()
  challengeId?: string;
}
