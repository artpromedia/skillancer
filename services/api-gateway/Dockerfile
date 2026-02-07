# =============================================================================
# API Gateway Dockerfile
# Multi-stage build for production deployment
# Build from project root: docker build -f services/api-gateway/Dockerfile .
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
COPY packages/metrics/package.json ./packages/metrics/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY services/api-gateway/package.json ./services/api-gateway/

# Copy Prisma schema for postinstall (prisma generate)
COPY packages/database/prisma ./packages/database/prisma
COPY packages/database/package.json ./packages/database/

# Set dummy DATABASE_URL for Prisma client generation during postinstall
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Install dependencies
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 3: Builder
# -----------------------------------------------------------------------------
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services/api-gateway/node_modules ./services/api-gateway/node_modules

# Copy source files
COPY packages/config ./packages/config
COPY packages/metrics ./packages/metrics
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY services/api-gateway ./services/api-gateway
COPY tsconfig.json ./

# Build packages and service
RUN pnpm --filter @skillancer/config build && \
    pnpm --filter @skillancer/types build && \
    pnpm --filter @skillancer/utils build && \
    pnpm --filter @skillancer/metrics build && \
    pnpm --filter @skillancer/api-gateway build

# -----------------------------------------------------------------------------
# Stage 4: Runner (Production)
# -----------------------------------------------------------------------------
FROM node:20.19-alpine AS runner

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gateway

WORKDIR /app

# Set environment
ENV NODE_ENV=production \
    PORT=4000 \
    HOST=0.0.0.0

# Copy production files
COPY --from=builder --chown=gateway:nodejs /app/services/api-gateway/dist ./dist
COPY --from=builder --chown=gateway:nodejs /app/services/api-gateway/package.json ./
COPY --from=deps --chown=gateway:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER gateway

# Expose the port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health/live || exit 1

# Start the application
CMD ["node", "dist/index.js"]
