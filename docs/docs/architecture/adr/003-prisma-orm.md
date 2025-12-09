# ADR-003: Prisma as ORM

## Status

**Accepted**

- Date: 2024-01-18
- Deciders: Engineering Team

## Context

Our microservices need to interact with PostgreSQL databases. We need to choose a database access strategy that provides:

- Type safety with TypeScript
- Migration management
- Good developer experience
- Performance suitable for production
- Support for complex queries

### Options

1. Raw SQL with query builders
2. Prisma ORM
3. TypeORM
4. Drizzle ORM
5. Knex.js

## Decision

**We will use Prisma as our primary ORM for database access.**

```prisma
// schema.prisma
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  name      String?
  role      Role      @default(USER)
  projects  Project[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([email])
}

enum Role {
  USER
  ADMIN
  FREELANCER
  CLIENT
}
```

## Alternatives Considered

### Option A: Raw SQL / Knex.js

**Pros:**

- Full control over queries
- Best performance
- No ORM abstraction overhead
- Direct SQL knowledge applicable

**Cons:**

- No type safety
- Manual query building
- No migration tooling (Knex has some)
- More boilerplate
- SQL injection risks if not careful

### Option B: TypeORM

**Pros:**

- Mature and widely used
- Decorator-based entity definitions
- Active Record and Data Mapper patterns
- Good migration support

**Cons:**

- Complex configuration
- TypeScript types can be unreliable
- Performance issues with complex relations
- Active Record pattern can lead to tight coupling
- Maintenance concerns

### Option C: Prisma (Selected)

**Pros:**

- Excellent type safety (generated client)
- Schema-first approach
- Great migration workflow
- Visual database browser (Prisma Studio)
- Excellent documentation
- Active development and community
- Intuitive query API

**Cons:**

- Additional build step (generate)
- Some complex queries need raw SQL
- N+1 query potential (mitigated by `include`)
- Bundle size of generated client

### Option D: Drizzle ORM

**Pros:**

- Lightweight
- SQL-like syntax
- Good TypeScript support
- No code generation

**Cons:**

- Newer, less mature
- Smaller community
- Less comprehensive documentation
- Migration tooling still evolving

## Consequences

### Positive

1. **Type safety**: Auto-generated types from schema
2. **Developer experience**: Intuitive API, great IDE support
3. **Migrations**: Declarative schema changes with `prisma migrate`
4. **Debugging**: Prisma Studio for visual data exploration
5. **Relations**: Easy eager loading with `include`
6. **Consistency**: Same patterns across all services

### Negative

1. **Build step**: Must run `prisma generate` after schema changes
   - _Mitigation_: Added to build scripts, CI validates
2. **Complex queries**: Some require raw SQL via `$queryRaw`
   - _Mitigation_: Document patterns, use for edge cases only
3. **N+1 queries**: Can happen with nested relations
   - _Mitigation_: Code review, use `include` appropriately

### Neutral

- Each service has its own Prisma schema
- Shared enums/types need coordination

## Implementation

### Service Setup

```typescript
// prisma/client.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

### Migration Workflow

```bash
# Create migration
pnpm prisma migrate dev --name add_user_status

# Apply in production
pnpm prisma migrate deploy

# Reset database (dev only)
pnpm prisma migrate reset
```

### Query Patterns

```typescript
// Find with relations
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    projects: {
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    },
  },
});

// Transaction
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: userData });
  const project = await tx.project.create({
    data: { ...projectData, ownerId: user.id },
  });
  return { user, project };
});
```

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [ADR-002: Fastify Backend](./002-fastify-backend)
