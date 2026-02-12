# Skillancer Platform

A monorepo containing the Skillancer platform products:

- **SkillPod**: Browser-based VDI for secure computing environments
- **Skillancer Market**: Hybrid talent marketplace
- **Cockpit**: Multi-tenant dashboard for fractional executives

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose (for local services)

## Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:artpromedia/skillancer.git
cd skillancer
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 4. Start development

```bash
pnpm dev
```

## Project Structure

```
skillancer/
├── apps/                       # Frontend applications
│   ├── web/                    # Marketing & shared shell (Next.js)
│   ├── web-market/             # Skillancer Market (Next.js)
│   ├── web-cockpit/            # Cockpit dashboard (Next.js)
│   ├── web-skillpod/           # SkillPod admin/viewer (Next.js)
│   └── mobile/                 # Mobile app (Flutter)
├── services/                   # Backend microservices
│   ├── api-gateway/            # API Gateway / BFF
│   ├── auth-svc/               # Authentication service
│   ├── billing-svc/            # Billing & payments
│   ├── market-svc/             # Marketplace logic
│   ├── skillpod-svc/           # VDI management
│   ├── cockpit-svc/            # Cockpit integrations
│   ├── notification-svc/       # Push & email notifications
│   └── audit-svc/              # Audit logging
├── packages/                   # Shared packages
│   ├── ui/                     # Shared React components
│   ├── api-client/             # Generated API client
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Shared utilities
│   ├── config/                 # Shared configs (ESLint, TS, etc.)
│   ├── database/               # Prisma schema & migrations
│   └── cache/                  # Redis cache utilities
├── infrastructure/             # Infrastructure as Code
│   ├── terraform/              # Terraform definitions
│   └── docker/                 # Dockerfiles & compose
├── docs/                       # Documentation
└── scripts/                    # Build & utility scripts
```

## Available Scripts

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| `pnpm dev`         | Start all apps in development mode |
| `pnpm build`       | Build all apps and packages        |
| `pnpm test`        | Run all tests                      |
| `pnpm lint`        | Lint all packages                  |
| `pnpm format`      | Format code with Prettier          |
| `pnpm typecheck`   | Run TypeScript type checking       |
| `pnpm clean`       | Clean all build outputs            |
| `pnpm db:generate` | Generate Prisma client             |
| `pnpm db:migrate`  | Run database migrations            |
| `pnpm db:seed`     | Seed the database                  |

### Running specific apps or services

```bash
# Run a specific app
pnpm dev --filter=@skillancer/web-market

# Run multiple apps
pnpm dev --filter=@skillancer/web-market --filter=@skillancer/market-svc

# Run all apps matching a pattern
pnpm dev --filter="@skillancer/web-*"
```

## Remote Caching

This monorepo is configured for remote caching with Turborepo.

### Vercel Remote Cache (Recommended)

1. Create a Vercel account and link your repository
2. Generate a Turbo token from your Vercel dashboard
3. Set environment variables:

```bash
export TURBO_TOKEN=your_token_here
export TURBO_TEAM=your_team_name
```

Or add to your `.env.local`:

```env
TURBO_TOKEN=your_token_here
TURBO_TEAM=your_team_name
```

### Self-Hosted Cache (S3)

For self-hosted remote caching using S3:

1. Create an S3 bucket for cache storage
2. Configure your environment:

```bash
export TURBO_API=http://your-cache-server:3000
export TURBO_TOKEN=your_auth_token
export TURBO_TEAM=your_team_name
```

