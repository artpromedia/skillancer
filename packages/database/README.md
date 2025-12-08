# Database Package

Prisma schema and database utilities for the Skillancer platform.

## Tech Stack

- **ORM**: Prisma
- **Database**: PostgreSQL

## Getting Started

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Open Prisma Studio
pnpm db:studio
```

## Usage

```typescript
import { prisma } from '@skillancer/database';

const users = await prisma.user.findMany();
```

## Structure

```
database/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── client.ts
│   └── index.ts
└── package.json
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/skillancer?schema=public"
```
