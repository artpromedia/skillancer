# Cockpit Service

Backend service for the Cockpit executive dashboard.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma)

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/cockpit-svc

# Or from this directory
pnpm dev
```

## Features

- Multi-tenant workspace management
- Third-party integrations (Slack, etc.)
- Analytics aggregation
- Custom reporting
- Data sync and ETL
