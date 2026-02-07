# =============================================================================
# Web Market Dockerfile (Next.js Standalone)
# Multi-stage build for production deployment
# =============================================================================

# Stage 1: Dependencies
FROM node:20.19-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/api-client/package.json ./packages/shared/api-client/
COPY apps/web-market/package.json ./apps/web-market/

RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:20.19-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/web-market/node_modules ./apps/web-market/node_modules

COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY packages/ui ./packages/ui
COPY packages/api-client ./packages/api-client
COPY packages/shared/api-client ./packages/shared/api-client
COPY apps/web-market ./apps/web-market
COPY tsconfig.json ./

# Build workspace packages first
RUN pnpm --filter @skillancer/config build 2>/dev/null || true && \
    pnpm --filter @skillancer/types build 2>/dev/null || true && \
    pnpm --filter @skillancer/utils build 2>/dev/null || true && \
    pnpm --filter @skillancer/ui build 2>/dev/null || true && \
    pnpm --filter @skillancer/api-client build 2>/dev/null || true && \
    pnpm --filter @skillancer/shared-api-client build 2>/dev/null || true

# Build the Next.js app
RUN pnpm --filter @skillancer/web-market build

# Stage 3: Runner
FROM node:20.19-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/web-market/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-market/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-market/.next/static ./apps/web-market/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "apps/web-market/server.js"]
