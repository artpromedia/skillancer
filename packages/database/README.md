# @skillancer/database

Shared database package for the Skillancer monorepo using Prisma ORM with PostgreSQL.

## Features

- 🗃️ **Complete Prisma Schema** - 25+ models covering all domain entities
- 🔄 **Soft Delete Extension** - Automatic filtering and restoration of soft-deleted records
- 📝 **Audit Log Extension** - Automatic logging of all CRUD operations with user context
- 🌱 **Comprehensive Seed Script** - Generate realistic test data for development
- 🏢 **Multi-Tenant Support** - Built-in tenant isolation and management
- 🔍 **Full-Text Search** - PostgreSQL `pg_trgm` extension for fuzzy search

## Installation

```bash
pnpm add @skillancer/database
```

## Quick Start

### 1. Configure Database URL

Create a `.env` file in the package root or project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/skillancer?schema=public"
```

### 2. Generate Prisma Client

```bash
pnpm db:generate
```

### 3. Run Migrations

For development:

```bash
pnpm db:migrate:dev
```

For production:

```bash
pnpm db:migrate:deploy
```

### 4. Seed the Database (Development)

```bash
pnpm db:seed
```

## Usage

### Basic Usage

```typescript
import { prisma } from '@skillancer/database';

// Query users
const users = await prisma.user.findMany({
  where: { status: 'ACTIVE' },
  include: { skills: true },
});

// Create a job
const job = await prisma.job.create({
  data: {
    clientId: 'user-id',
    title: 'Build a React App',
    description: 'Full-stack React application...',
    status: 'PUBLISHED',
    budgetType: 'FIXED',
    budgetMin: 5000,
    budgetMax: 10000,
  },
});
```

### Using Extensions

#### Soft Delete Extension

```typescript
import { prisma } from '@skillancer/database';
import { softDeleteExtension, restoreById, withDeleted } from '@skillancer/database/extensions';

// Create extended client
const db = prisma.$extends(softDeleteExtension);

// Regular queries automatically exclude soft-deleted records
const activeUsers = await db.user.findMany(); // Only non-deleted

// Soft delete a user (sets deletedAt instead of removing)
await db.user.delete({ where: { id: 'user-id' } });

// Restore a soft-deleted record
await restoreById(prisma, 'user', 'user-id');

// Query including deleted records
const allUsers = await withDeleted(prisma.user.findMany());
```

#### Audit Log Extension

```typescript
import { prisma } from '@skillancer/database';
import {
  auditLogExtension,
  setAuditContext,
  getAuditHistory
} from '@skillancer/database/extensions';

// Create extended client
const db = prisma.$extends(auditLogExtension);

// Set audit context (usually in middleware)
setAuditContext({
  userId: 'current-user-id',
  userAgent: 'Mozilla/5.0...',
  ipAddress: '192.168.1.1',
});

// All CRUD operations are automatically logged
await db.job.create({
  data: { title: 'New Job', ... }
}); // Audit log created automatically

// Query audit history
const history = await getAuditHistory(prisma, 'job', 'job-id');
```

### Type Exports

```typescript
import type { User, Job, Contract, DatabaseClient, TransactionClient } from '@skillancer/database';

// Use in your application
function createUser(data: Prisma.UserCreateInput): Promise<User> {
  return prisma.user.create({ data });
}
```

## Available Scripts

| Script                   | Description                       |
| ------------------------ | --------------------------------- |
| `pnpm build`             | Build the package                 |
| `pnpm db:generate`       | Generate Prisma Client            |
| `pnpm db:migrate:dev`    | Run migrations in development     |
| `pnpm db:migrate:deploy` | Run migrations in production      |
| `pnpm db:push`           | Push schema changes (development) |
| `pnpm db:seed`           | Seed database with test data      |
| `pnpm db:reset`          | Reset database (drop all data)    |
| `pnpm db:studio`         | Open Prisma Studio                |

## Schema Overview

### Core Entities

- **User** - User accounts with verification levels
- **Tenant** - Organizations/teams with plans
- **TenantMember** - User membership in tenants

### Jobs & Bidding

- **Job** - Job postings with skills, budget, and status
- **JobSkill** - Skills required for jobs
- **Bid** - Freelancer proposals on jobs
- **Contract** - Agreements between clients and freelancers
- **Milestone** - Contract deliverables with payments

### Services

- **Service** - Freelancer service offerings with tiers
- **ServiceSkill** - Skills associated with services

### Communication

- **Session** - Video/audio call sessions
- **Message** - Direct messages between users

### Payments

- **Payment** - Transaction records
- **PaymentMethod** - User payment methods
- **Invoice** - Billing invoices

### Trust & Reviews

- **Review** - User reviews and ratings
- **TrustScore** - Calculated trust metrics

### System

- **Skill** - Skill definitions and categories
- **UserSkill** - User skill endorsements
- **Notification** - User notifications
- **AuditLog** - System audit trail
- **RefreshToken** - Auth token management

## Enums

```typescript
// User status
type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

// Job status
type JobStatus = 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// Contract status
type ContractStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISPUTED' | 'CANCELLED';

// And more...
```

## Development

### Prisma Studio

Browse and edit data visually:

```bash
pnpm db:studio
```

### Reset Database

Drop all data and re-run migrations:

```bash
pnpm db:reset
pnpm db:seed
```

### Generate New Migration

After modifying `schema.prisma`:

```bash
pnpm db:migrate:dev --name your_migration_name
```

## Best Practices

1. **Always use the singleton client** - Import `prisma` from the package
2. **Set audit context** - Always set user context in your middleware
3. **Handle soft deletes** - Use the extension for consistent behavior
4. **Use transactions** - For multi-step operations

```typescript
import { prisma } from '@skillancer/database';

// Transaction example
const result = await prisma.$transaction(async (tx) => {
  const job = await tx.job.create({ data: {...} });
  const notification = await tx.notification.create({
    data: { userId: 'client-id', type: 'JOB_CREATED', ... }
  });
  return { job, notification };
});
```

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/skillancer?schema=public"
```

## License

MIT
