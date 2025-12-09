---
sidebar_position: 6
---

# Debugging

This guide covers debugging techniques for Skillancer development.

## VS Code Debugging

### Launch Configurations

The repository includes pre-configured launch configurations in `.vscode/launch.json`:

```json
{
  "configurations": [
    {
      "name": "Debug API Gateway",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@skillancer/api-gateway", "dev:debug"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Next.js (Web)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@skillancer/web", "dev"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Current Test File",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test", "${relativeFile}", "--", "--run"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Using Breakpoints

1. Open the file you want to debug
2. Click in the gutter to add a breakpoint (red dot)
3. Press `F5` or select a launch configuration
4. Code will pause at breakpoints

### Debug Console

While paused at a breakpoint, use the Debug Console to:

- Evaluate expressions
- Inspect variables
- Call functions

## Backend Debugging

### Fastify Service Debugging

Add the `--inspect` flag to your service:

```json
// services/api-gateway/package.json
{
  "scripts": {
    "dev:debug": "tsx --inspect src/server.ts"
  }
}
```

Then connect VS Code or Chrome DevTools.

### Logging

Use structured logging for debugging:

```typescript
import { logger } from '@skillancer/logger';

// Debug level logging
logger.debug({ userId, action }, 'Processing user action');

// With context
logger.child({ requestId }).info('Request received');

// Timing
const start = Date.now();
// ... operation
logger.debug({ duration: Date.now() - start }, 'Operation completed');
```

### Database Queries

Enable Prisma query logging:

```typescript
// In development
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

Or use Prisma Studio:

```bash
make db-studio
# Opens http://localhost:5555
```

### API Testing

Use the built-in Swagger UI:

```
http://localhost:3001/docs
```

Or test with curl:

```bash
# Health check
curl http://localhost:3001/health

# Authenticated request
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/users/me
```

## Frontend Debugging

### React DevTools

Install the [React DevTools extension](https://react.dev/learn/react-developer-tools) for your browser.

Features:

- Component tree inspection
- Props/state viewing
- Performance profiling

### Next.js Debugging

Next.js includes built-in debugging support:

```bash
# Start with debugging
NODE_OPTIONS='--inspect' pnpm --filter @skillancer/web dev
```

### Network Tab

Use browser DevTools Network tab to:

- Inspect API requests/responses
- Check request timing
- View request headers

### TanStack Query DevTools

Query devtools are enabled in development:

```typescript
// Already configured in apps
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  {children}
  <ReactQueryDevtools initialIsOpen={false} />
</QueryClientProvider>
```

## Debugging Tests

### Vitest UI

Run tests with the UI for interactive debugging:

```bash
pnpm test -- --ui
```

### Debug Single Test

```bash
# Run specific test file
pnpm test -- src/utils/format.test.ts

# Run tests matching pattern
pnpm test -- -t "formatCurrency"

# Run with verbose output
pnpm test -- --reporter=verbose
```

### Playwright Debugging

```bash
# Run with inspector
pnpm test:e2e -- --debug

# Run with UI mode
pnpm test:e2e -- --ui

# Generate trace for failures
pnpm test:e2e -- --trace on
```

View traces:

```bash
npx playwright show-trace trace.zip
```

## Docker Debugging

### View Logs

```bash
# All containers
make docker-logs

# Specific container
docker compose logs -f postgres

# Last 100 lines
docker compose logs --tail=100 redis
```

### Access Container Shell

```bash
# PostgreSQL
docker compose exec postgres psql -U skillancer skillancer_dev

# Redis
docker compose exec redis redis-cli
```

### Inspect Container

```bash
docker compose exec api-gateway sh

# Check environment
printenv | grep DATABASE

# Check network
curl localhost:3001/health
```

## Distributed Tracing

### Jaeger UI

Access traces at http://localhost:16686

Search by:

- Service name
- Operation name
- Tags (userId, requestId)
- Duration

### Adding Trace Context

```typescript
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service');

async function processOrder(orderId: string) {
  const span = tracer.startSpan('processOrder');
  span.setAttribute('orderId', orderId);

  try {
    // Your code
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    throw error;
  } finally {
    span.end();
  }
}
```

## Common Issues

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill it
kill -9 <PID>
```

### Memory Issues

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" pnpm dev
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker compose ps

# Check connection
psql $DATABASE_URL -c "SELECT 1"

# Reset database
pnpm db:migrate:reset
```

### Cache Issues

```bash
# Clear Redis
docker compose exec redis redis-cli FLUSHALL

# Clear local caches
make clean
pnpm install
```

## Useful Tools

| Tool                                                            | Purpose               |
| --------------------------------------------------------------- | --------------------- |
| [httpie](https://httpie.io/)                                    | Better curl           |
| [jq](https://stedolan.github.io/jq/)                            | JSON processing       |
| [pgcli](https://www.pgcli.com/)                                 | Better PostgreSQL CLI |
| [redis-commander](https://github.com/joeferner/redis-commander) | Redis GUI             |

## Next Steps

- [Code Generation](/docs/getting-started/code-generation) - Generate new code
- [Contributing](/docs/getting-started/contributing) - Contribute to Skillancer
