import 'reflect-metadata';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { Public, IS_PUBLIC_KEY } from '@core/auth/public.decorator';
import { Roles, ROLES_KEY } from '@core/auth/roles.decorator';
import { currentUserFactory } from '@core/auth/current-user.decorator';
import type { AuthUser } from '@core/auth/jwt.strategy';

describe('auth decorators', () => {
  const reflector = new Reflector();

  describe('@Public', () => {
    it('marks the handler as public', () => {
      class Controller {
        @Public()
        handler(): void {}
      }
      expect(reflector.get(IS_PUBLIC_KEY, Controller.prototype.handler)).toBe(true);
    });
  });

  describe('@Roles', () => {
    it('stores the allowed roles', () => {
      class Controller {
        @Roles('admin', 'vendor')
        handler(): void {}
      }
      expect(reflector.get(ROLES_KEY, Controller.prototype.handler)).toEqual(['admin', 'vendor']);
    });

    it('supports a single role', () => {
      class Controller {
        @Roles('seeker')
        handler(): void {}
      }
      expect(reflector.get(ROLES_KEY, Controller.prototype.handler)).toEqual(['seeker']);
    });
  });

  describe('currentUserFactory', () => {
    it('extracts the user attached to the request', () => {
      const user: AuthUser = { id: 'u1', email: 'a@b.c', role: 'seeker' };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as unknown as ExecutionContext;
      expect(currentUserFactory(undefined, ctx)).toBe(user);
    });
  });
});
