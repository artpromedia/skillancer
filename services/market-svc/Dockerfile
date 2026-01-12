# =============================================================================
# Market Service Dockerfile
# Multi-stage build for production deployment
# =============================================================================

FROM node:20.19-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY services/market-svc/package.json ./services/market-svc/

# Copy Prisma schema for postinstall (prisma generate)
COPY packages/database/prisma ./packages/database/prisma

# Set dummy DATABASE_URL for Prisma client generation during postinstall
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services/market-svc/node_modules ./services/market-svc/node_modules
COPY packages/config ./packages/config
COPY packages/database ./packages/database
COPY services/market-svc ./services/market-svc
COPY tsconfig.json ./
RUN pnpm --filter @skillancer/config build && \
    pnpm --filter @skillancer/database build && \
    pnpm --filter @skillancer/market-svc build

FROM node:20.19-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 skillancer
WORKDIR /app
ENV NODE_ENV=production PORT=3002 HOST=0.0.0.0
COPY --from=builder --chown=skillancer:nodejs /app/services/market-svc/dist ./dist
COPY --from=builder --chown=skillancer:nodejs /app/services/market-svc/package.json ./
COPY --from=deps --chown=skillancer:nodejs /app/node_modules ./node_modules
USER skillancer
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health || exit 1
CMD ["node", "dist/index.js"]
