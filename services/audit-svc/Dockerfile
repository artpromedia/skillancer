# =============================================================================
# Audit Service Dockerfile
# Multi-stage build for production deployment
# =============================================================================

FROM node:20.19-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY services/audit-svc/package.json ./services/audit-svc/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services/audit-svc/node_modules ./services/audit-svc/node_modules
COPY packages/config ./packages/config
COPY packages/database ./packages/database
COPY services/audit-svc ./services/audit-svc
COPY tsconfig.json ./
RUN pnpm --filter @skillancer/config build && \
    pnpm --filter @skillancer/database build && \
    pnpm --filter @skillancer/audit-svc build

FROM node:20.19-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 skillancer
WORKDIR /app
ENV NODE_ENV=production PORT=3012 HOST=0.0.0.0
COPY --from=builder --chown=skillancer:nodejs /app/services/audit-svc/dist ./dist
COPY --from=builder --chown=skillancer:nodejs /app/services/audit-svc/package.json ./
COPY --from=deps --chown=skillancer:nodejs /app/node_modules ./node_modules
USER skillancer
EXPOSE 3012
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3012/health || exit 1
CMD ["node", "dist/index.js"]
