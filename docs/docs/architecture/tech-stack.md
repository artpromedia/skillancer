# Technology Stack

This document provides a comprehensive overview of the technologies used in Skillancer, including the rationale for each choice.

## Overview

| Layer          | Technology     | Purpose                   |
| -------------- | -------------- | ------------------------- |
| Frontend       | Next.js 14     | Web application framework |
| Backend        | Fastify        | API services              |
| Database       | PostgreSQL     | Primary data store        |
| Cache          | Redis          | Caching and sessions      |
| Search         | Elasticsearch  | Full-text search          |
| Storage        | AWS S3         | File storage              |
| Infrastructure | Terraform      | Infrastructure as Code    |
| Container      | Docker         | Containerization          |
| Orchestration  | Kubernetes     | Container orchestration   |
| CI/CD          | GitHub Actions | Automation                |

## Frontend

### Next.js 14

**Why Next.js?**

- Server-side rendering for SEO
- App Router for modern routing patterns
- React Server Components for performance
- Built-in API routes
- Excellent TypeScript support

```typescript
// Example: Server Component
export default async function ProjectPage({ params }: Props) {
  const project = await getProject(params.id);

  return (
    <div>
      <h1>{project.title}</h1>
      <ProjectDetails project={project} />
    </div>
  );
}
```

### React 18

**Key Features Used:**

- Concurrent rendering
- Suspense for data fetching
- Server Components
- Transitions for better UX

### TailwindCSS

**Why TailwindCSS?**

- Utility-first approach
- Consistent design system
- Excellent performance (purged CSS)
- Great developer experience

```tsx
// Example: Tailwind styling
<button className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700">
  Submit
</button>
```

### Additional Frontend Libraries

| Library         | Purpose                 |
| --------------- | ----------------------- |
| React Query     | Server state management |
| Zustand         | Client state management |
| React Hook Form | Form handling           |
| Zod             | Schema validation       |
| Radix UI        | Accessible components   |

## Backend

### Fastify

**Why Fastify?**

- High performance (benchmarks show 2x faster than Express)
- Native TypeScript support
- Schema-based validation
- Plugin architecture
- Automatic OpenAPI generation

```typescript
// Example: Fastify route
fastify.post(
  '/users',
  {
    schema: {
      body: CreateUserSchema,
      response: {
        201: UserResponseSchema,
      },
    },
  },
  async (request, reply) => {
    const user = await createUser(request.body);
    return reply.code(201).send(user);
  }
);
```

### TypeScript

**Configuration:**

- Strict mode enabled
- Path mapping for clean imports
- Shared types across packages

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Additional Backend Libraries

| Library          | Purpose            |
| ---------------- | ------------------ |
| Prisma           | Database ORM       |
| Zod              | Runtime validation |
| Jose             | JWT handling       |
| Pino             | Logging            |
| @fastify/swagger | API documentation  |

## Database

### PostgreSQL 15

**Why PostgreSQL?**

- ACID compliance
- Complex query support
- JSON/JSONB for flexible data
- Full-text search capabilities
- Excellent scalability

**Key Features Used:**

- JSONB columns for flexible schemas
- Generated columns for computed values
- Row-level security (future)
- Partitioning for large tables

```sql
-- Example: Table with JSONB
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Example: Index for JSONB
CREATE INDEX idx_projects_metadata ON projects USING gin (metadata);
```

### Prisma ORM

**Why Prisma?**

- Type-safe database queries
- Automatic migrations
- Schema-first approach
- Excellent developer experience

```prisma
// Example: Prisma schema
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  projects  Project[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Caching

### Redis

**Why Redis?**

- Sub-millisecond latency
- Rich data structures
- Pub/Sub for real-time features
- Session storage
- Rate limiting

**Use Cases:**

```typescript
// Session storage
await redis.set(`session:${sessionId}`, JSON.stringify(session), 'EX', 3600);

