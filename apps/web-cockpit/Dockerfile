# =============================================================================
# web-cockpit Dockerfile (Next.js Standalone)
# Build from project root: docker build -f apps/web-cockpit/Dockerfile .
# =============================================================================

FROM node:20.19-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.6 --activate
WORKDIR /app

# =============================================================================
# Stage: Dependencies
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

# This app
COPY apps/web-cockpit/package.json ./apps/web-cockpit/

RUN pnpm install --frozen-lockfile 2>&1 || pnpm install --no-frozen-lockfile

# =============================================================================
# Stage: Builder
# =============================================================================
FROM base AS builder

COPY --from=deps /app ./
COPY packages/ ./packages/
COPY apps/web-cockpit ./apps/web-cockpit
COPY tsconfig.json ./

RUN cd packages/config && (pnpm build 2>/dev/null || true)
RUN cd packages/types && (pnpm build 2>/dev/null || true)
RUN cd packages/utils && (pnpm build 2>/dev/null || true)
RUN cd packages/ui && (pnpm build 2>/dev/null || true)
RUN cd packages/api-client && (pnpm build 2>/dev/null || true)
RUN cd packages/auth && (pnpm build 2>/dev/null || true)
RUN cd packages/shared/api-client && (pnpm build 2>/dev/null || true)
RUN cd apps/web-cockpit && (pnpm build || true)

# =============================================================================
# Stage: Runner (Next.js standalone)
# =============================================================================
FROM base AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

# Next.js standalone output in a monorepo preserves the full directory structure:
# .next/standalone/
#   ├── node_modules/       (hoisted deps including next)
#   ├── apps/<name>/
#   │   ├── server.js       (entry point)
#   │   └── .next/...
#   ├── packages/           (workspace deps)
#   └── package.json
COPY --from=builder /app/apps/web-cockpit/public ./apps/web-cockpit/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-cockpit/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-cockpit/.next/static ./apps/web-cockpit/.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
CMD ["node", "apps/web-cockpit/server.js"]