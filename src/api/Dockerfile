# ─── Build stage ──────────────────────────────────────────────────────────────
# Build context is the repo ROOT so the shared tsconfig.base.json is available.
# We replicate the monorepo layout (/repo + /repo/src/api) so the API's
# `extends: ../../tsconfig.base.json` resolves exactly as it does locally.
FROM node:24-slim AS builder

WORKDIR /repo

# Shared strict TypeScript base (consumed by src/api/tsconfig.json)
COPY tsconfig.base.json ./

WORKDIR /repo/src/api

# Copy package files and install all deps (including devDeps for build)
COPY src/api/package*.json ./
COPY src/api/prisma ./prisma/
RUN npm ci

# Generate Prisma client before build
RUN npx prisma generate

# Copy source and build
COPY src/api/ ./
RUN npm run build

# ─── Production stage ─────────────────────────────────────────────────────────
FROM node:24-slim AS production

WORKDIR /repo/src/api

ENV NODE_ENV=production

# Copy only production deps
COPY src/api/package*.json ./
RUN apt-get update -y && apt-get install -y openssl && npm ci --omit=dev

# Copy Prisma client + migrations
COPY --from=builder /repo/src/api/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /repo/src/api/prisma ./prisma

# Copy compiled output
COPY --from=builder /repo/src/api/dist ./dist

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    chown -R nestjs:nodejs /repo

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/main"]
