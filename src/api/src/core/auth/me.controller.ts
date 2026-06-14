import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { CurrentUser } from "./current-user.decorator.js";
import type { AuthUser } from "./jwt.strategy.js";

/**
 * GET /api/v1/me
 *
 * Returns the identity extracted from the JWT already validated by JwtAuthGuard.
 * No database call — the user object is populated by JwtStrategy.validate().
 */
@ApiTags("Auth")
@ApiBearerAuth()
@Controller({ path: "me", version: "1" })
export class MeController {
  @Get()
  @ApiOperation({
    summary: "Return the authenticated caller identity",
    description:
      "Decodes the Bearer JWT and returns the caller id, email, and role. " +
      "Returns 401 if the token is absent, malformed, expired, or the user no longer exists.",
  })
  @ApiUnauthorizedResponse({ description: "No token / token invalid / user deleted" })
  getMe(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
