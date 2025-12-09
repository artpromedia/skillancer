# Service APIs

Individual API documentation for each Skillancer microservice.

## Services Overview

| Service                                | Description                        | Status    |
| -------------------------------------- | ---------------------------------- | --------- |
| [User Service](./user)                 | Authentication, profiles, settings | ✅ Active |
| [Project Service](./project)           | Projects, gigs, categories         | ✅ Active |
| [Booking Service](./booking)           | Orders, contracts, milestones      | ✅ Active |
| [Payment Service](./payment)           | Transactions, payouts              | ✅ Active |
| [Notification Service](./notification) | Notifications, emails              | ✅ Active |
| [Search Service](./search)             | Full-text search                   | ✅ Active |
| [Media Service](./media)               | File uploads, images               | ✅ Active |

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            API Gateway                                   │
│                     (Rate Limiting, Auth, Routing)                      │
├─────────────────────────────────────────────────────────────────────────┤
│         │              │              │              │                  │
│         ▼              ▼              ▼              ▼                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐      │
│  │    User     │ │   Project   │ │   Booking   │ │   Payment   │      │
│  │   Service   │ │   Service   │ │   Service   │ │   Service   │      │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘      │
│         │              │              │              │                  │
│         └──────────────┴──────────────┴──────────────┘                  │
│                              │                                          │
│                              ▼                                          │
│                    ┌─────────────────┐                                  │
│                    │    PostgreSQL   │                                  │
│                    │     + Redis     │                                  │
│                    └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Common Endpoints

All services expose these common endpoints:

### Health Check

```http
GET /{service}/health
```

**Response:**

```json
{
  "status": "ok",
  "version": "1.2.3",
  "uptime": 123456
}
```

### Metrics (Internal)

```http
GET /{service}/metrics
```

Returns Prometheus-format metrics.

## API Versioning

APIs are versioned via URL path:

```
https://api.skillancer.com/user/v1/users
https://api.skillancer.com/user/v2/users  (future)
```

Current version: **v1**

## Select a Service

Choose a service to view detailed API documentation:

- **[User Service](./user)** - User management and authentication
- **[Project Service](./project)** - Project and gig management
- **[Booking Service](./booking)** - Order and contract management
- **[Payment Service](./payment)** - Payment processing
- **[Notification Service](./notification)** - Notification delivery