3. Deploy a cache server using [turbo-remote-cache](https://github.com/ducktors/turborepo-remote-cache)

## Development Guidelines

### Adding a new package

1. Create the package directory in the appropriate location
2. Initialize with a `package.json`:

```json
{
  "name": "@skillancer/your-package",
  "version": "0.0.1",
  "private": true
}
```

3. Run `pnpm install` to update the workspace

### Code Style

- We use ESLint for linting
- Prettier for code formatting
- Commit messages follow Conventional Commits

### Testing

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm test --filter=@skillancer/utils

# Run tests in watch mode
pnpm test --filter=@skillancer/utils -- --watch
```

## Documentation

### User Guides

- [Freelancer Quick Start](docs/user-guide/getting-started/freelancer-quickstart.md)
- [Client Quick Start](docs/user-guide/getting-started/client-quickstart.md)
- [SkillPod Guide](docs/user-guide/features/skillpod-guide.md)
- [Cockpit Guide](docs/user-guide/features/cockpit-guide.md)
- [Verification Guide](docs/user-guide/features/verification-guide.md)

### API Documentation

- [API Overview](docs/api/overview.md)
- [Jobs API](docs/api/endpoints/jobs.md)
- [Proposals API](docs/api/endpoints/proposals.md)
- [Contracts API](docs/api/endpoints/contracts.md)
- [Webhooks](docs/api/webhooks.md)

### Operations Runbooks

- [Incident Response](docs/runbooks/incident-response.md)
- [Deployment](docs/runbooks/deployment.md)
- [Database Operations](docs/runbooks/database-operations.md)
- [Scaling](docs/runbooks/scaling.md)
- [Security Incidents](docs/runbooks/security-incident.md)
- [SkillPod Operations](docs/runbooks/skillpod-operations.md)

### Launch Documentation

- [Launch Checklist](docs/launch/launch-checklist.md)
- [Launch Communication Plan](docs/launch/launch-communication.md)
- [Rollback Plan](docs/launch/rollback-plan.md)
- [Week 1 Priorities](docs/launch/week-1-priorities.md)
- [Success Metrics](docs/launch/success-metrics.md)

### Legal & Compliance

- [GDPR Compliance](docs/legal/gdpr-compliance.md)
- [Data Retention Policy](docs/legal/data-retention-policy.md)

### Support

- [Common Issues](docs/support/common-issues.md)
- [Escalation Matrix](docs/support/escalation-matrix.md)

## Production Infrastructure

**🚀 Now Running on Hetzner Cloud!**

As of February 2026, Skillancer has migrated from AWS to Hetzner Cloud + Cloudflare R2:

- **90% cost reduction** ($800/mo → $82/mo)
- **Zero vendor lock-in** (cloud-agnostic architecture)
- **HIPAA compliant** (AES-256-GCM encryption)
- **EU data residency** (Hetzner Frankfurt datacenter)

**Migration Documentation:**

- [Post-Implementation Steps](POST_IMPLEMENTATION_STEPS.md) - Setup & deployment guide
- [Quick Start](QUICK_START.md) - 10-minute setup
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md) - What changed
- [Complete Guide](PHASE_1_3_IMPLEMENTATION_COMPLETE.md) - Comprehensive reference

### Infrastructure Stack

**Compute:** Hetzner Cloud K3s (Kubernetes)  
**Object Storage:** Cloudflare R2 (S3-compatible, zero egress fees)  
**Block Storage:** Hetzner Cloud Volumes API  
**Database:** PostgreSQL 16 (self-hosted on Hetzner)  
**Cache:** Redis 7 (self-hosted on Hetzner)  
**CDN:** Cloudflare (global edge network)  
**Encryption:** Node.js crypto (AES-256-GCM + PBKDF2)

### Infrastructure as Code

- Hetzner Terraform: `infrastructure/hetzner/terraform/`
- Cloudflare Terraform: `infrastructure/cloudflare/terraform/`
- Kubernetes manifests: `infrastructure/kubernetes/production/`
- Deployment scripts: `scripts/deploy-hetzner.sh`

### Production Checklists

- [Security Checklist](infrastructure/production/security-checklist.md)
- [Performance Checklist](infrastructure/production/performance-checklist.md)
- [Monitoring Setup](infrastructure/production/monitoring-setup.md)

## Database Scripts

```bash
# Seed production data
pnpm db:seed:production

# Seed demo data (staging only)
pnpm db:seed:demo

# Verify migration integrity
pnpm db:verify
```

## License

Copyright © 2024 Skillancer. All rights reserved.
