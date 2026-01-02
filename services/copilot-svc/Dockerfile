# =============================================================================
# Copilot Service Dockerfile
# Multi-stage build for production deployment
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base with pnpm
# -----------------------------------------------------------------------------
FROM node:20.19-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

# Copy root package files for workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all workspace packages this service depends on
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY services/copilot-svc/package.json ./services/copilot-svc/

# Install dependencies
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Builder
# -----------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services/copilot-svc/node_modules ./services/copilot-svc/node_modules

# Copy source files
COPY packages/config ./packages/config
COPY packages/database ./packages/database
COPY services/copilot-svc ./services/copilot-svc
COPY tsconfig.json ./

# Build packages and service
RUN pnpm --filter @skillancer/config build && \
    pnpm --filter @skillancer/database build && \
    pnpm --filter @skillancer/copilot-svc build

# -----------------------------------------------------------------------------
# Stage 4: Runner (Production)
# -----------------------------------------------------------------------------
FROM node:20.19-alpine AS runner

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 skillancer

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3010 \
    HOST=0.0.0.0

# Copy production files
COPY --from=builder --chown=skillancer:nodejs /app/services/copilot-svc/dist ./dist
COPY --from=builder --chown=skillancer:nodejs /app/services/copilot-svc/package.json ./
COPY --from=deps --chown=skillancer:nodejs /app/node_modules ./node_modules

USER skillancer

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3010/health || exit 1

CMD ["node", "dist/index.js"]
