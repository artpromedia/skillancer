# API Gateway

The central entry point for all Skillancer client traffic. Routes requests to downstream microservices, enforces authentication, applies rate limiting, and implements circuit breaker patterns for resilience.

## Features

- **Request Routing** - Proxies requests to 6 downstream services
- **Authentication** - JWT validation with configurable auth modes (required, optional, none)
- **Rate Limiting** - Per-user and per-IP rate limiting with configurable limits
- **Circuit Breaker** - Protects downstream services from cascading failures
- **BFF (Backend for Frontend)** - Aggregation endpoints for optimized client data fetching
- **Security** - CORS, Helmet security headers, request validation
- **Observability** - Structured logging, request tracing, health checks
- **API Documentation** - OpenAPI/Swagger documentation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            API Gateway                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         Middleware Layer                          │  │
│  │  ┌────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ │  │
│  │  │  CORS  │ │  Helmet  │ │ Rate Limit│ │   Auth   │ │ Logger  │ │  │
│  │  └────────┘ └──────────┘ └───────────┘ └──────────┘ └─────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         Routing Layer                             │  │
│  │  ┌────────────────────┐  ┌─────────────────────────────────────┐ │  │
│  │  │   BFF Aggregation  │  │        Service Proxy Routes         │ │  │
│  │  │  - /dashboard      │  │  - /api/auth/* → auth-svc           │ │  │
│  │  │  - /market-overview│  │  - /api/market/* → market-svc       │ │  │
│  │  └────────────────────┘  │  - /api/skillpods/* → skillpod-svc  │ │  │
│  │                          │  - /api/cockpit/* → cockpit-svc     │ │  │
│  │                          │  - /api/billing/* → billing-svc     │ │  │
│  │                          │  - /api/notifications/* → notif-svc │ │  │
│  │                          └─────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Circuit Breaker Layer                         │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │  │
│  │  │   CLOSED     │ │    OPEN      │ │  HALF-OPEN   │              │  │
│  │  │  (normal)    │ │ (rejecting)  │ │  (probing)   │              │  │
│  │  └──────────────┘ └──────────────┘ └──────────────┘              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+

### Installation

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Start development server
pnpm dev

# Start production server
pnpm start
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development, staging, production, test) | `development` |
| `PORT` | Server port | `4000` |
| `HOST` | Server host | `0.0.0.0` |
| `LOG_LEVEL` | Logging level | `info` |
| `JWT_SECRET` | JWT signing secret (required in production) | - |
| `JWT_EXPIRES_IN` | JWT expiration time | `1h` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` |
| `AUTH_SERVICE_URL` | Auth service URL | `http://localhost:3001` |
| `MARKET_SERVICE_URL` | Market service URL | `http://localhost:3002` |
| `SKILLPOD_SERVICE_URL` | SkillPod service URL | `http://localhost:3003` |
| `COCKPIT_SERVICE_URL` | Cockpit service URL | `http://localhost:3004` |
| `BILLING_SERVICE_URL` | Billing service URL | `http://localhost:3005` |
| `NOTIFICATION_SERVICE_URL` | Notification service URL | `http://localhost:3006` |
| `RATE_LIMIT_MAX` | Max requests per time window | `100` |
| `RATE_LIMIT_TIME_WINDOW` | Rate limit time window | `1 minute` |
| `CIRCUIT_BREAKER_TIMEOUT` | Request timeout (ms) | `30000` |
| `CIRCUIT_BREAKER_ERROR_THRESHOLD` | Error threshold percentage | `50` |
| `CIRCUIT_BREAKER_RESET_TIMEOUT` | Time before retry (ms) | `30000` |
| `CIRCUIT_BREAKER_VOLUME_THRESHOLD` | Min requests before opening | `10` |

## API Routes

### Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Overall health status |
| `GET /health/ready` | Readiness probe for Kubernetes |
| `GET /health/live` | Liveness probe for Kubernetes |
| `GET /health/circuits` | Circuit breaker states |

### BFF (Backend for Frontend)

| Endpoint | Description | Auth |
|----------|-------------|------|
| `GET /api/bff/dashboard` | Dashboard aggregation | Required |
| `GET /api/bff/market-overview` | Market overview data | Optional |

### Service Proxies

All service routes proxy requests to downstream services with authentication handling:

| Prefix | Target Service | Auth |
|--------|---------------|------|
| `/api/auth/*` | auth-svc | None/Required (varies by endpoint) |
| `/api/market/*` | market-svc | Optional |
| `/api/skillpods/*` | skillpod-svc | Required |
| `/api/cockpit/*` | cockpit-svc | Required |
| `/api/billing/*` | billing-svc | Required |
| `/api/notifications/*` | notification-svc | Required |

### Documentation

| Endpoint | Description |
|----------|-------------|
| `GET /docs` | Swagger UI |
| `GET /docs/json` | OpenAPI JSON spec |

## Circuit Breaker States

The circuit breaker protects downstream services:

1. **CLOSED** (Normal) - Requests flow through normally
2. **OPEN** (Failing) - Requests are rejected immediately
3. **HALF-OPEN** (Probing) - Limited requests allowed to test recovery

Transitions:
- CLOSED → OPEN: Error rate exceeds threshold (after volume threshold met)
- OPEN → HALF-OPEN: After reset timeout expires
- HALF-OPEN → CLOSED: Successful probe request
- HALF-OPEN → OPEN: Failed probe request

## Docker

### Build

```bash
docker build -t skillancer/api-gateway .
```

### Run

```bash
docker run -p 4000:4000 \
  -e JWT_SECRET=your-secret-key-at-least-32-characters \
  -e AUTH_SERVICE_URL=http://auth-svc:3001 \
  -e MARKET_SERVICE_URL=http://market-svc:3002 \
  skillancer/api-gateway
```

### Docker Compose

```yaml
services:
  api-gateway:
    image: skillancer/api-gateway
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - AUTH_SERVICE_URL=http://auth-svc:3001
      - MARKET_SERVICE_URL=http://market-svc:3002
      - SKILLPOD_SERVICE_URL=http://skillpod-svc:3003
      - COCKPIT_SERVICE_URL=http://cockpit-svc:3004
      - BILLING_SERVICE_URL=http://billing-svc:3005
      - NOTIFICATION_SERVICE_URL=http://notification-svc:3006
    healthcheck:
      test: ["CMD", "wget", "--spider", "http://localhost:4000/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Development

### Project Structure

```
src/
├── config/
│   ├── index.ts        # Configuration with Zod validation
│   └── routes.ts       # Service route definitions
├── plugins/
│   ├── index.ts        # Plugin registration
│   ├── auth.ts         # JWT authentication
│   ├── cors.ts         # CORS configuration
│   ├── helmet.ts       # Security headers
│   ├── proxy.ts        # Request proxying
│   ├── rate-limit.ts   # Rate limiting
│   ├── request-logger.ts # Request logging
│   ├── sensible.ts     # Fastify sensible utilities
│   └── swagger.ts      # OpenAPI documentation
├── middleware/
│   └── error-handler.ts # Global error handling
├── routes/
│   ├── index.ts        # Route registration
│   ├── health.ts       # Health check routes
│   └── bff/
│       ├── index.ts    # BFF route exports
│       ├── dashboard.ts # Dashboard aggregation
│       └── market-overview.ts # Market overview
├── utils/
│   ├── index.ts        # Utility exports
│   ├── circuit-breaker.ts # Circuit breaker implementation
│   ├── service-client.ts  # HTTP client for services
│   └── errors.ts       # Custom error classes
├── types/
│   └── index.ts        # Type definitions
├── app.ts              # Application factory
└── index.ts            # Server entry point
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Linting

```bash
# Run ESLint
pnpm lint

# Fix linting issues
pnpm lint:fix

# Run Prettier
pnpm format
```

## Related Services

- [service-template](../service-template/) - Base service template
- [auth-svc](../auth-svc/) - Authentication service
- [market-svc](../market-svc/) - Market data service
- [skillpod-svc](../skillpod-svc/) - SkillPod management service
- [cockpit-svc](../cockpit-svc/) - User dashboard service
- [billing-svc](../billing-svc/) - Billing and payments service
- [notification-svc](../notification-svc/) - Notification service

## License

MIT
