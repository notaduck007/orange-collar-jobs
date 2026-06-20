import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../database/prisma-client.js";
import { ROLES_KEY } from "./roles.decorator.js";
import { ForbiddenError } from "../error/errors.js";
import type { AuthUser } from "./jwt.strategy.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenError("Authentication required");
    if (!required.includes(user.role)) {
      throw new ForbiddenError(`Role '${user.role}' is not permitted for this operation`);
    }
    return true;
  }
}
