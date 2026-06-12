import { Controller, Get, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthUser } from './jwt.strategy.js';

@ApiTags('System')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  @Version('1')
  @ApiOperation({ summary: 'Return the authenticated caller identity' })
  getMe(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
