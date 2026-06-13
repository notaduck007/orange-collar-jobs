/**
 * Unit tests for MeController (GET /api/v1/me)
 *
 * MeController is intentionally thin: it returns the AuthUser already populated
 * by JwtStrategy.validate(). These tests verify the pass-through contract and
 * that the controller carries the correct NestJS metadata.
 */
import 'reflect-metadata';
import { MeController } from '@core/auth/me.controller';
import type { AuthUser } from '@core/auth/jwt.strategy';

const WORKER_USER: AuthUser = {
  id: 'user-uuid-1',
  email: 'worker@example.com',
  role: 'WORKER' as AuthUser['role'],
};

const EMPLOYER_USER: AuthUser = {
  id: 'user-uuid-2',
  email: 'employer@example.com',
  role: 'EMPLOYER' as AuthUser['role'],
};

describe('MeController', () => {
  let controller: MeController;

  beforeEach(() => {
    controller = new MeController();
  });

  it('returns the AuthUser object provided by the @CurrentUser() decorator', () => {
    expect(controller.getMe(WORKER_USER)).toEqual(WORKER_USER);
  });

  it('returns employer user with the correct role', () => {
    const result = controller.getMe(EMPLOYER_USER);
    expect(result.role).toBe('EMPLOYER');
    expect(result.email).toBe('employer@example.com');
  });

  it('returns the exact same reference — does not clone the user object', () => {
    const input = { ...WORKER_USER };
    const result = controller.getMe(input);
    expect(result).toBe(input);
  });

  it('is decorated with @ApiTags("Auth")', () => {
    const metadata = Reflect.getMetadata('swagger/apiUseTags', MeController);
    expect(metadata).toEqual(['Auth']);
  });

  it('controller is bound to version "1"', () => {
    const versionMeta = Reflect.getMetadata('__version__', MeController);
    expect(versionMeta).toBe('1');
  });
});
