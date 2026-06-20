# ─── Build stage ──────────────────────────────────────────────────────────────
# Monorepo build context = repo ROOT. Uses Bun (same as local dev / CI — not npm).
# Layout mirrors the workspace: /repo + /repo/src/api.
FROM oven/bun:1.2 AS builder

WORKDIR /repo

COPY package.json bun.lock tsconfig.base.json ./
COPY src/api/package.json ./src/api/
COPY src/api/prisma.config.ts ./src/api/
COPY src/api/prisma ./src/api/prisma/

RUN bun install --frozen-lockfile

WORKDIR /repo/src/api

COPY src/api/nest-cli.json src/api/tsconfig.json src/api/tsconfig.build.json ./

RUN bun run db:generate

COPY src/api/src ./src

RUN bun run build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM oven/bun:1.2-slim AS production

WORKDIR /repo/src/api

ENV NODE_ENV=production

# OpenSSL for PostgreSQL TLS connections on Debian slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Production deps — skip postinstall (generated client copied from builder)
COPY package.json bun.lock /repo/
COPY src/api/package.json /repo/src/api/
WORKDIR /repo
RUN bun install --frozen-lockfile --production --ignore-scripts

WORKDIR /repo/src/api

COPY --from=builder /repo/src/api/dist ./dist
COPY --from=builder /repo/src/api/prisma ./prisma
COPY --from=builder /repo/src/api/src/generated ./src/generated

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    chown -R nestjs:nodejs /repo

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "dist/main.js"]
