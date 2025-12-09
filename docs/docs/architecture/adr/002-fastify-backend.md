# ADR-002: Fastify for Backend Services

## Status

**Accepted**

- Date: 2024-01-16
- Deciders: Engineering Team

## Context

We need to choose a Node.js framework for building our backend microservices. The framework should support:

- High performance for production workloads
- TypeScript integration
- Schema validation
- API documentation generation
- Plugin architecture for extensibility

### Current Options in Ecosystem

1. Express.js - Most popular, but aging
2. Fastify - High performance, modern
3. NestJS - Full-featured, opinionated
4. Hono - Ultra-lightweight, edge-first
5. Koa - Middleware-focused, minimal

## Decision

**We will use Fastify as our backend framework for all microservices.**

```typescript
// Example Fastify service
import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

const app = Fastify({
  logger: true,
}).withTypeProvider<TypeBoxTypeProvider>();

app.get('/health', async () => ({ status: 'ok' }));

await app.listen({ port: 3000, host: '0.0.0.0' });
```

## Alternatives Considered

### Option A: Express.js

**Pros:**

- Massive ecosystem
- Team familiarity
- Abundant tutorials and resources
- Most npm packages support Express

**Cons:**

- Slower performance (~2x slower than Fastify)
- No built-in TypeScript support
- No native schema validation
- Callback-based middleware pattern
- Manual OpenAPI documentation

### Option B: NestJS

**Pros:**

- Full-featured framework
- Built-in dependency injection
- Excellent TypeScript integration
- Swagger generation included
- Structured architecture

**Cons:**

- Heavy abstraction layer
- Steeper learning curve
- More boilerplate
- Opinionated patterns may conflict with microservices flexibility
- Slower cold starts

### Option C: Fastify (Selected)

**Pros:**

- Excellent performance (benchmarks show best in class)
- Native TypeScript support with type providers
- JSON Schema validation built-in
- Automatic Swagger/OpenAPI generation
- Plugin architecture
- Async/await first
- Active development and community

**Cons:**

- Smaller ecosystem than Express
- Different patterns (may require learning)
- Some Express plugins need adaptation

### Option D: Hono

**Pros:**

- Extremely fast
- Edge runtime support
- Minimal bundle size

**Cons:**

- Less mature
- Smaller ecosystem
- Better suited for edge/serverless

## Consequences

### Positive

1. **Performance**: Handling ~30k requests/second vs ~15k for Express
2. **Type safety**: Full TypeScript integration with type providers
3. **Validation**: JSON Schema validation with automatic TypeScript types
4. **Documentation**: Auto-generated OpenAPI specs
5. **Developer experience**: Modern async/await patterns
6. **Plugin system**: Clean extension model

### Negative

1. **Ecosystem**: Some Express middleware needs alternatives
   - _Mitigation_: Most common needs have Fastify plugins
2. **Team learning**: Different patterns from Express
   - _Mitigation_: Good documentation, similar enough concepts
3. **Less Stack Overflow content**: Fewer Q&A resources
   - _Mitigation_: Active Discord, good official docs

### Neutral

- Need to use `@fastify/*` plugins instead of Express middleware
- Routes are registered differently (encapsulation)

## Implementation

Standard service structure:

```
services/user/
├── src/
│   ├── index.ts           # Entry point
│   ├── app.ts             # Fastify app setup
│   ├── routes/            # Route handlers
│   │   └── users.ts
│   ├── schemas/           # JSON schemas
│   │   └── user.schema.ts
│   ├── services/          # Business logic
│   │   └── user.service.ts
│   └── plugins/           # Custom plugins
└── tests/
```

## References

- [Fastify Documentation](https://www.fastify.io/docs/latest/)
- [Fastify Benchmarks](https://www.fastify.io/benchmarks/)
- [Type Providers](https://www.fastify.io/docs/latest/Reference/Type-Providers/)
- [ADR-001: Monorepo Structure](./001-monorepo-structure)
