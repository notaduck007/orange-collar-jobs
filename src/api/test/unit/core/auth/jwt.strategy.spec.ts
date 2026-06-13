import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { JwtStrategy, type JwtPayload } from '@core/auth/jwt.strategy';
import type { PrismaService } from '@core/database/prisma.service';

describe('JwtStrategy', () => {
  const config = {
    getOrThrow: jest.fn().mockReturnValue('a'.repeat(40)),
  } as unknown as ConfigService;

  function buildStrategy(findUnique: jest.Mock): JwtStrategy {
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    return new JwtStrategy(config, prisma);
  }

  const payload: JwtPayload = { sub: 'u1', email: 'a@b.c', role: 'seeker' };

  it('returns the user when found', async () => {
    const user = { id: 'u1', email: 'a@b.c', role: 'seeker' as const };
    const findUnique = jest.fn().mockResolvedValue(user);
    const strategy = buildStrategy(findUnique);

    await expect(strategy.validate(payload)).resolves.toEqual(user);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { id: true, email: true, role: true },
    });
  });

  it('throws UnauthorizedException when the user does not exist', async () => {
    const strategy = buildStrategy(jest.fn().mockResolvedValue(null));
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
