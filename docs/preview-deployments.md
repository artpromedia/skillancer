# Preview Deployments Documentation

This document describes how preview deployments work for the Skillancer monorepo.

## Overview

When a Pull Request is opened, synchronized, or reopened, the preview deployment system automatically:

1. **Creates a branch database** using Neon
2. **Deploys web apps** to Vercel
3. **Deploys backend services** to Railway
4. **Comments preview URLs** on the PR

When the PR is closed, all resources are automatically cleaned up.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Preview Environment                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │     Web      │  │  Web Market  │  │ Web Cockpit  │  │ Web SkillPod │ │
│  │   (Vercel)   │  │   (Vercel)   │  │   (Vercel)   │  │   (Vercel)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │          │
│         └─────────────────┴─────────────────┴─────────────────┘          │
│                                    │                                     │
│                                    ▼                                     │
│                          ┌─────────────────┐                            │
│                          │   API Gateway   │                            │
│                          │   (Railway)     │                            │
│                          └────────┬────────┘                            │
│                                   │                                      │
│              ┌────────────────────┴────────────────────┐                │
│              │                                         │                │
│              ▼                                         ▼                │
│    ┌─────────────────┐                       ┌─────────────────┐        │
│    │  Neon Database  │                       │     Redis       │        │
│    │  (Branch)       │                       │  (Shared Pool)  │        │
│    └─────────────────┘                       └─────────────────┘        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## URLs

Preview environments use the following URL patterns:

| Service         | URL Pattern                                   |
| --------------- | --------------------------------------------- |
| Web (Marketing) | `https://web-pr-{number}.skillancer.dev`      |
| Web Market      | `https://market-pr-{number}.skillancer.dev`   |
| Web Cockpit     | `https://cockpit-pr-{number}.skillancer.dev`  |
| Web SkillPod    | `https://skillpod-pr-{number}.skillancer.dev` |
| API Gateway     | `https://api-pr-{number}.skillancer.dev`      |

## Required Secrets

Configure these secrets in GitHub repository settings:

### Neon Database

| Secret            | Description                                     |
| ----------------- | ----------------------------------------------- |
| `NEON_PROJECT_ID` | Your Neon project ID                            |
| `NEON_API_KEY`    | Neon API key with branch management permissions |

### Vercel

| Secret                           | Description                     |
| -------------------------------- | ------------------------------- |
| `VERCEL_TOKEN`                   | Vercel API token                |
| `VERCEL_ORG_ID`                  | Vercel organization ID          |
| `VERCEL_PROJECT_ID_WEB`          | Project ID for web app          |
| `VERCEL_PROJECT_ID_WEB_MARKET`   | Project ID for web-market app   |
| `VERCEL_PROJECT_ID_WEB_COCKPIT`  | Project ID for web-cockpit app  |
| `VERCEL_PROJECT_ID_WEB_SKILLPOD` | Project ID for web-skillpod app |

### Railway

| Secret               | Description                   |
| -------------------- | ----------------------------- |
| `RAILWAY_TOKEN`      | Railway API token             |
| `RAILWAY_PROJECT_ID` | Railway project ID            |
| `PREVIEW_REDIS_URL`  | Shared Redis URL for previews |

## Workflows

### preview.yml

Triggered on PR open, synchronize, or reopen:

1. **Generate Preview Info** - Creates unique preview ID
2. **Detect Changes** - Determines which apps/services changed
3. **Create Branch Database** - Creates Neon branch with migrations
4. **Deploy Web Apps** - Deploys changed web apps to Vercel
5. **Deploy Backend** - Deploys API Gateway to Railway
6. **Run E2E Tests** - Runs Playwright tests against preview
7. **Comment URLs** - Posts preview URLs on PR

### preview-cleanup.yml

Triggered on PR close:

1. **Delete Neon Branch** - Removes the database branch
2. **Delete Railway Environment** - Removes preview services
3. **Delete Vercel Deployments** - Removes preview deployments
4. **Comment Cleanup** - Confirms cleanup on PR

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose

### Using Local Preview Script

**Linux/macOS:**

```bash
./scripts/preview-local.sh [PR_NUMBER]
```

**Windows:**

```powershell
.\scripts\preview-local.ps1 [PR_NUMBER]
```

### Using Docker Compose

```bash
# Start infrastructure
docker compose -f docker-compose.preview.yml up -d

# Run migrations
pnpm db:migrate:deploy

# Start services
pnpm dev
```

### Environment Variables

For local preview testing, set these environment variables:

```bash
# Database (optional - uses local PostgreSQL by default)
export NEON_API_KEY="your-neon-api-key"
export NEON_PROJECT_ID="your-neon-project-id"

# Or use local database
export DATABASE_URL="postgresql://skillancer:skillancer@localhost:5432/skillancer_preview"

# Redis
export REDIS_URL="redis://localhost:6379"

# Preview mode
export NODE_ENV="preview"
export PREVIEW_MODE="true"
```

## Vercel Configuration

Each web app has a `vercel.json` file that configures:

- **Build Command**: Uses Turborepo to build the specific app
- **Install Command**: Uses pnpm with frozen lockfile
- **Environment Variables**: Database URL, API URL, etc.
- **Security Headers**: X-Frame-Options, CSP, etc.

Example:

```json
{
  "framework": "nextjs",
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=web",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "env": {
    "DATABASE_URL": "@database-url",
    "NEXT_PUBLIC_API_URL": "@api-url"
  }
}
```

## Railway Configuration

Each service has a `railway.toml` file that configures:

- **Build**: Dockerfile or Nixpacks configuration
- **Deploy**: Health checks, restart policies, replicas
- **Environments**: Preview vs production settings

Example:

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "on_failure"
```

## Cost Optimization

Preview environments can incur costs. Here's how we optimize:

1. **Change Detection**: Only deploy apps/services that changed
2. **Automatic Cleanup**: Resources deleted when PR closes
3. **Orphan Cleanup**: Weekly job removes abandoned previews
4. **Shared Redis**: Previews share a Redis instance
5. **Neon Branching**: Database branches are cheap and fast

## Troubleshooting

### Preview Deployment Failed

1. Check GitHub Actions logs for specific error
2. Verify all secrets are configured
3. Check Neon/Vercel/Railway dashboards for quotas

### Database Migration Failed

1. Check if Neon branch was created successfully
2. Verify migration files are valid
3. Check DATABASE_URL is properly set

### Health Check Failed

1. Check if service started successfully
2. Verify `/health` endpoint exists
3. Check logs for startup errors

### Preview Not Cleaned Up

1. Check preview-cleanup workflow ran
2. Manually delete resources from dashboards
3. Run orphan cleanup workflow

## Best Practices

1. **Keep PRs focused**: Smaller PRs = faster previews
2. **Test locally first**: Use `preview-local.sh` before pushing
3. **Check preview comments**: Verify deployment succeeded
4. **Close stale PRs**: Frees up preview resources
5. **Monitor costs**: Check provider dashboards regularly

## Related Documentation

- [Neon Branching](https://neon.tech/docs/guides/branching)
- [Vercel Previews](https://vercel.com/docs/concepts/deployments/preview-deployments)
- [Railway Environments](https://docs.railway.app/develop/environments)
