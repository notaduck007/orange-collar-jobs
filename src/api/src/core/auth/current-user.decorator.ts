import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthUser } from "./jwt.strategy.js";

/** Exported for unit testing — the factory backing the {@link CurrentUser} decorator. */
export const currentUserFactory = (_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
};

export const CurrentUser = createParamDecorator(currentUserFactory);
