# Authentication Service

Handles user authentication, authorization, and session management.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: PostgreSQL (via Prisma)

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/auth-svc

# Or from this directory
pnpm dev
```

## Features

- User registration and login
- JWT token management
- OAuth2 / Social login
- MFA support
- Role-based access control (RBAC)
- Session management
