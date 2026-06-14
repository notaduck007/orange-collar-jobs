import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { JwtAuthGuard } from "@core/auth/jwt-auth.guard";
import { IS_PUBLIC_KEY } from "@core/auth/public.decorator";

describe("JwtAuthGuard", () => {
  let reflector: Reflector;
  let guard: JwtAuthGuard;

  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    guard = new JwtAuthGuard(reflector);
  });

  it("allows access to routes marked @Public() without delegating to passport", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });

  it("delegates to the passport guard for protected routes", () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
      canActivate: (c: ExecutionContext) => boolean;
    };
    const spy = jest.spyOn(parentProto, "canActivate").mockReturnValue(true);

    expect(guard.canActivate(ctx)).toBe(true);
    expect(spy).toHaveBeenCalledWith(ctx);

    spy.mockRestore();
  });
});
