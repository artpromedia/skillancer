# API Gateway

Backend for Frontend (BFF) service that routes and aggregates requests to microservices.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript

## Getting Started

```bash
# From monorepo root
pnpm dev --filter=@skillancer/api-gateway

# Or from this directory
pnpm dev
```

## Features

- Request routing
- Authentication middleware
- Rate limiting
- Request validation
- Response aggregation

## API Documentation

API documentation is available at `/docs` when running in development mode.
