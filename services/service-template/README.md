# @skillancer/service-template

Standardized Fastify service template for Skillancer microservices.

## Features

- **Fastify 4.x** - High-performance web framework
- **TypeScript** - Full type safety with ESM modules
- **Zod Validation** - Runtime validation for config and requests
- **Structured Logging** - Pino logger with request correlation
- **Security** - Helmet, CORS, rate limiting out of the box
- **Health Checks** - Kubernetes-ready health endpoints
- **API Documentation** - Swagger/OpenAPI integration
- **Error Handling** - Consistent error responses with custom error classes
- **Testing** - Vitest with 100+ unit tests

## Quick Start

```bash
# Install dependencies
pnpm install

# Development with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test
```

## Project Structure

```
src/
├── config/           # Environment configuration with Zod validation
├── plugins/          # Fastify plugins (cors, helmet, jwt, swagger, etc.)
├── middleware/       # Request/response middleware
├── routes/           # API route handlers
├── schemas/          # Shared Zod schemas
├── utils/            # Utility functions (logger, errors, validation, http)
├── types/            # TypeScript type definitions
├── app.ts            # Application factory
├── server.ts         # Server entry point
└── index.ts          # Public exports
```

## Configuration

Configuration is loaded from environment variables with Zod validation:

```typescript
import { getConfig } from '@skillancer/service-template';

const config = getConfig();
console.log(config.server.port); // 3000
console.log(config.env); // 'development'
```

### Environment Variables

| Variable            | Default       | Description                                   |
| ------------------- | ------------- | --------------------------------------------- |
| `NODE_ENV`          | `development` | Environment (development/test/production)     |
| `SERVICE_NAME`      | `service`     | Service identifier                            |
| `PORT`              | `3000`        | Server port                                   |
| `HOST`              | `0.0.0.0`     | Server host                                   |
| `LOG_LEVEL`         | `info`        | Log level (trace/debug/info/warn/error/fatal) |
| `DATABASE_URL`      | -             | PostgreSQL connection string                  |
| `REDIS_URL`         | -             | Redis connection string                       |
| `JWT_SECRET`        | -             | JWT signing secret                            |
| `CORS_ORIGIN`       | `*`           | Allowed CORS origins                          |
| `RATE_LIMIT_MAX`    | `100`         | Max requests per window                       |
| `RATE_LIMIT_WINDOW` | `60000`       | Rate limit window in ms                       |

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness probe (checks dependencies)
- `GET /health/live` - Liveness probe

### Documentation

- `GET /docs` - Swagger UI
- `GET /docs/json` - OpenAPI JSON spec

## Usage

### Building a New Service

```typescript
import { buildApp, getConfig } from '@skillancer/service-template';

const config = getConfig();
const app = await buildApp({
  logger: true,
  // Custom options
});

// Add your routes
app.get('/api/items', async () => {
  return { items: [] };
});

await app.listen({
  port: config.server.port,
  host: config.server.host,
});
```

### Custom Error Handling

```typescript
import { BadRequestError, NotFoundError, UnauthorizedError } from '@skillancer/service-template';

app.get('/users/:id', async (request) => {
  const user = await findUser(request.params.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
});
```

### Validation with Zod

```typescript
import { validateOrThrow, emailSchema } from '@skillancer/service-template';

app.post('/users', async (request) => {
  const data = validateOrThrow(createUserSchema, request.body);
  // data is fully typed
  return createUser(data);
});
```

### HTTP Client with Retry

```typescript
import { createHttpClient, withRetry } from '@skillancer/service-template';

const client = createHttpClient({
  baseUrl: 'https://api.example.com',
  timeout: 5000,
});

// With automatic retry
const result = await withRetry(() => client.get('/data'), { maxRetries: 3, initialDelay: 1000 });
```

## Testing

```typescript
import { buildTestApp } from '@skillancer/service-template';

describe('My API', () => {
  let app;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
  });
});
```

## Exports

The package exports the following:

```typescript
// Application
export { buildApp, buildTestApp } from './app.js';

// Configuration
export { getConfig, clearConfigCache, validateConfig } from './config/index.js';

// Utilities
export { getLogger, createChildLogger, logOperation } from './utils/logger.js';

export {
  AppError,
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  InternalServerError,
  ServiceUnavailableError,
} from './utils/errors.js';

export {
  validate,
  validateOrThrow,
  parsePagination,
  buildPaginationMeta,
} from './utils/validation.js';

export {
  createHttpClient,
  withRetry,
  createCircuitBreaker,
  buildQueryString,
  parseQueryString,
} from './utils/http.js';

// Schemas
export {
  uuidSchema,
  emailSchema,
  paginationSchema,
  listQuerySchema,
  // ... and more
} from './schemas/index.js';
```

## License

MIT