// Rate limiting
const count = await redis.incr(`ratelimit:${ip}`);
if (count === 1) {
  await redis.expire(`ratelimit:${ip}`, 60);
}

// Caching
const cached = await redis.get(`user:${userId}`);
if (cached) return JSON.parse(cached);
```

## Search

### Elasticsearch

**Why Elasticsearch?**

- Powerful full-text search
- Faceted search support
- Real-time indexing
- Scalable architecture

**Use Cases:**

- Project/gig search
- User search
- Autocomplete
- Analytics

```typescript
// Example: Search query
const results = await elastic.search({
  index: 'projects',
  body: {
    query: {
      bool: {
        must: [{ match: { title: searchQuery } }, { term: { status: 'active' } }],
        filter: [{ range: { budget: { gte: minBudget, lte: maxBudget } } }],
      },
    },
    aggs: {
      categories: { terms: { field: 'category.keyword' } },
    },
  },
});
```

## Storage

### AWS S3

**Why S3?**

- Highly durable (99.999999999%)
- Cost-effective
- CDN integration via CloudFront
- Lifecycle policies

**Use Cases:**

- User avatars
- Project attachments
- Portfolio media
- Document storage

```typescript
// Example: S3 upload
const command = new PutObjectCommand({
  Bucket: 'skillancer-uploads',
  Key: `users/${userId}/avatar.jpg`,
  Body: fileBuffer,
  ContentType: 'image/jpeg',
});
await s3Client.send(command);
```

## Infrastructure

### Terraform

**Why Terraform?**

- Infrastructure as Code
- Multi-provider support
- State management
- Plan/apply workflow

```hcl
# Example: RDS instance
resource "aws_db_instance" "main" {
  identifier           = "skillancer-db"
  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.t3.medium"
  allocated_storage    = 100
  storage_encrypted    = true

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}
```

### Docker

**Why Docker?**

- Consistent environments
- Easy local development
- Production parity
- Fast deployments

```dockerfile
# Example: Multi-stage Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/server.js"]
```

### Kubernetes (EKS)

**Why Kubernetes?**

- Container orchestration
- Auto-scaling
- Self-healing
- Rolling deployments

```yaml
# Example: Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    spec:
      containers:
        - name: user-service
          image: skillancer/user-service:latest
          resources:
            requests:
              memory: '256Mi'
              cpu: '100m'
            limits:
              memory: '512Mi'
              cpu: '500m'
```

## CI/CD

### GitHub Actions

**Why GitHub Actions?**

- Native GitHub integration
- YAML configuration
- Marketplace actions
- Matrix builds

**Workflows:**

1. **CI**: Lint, test, build on PRs
2. **CD**: Deploy on merge to main
3. **Release**: Version and publish
4. **Docs**: Deploy documentation

## Development Tools

### Monorepo Tools

| Tool       | Purpose             |
| ---------- | ------------------- |
| pnpm       | Package management  |
| Turborepo  | Build orchestration |
| Changesets | Version management  |

### Code Quality

| Tool        | Purpose           |
| ----------- | ----------------- |
| ESLint      | Linting           |
| Prettier    | Formatting        |
| TypeScript  | Type checking     |
| Husky       | Git hooks         |
| lint-staged | Pre-commit checks |

### Testing

| Tool       | Purpose                |
| ---------- | ---------------------- |
| Vitest     | Unit/integration tests |
| Playwright | E2E tests              |
| MSW        | API mocking            |
| Faker      | Test data              |

## Version Matrix

| Technology | Version | Support Until |
| ---------- | ------- | ------------- |
| Node.js    | 20 LTS  | April 2026    |
| TypeScript | 5.x     | Current       |
| PostgreSQL | 15      | November 2027 |
| Redis      | 7.x     | Current       |
| Next.js    | 14      | Current       |
| React      | 18      | Current       |

## Further Reading

- [Architecture Overview](./index) - System architecture
- [ADRs](./adr/) - Decision records for technology choices
- [Project Structure](/getting-started/project-structure) - Codebase organization
