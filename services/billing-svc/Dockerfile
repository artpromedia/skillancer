# =============================================================================
# Billing Service Dockerfile
# Multi-stage build for production deployment
# =============================================================================

FROM node:20.19-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY services/billing-svc/package.json ./services/billing-svc/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services/billing-svc/node_modules ./services/billing-svc/node_modules
COPY packages/config ./packages/config
COPY packages/database ./packages/database
COPY services/billing-svc ./services/billing-svc
COPY tsconfig.json ./
RUN pnpm --filter @skillancer/config build && \
    pnpm --filter @skillancer/database build && \
    pnpm --filter @skillancer/billing-svc build

FROM node:20.19-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 skillancer
WORKDIR /app
ENV NODE_ENV=production PORT=3005 HOST=0.0.0.0
COPY --from=builder --chown=skillancer:nodejs /app/services/billing-svc/dist ./dist
COPY --from=builder --chown=skillancer:nodejs /app/services/billing-svc/package.json ./
COPY --from=deps --chown=skillancer:nodejs /app/node_modules ./node_modules
USER skillancer
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3005/health || exit 1
CMD ["node", "dist/index.js"]
