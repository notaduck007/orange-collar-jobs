#!/usr/bin/env bun
/**
 * Dev-only token generator
 *
 * Creates (or finds) a dev user in the database and prints a signed JWT that
 * can be used as a Bearer token in Postman, curl, or the /dev/diagnostics page.
 *
 * Run from the repo root:
 *   bun run dev:token
 *   bun run dev:token --role admin
 *   bun run dev:token --email custom@test.com --role employer
 *
 * Options:
 *   --email   User email to create/find  (default: dev@warehousejobs.com)
 *   --role    admin | employer | seeker  (default: admin)
 *   --ttl     Token expiry               (default: 24h)
 *
 * Env: loaded from root .env via `bun --env-file=.env` (set in package.json script).
 */

// Bun loads .env via --env-file before this script runs — no dotenv import needed.
import { PrismaClient } from '../src/api/node_modules/@prisma/client/index.js';
import { createHmac } from 'crypto';

// ── Parse CLI args ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function arg(flag: string, def: string): string {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? (args[i + 1] as string) : def;
}

const email = arg('--email', 'dev@warehousejobs.com');
const role  = arg('--role',  'admin') as 'admin' | 'employer' | 'seeker';
const ttl   = arg('--ttl',   '24h');

const VALID_ROLES = ['admin', 'employer', 'seeker'] as const;
if (!VALID_ROLES.includes(role)) {
  console.error(`Invalid role "${role}". Valid values: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

// ── JWT signer (HS256, no external dependency) ────────────────────────────────

function base64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn: string,
): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

  const unit = expiresIn.slice(-1);
  const num  = parseInt(expiresIn.slice(0, -1), 10);
  const mult: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const seconds = num * (mult[unit] ?? 3600);

  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + seconds }));

  const sig = base64url(
    createHmac('sha256', secret).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${sig}`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env['JWT_SECRET'];
if (!JWT_SECRET) {
  console.error('JWT_SECRET is not set in .env. Run `bun run setup:env` first.');
  process.exit(1);
}

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set in .env. Is the stack running?');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

try {
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log(`↳ Creating dev user: ${email} (${role})`);
    user = await prisma.user.create({
      data: {
        email,
        // Placeholder hash — not usable for login (Phase 2 will bcrypt this properly)
        passwordHash: '$2b$12$devplaceholderdevplaceholderd.devplaceholderdevplaceholde',
        role,
        fullName: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      },
    });
    console.log(`✓ Created  ${user.id}`);
  } else {
    console.log(`✓ Found    ${user.id}  (${user.email} · ${user.role})`);
  }

  const token = signJwt(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    ttl,
  );

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`Bearer token  (${user.role} · expires ${ttl})`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(token);
  console.log('───────────────────────────────────────────────────────────────\n');
  console.log('curl:');
  console.log(`  curl -s -H "Authorization: Bearer ${token}" http://localhost:3001/api/v1/me | jq`);
  console.log('\nPostman / /dev/diagnostics:');
  console.log('  Paste the token into the "bearerToken" environment variable.\n');

} finally {
  await prisma.$disconnect();
}
