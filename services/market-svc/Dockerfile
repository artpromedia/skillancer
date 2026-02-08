# =============================================================================
# market-svc Dockerfile
# Multi-stage build for production deployment
# Build from project root: docker build -f services/market-svc/Dockerfile .
# =============================================================================

FROM node:20.19-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.6 --activate
WORKDIR /app

# =============================================================================
# Stage: Dependencies - copy ALL workspace package.json files
# =============================================================================
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# All packages/*
COPY packages/admin/package.json ./packages/admin/
COPY packages/alerting/package.json ./packages/alerting/
COPY packages/analytics/package.json ./packages/analytics/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/audit-client/package.json ./packages/audit-client/
COPY packages/auth/package.json ./packages/auth/
COPY packages/bi/package.json ./packages/bi/
COPY packages/cache/package.json ./packages/cache/
COPY packages/compliance/package.json ./packages/compliance/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY packages/error-tracking/package.json ./packages/error-tracking/
COPY packages/intelligence-sdk-js/package.json ./packages/intelligence-sdk-js/
COPY packages/logger/package.json ./packages/logger/
COPY packages/metrics/package.json ./packages/metrics/
COPY packages/security/package.json ./packages/security/
COPY packages/service-client/package.json ./packages/service-client/
COPY packages/service-utils/package.json ./packages/service-utils/
COPY packages/testing/package.json ./packages/testing/
COPY packages/tracing/package.json ./packages/tracing/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/

# All packages/shared/*
COPY packages/shared/api-client/package.json ./packages/shared/api-client/
COPY packages/shared/auth/package.json ./packages/shared/auth/
COPY packages/shared/config/package.json ./packages/shared/config/
COPY packages/shared/error-handling/package.json ./packages/shared/error-handling/
COPY packages/shared/error-tracking/package.json ./packages/shared/error-tracking/

# Prisma schema for postinstall generation
COPY packages/database/prisma ./packages/database/prisma
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# This service
COPY services/market-svc/package.json ./services/market-svc/

RUN pnpm install --frozen-lockfile 2>&1 || pnpm install --no-frozen-lockfile
RUN cd packages/database && npx prisma generate

# =============================================================================
# Stage: Builder
# =============================================================================
FROM base AS builder

COPY --from=deps /app ./
COPY packages/ ./packages/
COPY services/market-svc ./services/market-svc
COPY tsconfig.json ./

RUN cd packages/config && (pnpm build 2>/dev/null || true)
RUN cd packages/types && (pnpm build 2>/dev/null || true)
RUN cd packages/utils && (pnpm build 2>/dev/null || true)
RUN cd packages/logger && (pnpm build 2>/dev/null || true)
RUN cd packages/metrics && (pnpm build 2>/dev/null || true)
RUN cd packages/database && (pnpm build 2>/dev/null || true)
RUN cd packages/cache && (pnpm build 2>/dev/null || true)
RUN cd packages/service-client && (pnpm build 2>/dev/null || true)
RUN cd packages/audit-client && (pnpm build 2>/dev/null || true)
RUN cd packages/service-utils && (pnpm build 2>/dev/null || true)
RUN cd services/market-svc && (pnpm build || true)

# =============================================================================
# Stage: Runner
# =============================================================================
FROM base AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 market
WORKDIR /app
ENV NODE_ENV=production PORT=3002 HOST=0.0.0.0

COPY --from=builder --chown=market:nodejs /app ./

USER market
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health/live || exit 1
CMD ["node", "services/market-svc/dist/index.js"]