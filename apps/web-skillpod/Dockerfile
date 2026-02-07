# =============================================================================
# Web SkillPod Dockerfile (Next.js Standalone)
# =============================================================================

FROM node:20.19-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/config/package.json ./packages/config/
COPY apps/web-skillpod/package.json ./apps/web-skillpod/

RUN pnpm install --frozen-lockfile

FROM node:20.19-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/web-skillpod/node_modules ./apps/web-skillpod/node_modules

COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/utils ./packages/utils
COPY packages/ui ./packages/ui
COPY packages/api-client ./packages/api-client
COPY apps/web-skillpod ./apps/web-skillpod
COPY tsconfig.json ./

RUN pnpm --filter @skillancer/config build 2>/dev/null || true && \
    pnpm --filter @skillancer/types build 2>/dev/null || true && \
    pnpm --filter @skillancer/utils build 2>/dev/null || true && \
    pnpm --filter @skillancer/ui build 2>/dev/null || true && \
    pnpm --filter @skillancer/api-client build 2>/dev/null || true

RUN pnpm --filter @skillancer/web-skillpod build

FROM node:20.19-alpine AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
WORKDIR /app

ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

COPY --from=builder --chown=nextjs:nodejs /app/apps/web-skillpod/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web-skillpod/.next/static ./apps/web-skillpod/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "apps/web-skillpod/server.js"]
