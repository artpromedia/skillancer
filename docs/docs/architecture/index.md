# Architecture Overview

Skillancer is a modern freelancing platform built with a microservices architecture, designed for scalability, maintainability, and developer productivity.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Client Layer                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Web App   │  │ Mobile Apps │  │  Admin UI   │  │  Public API │    │
│  │   (Next.js) │  │  (Future)   │  │  (Next.js)  │  │   Clients   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │           │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          API Gateway Layer                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Kong / AWS API Gateway                        │  │
│  │  • Rate Limiting  • Authentication  • Request Routing  • CORS    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Services Layer                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │    User     │  │   Project   │  │   Booking   │  │   Payment   │    │
│  │   Service   │  │   Service   │  │   Service   │  │   Service   │    │
│  │  (Fastify)  │  │  (Fastify)  │  │  (Fastify)  │  │  (Fastify)  │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │Notification │  │   Search    │  │   Media     │  │  Analytics  │    │
│  │   Service   │  │   Service   │  │   Service   │  │   Service   │    │
│  │  (Fastify)  │  │  (Fastify)  │  │  (Fastify)  │  │  (Fastify)  │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                       │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ PostgreSQL  │  │    Redis    │  │   AWS S3    │  │Elasticsearch│    │
│  │  (Primary)  │  │   (Cache)   │  │  (Storage)  │  │  (Search)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Principles

### 1. Microservices Architecture

Each service is:

- **Independent**: Can be deployed, scaled, and updated independently
- **Domain-focused**: Owns its data and business logic
- **API-first**: Communicates via well-defined REST APIs
- **Stateless**: Stores state in databases, not in memory

### 2. Monorepo Structure

We use a monorepo to:

- Share code efficiently via internal packages
- Ensure type safety across service boundaries
- Simplify dependency management
- Enable atomic cross-service changes

### 3. Infrastructure as Code

All infrastructure is defined using:

- **Terraform**: AWS resources provisioning
- **Docker**: Container definitions
- **Kubernetes**: Orchestration (production)
- **Docker Compose**: Local development

## Service Communication

### Synchronous Communication

Services communicate via HTTP/REST for:

- Real-time queries
- CRUD operations
- Authentication/authorization

```typescript
// Example: User service calling Project service
const response = await fetch(`${PROJECT_SERVICE_URL}/projects/${projectId}`, {
  headers: {
    Authorization: `Bearer ${token}`,
    'X-Request-ID': requestId,
  },
});
```

### Asynchronous Communication

Event-driven patterns for:

- Background processing
- Cross-service notifications
- Data synchronization

```typescript
// Example: Publishing an event
await eventBus.publish('user.created', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
});
```

## Data Architecture

### Database per Service

Each service owns its database:

| Service      | Database   | Purpose                       |
| ------------ | ---------- | ----------------------------- |
| User         | PostgreSQL | User profiles, authentication |
| Project      | PostgreSQL | Projects, gigs, categories    |
| Booking      | PostgreSQL | Orders, contracts, milestones |
| Payment      | PostgreSQL | Transactions, payouts         |
| Notification | PostgreSQL | Notifications, preferences    |

### Caching Strategy

Redis is used for:

- **Session storage**: User sessions and tokens
- **API caching**: Frequently accessed data
- **Rate limiting**: Request throttling
- **Pub/Sub**: Real-time events

### Search Architecture

Elasticsearch powers:

- Full-text search for projects/gigs
- Faceted filtering
- Autocomplete suggestions
- Analytics queries

## Security Architecture

### Authentication Flow

```
┌────────┐     ┌────────────┐     ┌─────────────┐
│ Client │────▶│ API Gateway│────▶│ User Service│
└────────┘     └────────────┘     └─────────────┘
     │                │                   │
     │  1. Login      │                   │
     │────────────────▶                   │
     │                │  2. Validate      │
     │                │──────────────────▶│
     │                │  3. JWT Token     │
     │◀───────────────│◀──────────────────│
     │                │                   │
     │  4. API Call + JWT                 │
     │────────────────▶                   │
     │                │  5. Verify JWT    │
     │                │──────────────────▶│
     │                │  6. User Context  │
     │                │◀──────────────────│
     │  7. Response   │                   │
     │◀───────────────│                   │
```

### Security Layers

1. **API Gateway**: Rate limiting, IP filtering
2. **JWT Tokens**: Stateless authentication
3. **RBAC**: Role-based access control
4. **Service Mesh**: mTLS between services
5. **Encryption**: At rest and in transit

## Deployment Architecture

### Production Environment (AWS)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         VPC                                      │   │
│  │  ┌─────────────┐  ┌─────────────────────────────────────────┐   │   │
│  │  │ CloudFront  │  │           EKS Cluster                    │   │   │
│  │  │    (CDN)    │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │   │
│  │  └──────┬──────┘  │  │ Pod 1   │ │ Pod 2   │ │ Pod N   │   │   │   │
│  │         │         │  │(Service)│ │(Service)│ │(Service)│   │   │   │
│  │         ▼         │  └────┬────┘ └────┬────┘ └────┬────┘   │   │   │
│  │  ┌─────────────┐  │       │           │           │        │   │   │
│  │  │     ALB     │◀─┼───────┴───────────┴───────────┘        │   │   │
│  │  │   (Load     │  │                                         │   │   │
│  │  │  Balancer)  │  └─────────────────────────────────────────┘   │   │
│  │  └─────────────┘                                                │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │   │
│  │  │     RDS     │  │ ElastiCache │  │     S3      │            │   │
│  │  │ (PostgreSQL)│  │   (Redis)   │  │  (Storage)  │            │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Environments

| Environment | Purpose        | Infrastructure |
| ----------- | -------------- | -------------- |
| Local       | Development    | Docker Compose |
| CI          | Testing        | GitHub Actions |
| Staging     | Pre-production | AWS (Reduced)  |
| Production  | Live           | AWS (Full)     |

## Monitoring & Observability

### Three Pillars

1. **Metrics** (Prometheus/CloudWatch)
   - Request rates, latencies, errors
   - Resource utilization
   - Business metrics

2. **Logging** (CloudWatch Logs/ELK)
   - Structured JSON logs
   - Request tracing
   - Error tracking

3. **Tracing** (AWS X-Ray/Jaeger)
   - Distributed request tracing
   - Service dependencies
   - Performance bottlenecks

## Further Reading

- [Technology Stack](./tech-stack) - Detailed breakdown of technologies
- [Architecture Decision Records](./adr/) - Key architectural decisions
- [API Reference](/api) - Service API documentation
