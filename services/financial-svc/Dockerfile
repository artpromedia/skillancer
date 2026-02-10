# =============================================================================
# Financial Service Dockerfile
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
COPY services/financial-svc/package.json ./services/financial-svc/

# Copy Prisma schema for postinstall (prisma generate)
COPY packages/database/prisma ./packages/database/prisma

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
COPY --from=deps /app/services/financial-svc/node_modules ./services/financial-svc/node_modules

# Copy source files
COPY packages/config ./packages/config
COPY packages/database ./packages/database
COPY services/financial-svc ./services/financial-svc
COPY tsconfig.json ./

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# Build packages and service
RUN pnpm --filter @skillancer/config build && \
    pnpm --filter @skillancer/database build && \
    pnpm --filter @skillancer/financial-svc build

# -----------------------------------------------------------------------------
# Stage 4: Runner (Production)
# -----------------------------------------------------------------------------
FROM node:20.19-alpine AS runner

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 skillancer

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3008 \
    HOST=0.0.0.0

# Copy production files
COPY --from=builder --chown=skillancer:nodejs /app/services/financial-svc/dist ./dist
COPY --from=builder --chown=skillancer:nodejs /app/services/financial-svc/package.json ./
COPY --from=deps --chown=skillancer:nodejs /app/node_modules ./node_modules

USER skillancer

EXPOSE 3008

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3008/health || exit 1

CMD ["node", "dist/index.js"]
