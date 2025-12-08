# Audit Service

Centralized audit logging and compliance tracking service.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript
- **Storage**: PostgreSQL + S3 (for archival)

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/audit-svc

# Or from this directory
pnpm dev
```

## Features

- Action logging
- User activity tracking
- Compliance reporting
- Data retention policies
- Log search and filtering
- Export capabilities
