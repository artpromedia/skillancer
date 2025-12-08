# Cache Package

Redis cache utilities for the Skillancer platform.

## Tech Stack

- **Client**: ioredis
- **Cache**: Redis

## Usage

```typescript
import { cache, createCacheKey } from '@skillancer/cache';

// Basic operations
await cache.set('user:123', userData, { ttl: 3600 });
const user = await cache.get('user:123');
await cache.del('user:123');

// With type safety
const user = await cache.get<User>('user:123');

// Cache-aside pattern
const user = await cache.getOrSet('user:123', async () => {
  return await fetchUserFromDb('123');
}, { ttl: 3600 });
```

## Features

- Type-safe cache operations
- TTL support
- Cache-aside pattern
- Key namespacing
- Connection pooling
- Pub/Sub support

## Environment Variables

```env
REDIS_URL="redis://localhost:6379"
```
