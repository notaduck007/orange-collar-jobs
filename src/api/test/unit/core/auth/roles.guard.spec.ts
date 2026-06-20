import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import type { UserRole } from "../../../../src/core/database/prisma-client.js";
import { RolesGuard } from "@core/auth/roles.guard";
import { ForbiddenError } from "@core/error/errors";
import type { AuthUser } from "@core/auth/jwt.strategy";

function buildContext(user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    guard = new RolesGuard(reflector);
  });

  function setRequiredRoles(roles: UserRole[] | undefined): void {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(roles);
  }

  it("allows access when no roles are required", () => {
    setRequiredRoles(undefined);
    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it("allows access when the required role list is empty", () => {
    setRequiredRoles([]);
    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it("allows a user whose role is permitted", () => {
    setRequiredRoles(["admin", "vendor"]);
    const ctx = buildContext({ id: "1", email: "a@b.c", role: "vendor" });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("throws ForbiddenError when no user is present", () => {
    setRequiredRoles(["admin"]);
    expect(() => guard.canActivate(buildContext())).toThrow(ForbiddenError);
  });

  it("throws ForbiddenError when the user role is not permitted", () => {
    setRequiredRoles(["admin"]);
    const ctx = buildContext({ id: "1", email: "a@b.c", role: "seeker" });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenError);
  });
});
