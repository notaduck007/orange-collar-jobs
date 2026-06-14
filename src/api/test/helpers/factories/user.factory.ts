import type { User } from "@prisma/client";
import { randomUUID } from "node:crypto";

export function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: randomUUID(),
    email: `user-${randomUUID()}@test.com`,
    passwordHash: "$2b$12$fakehashfortesting",
    role: "seeker",
    fullName: "Test User",
    phone: null,
    emailVerifiedAt: null,
    migrationSource: null,
    requiresReset: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildAdminUser(overrides: Partial<User> = {}): User {
  return buildUser({ role: "admin", ...overrides });
}

export function buildVendorUser(overrides: Partial<User> = {}): User {
  return buildUser({ role: "vendor", ...overrides });
}
