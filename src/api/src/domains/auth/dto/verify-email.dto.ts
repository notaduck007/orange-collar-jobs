import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token from the verification email link' })
  @IsString()
  @MinLength(1)
  token!: string;
}
