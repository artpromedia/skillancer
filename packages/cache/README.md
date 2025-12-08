# @skillancer/cache

Redis cache utilities for the Skillancer platform. Provides high-performance caching, session management, and rate limiting using Redis.

## Features

- 🚀 **CacheService** - Full-featured cache with tags, TTL, and atomic operations
- 🔐 **SessionStore** - Secure session management with user tracking
- ⚡ **RateLimiter** - Fixed window and sliding window rate limiting
- 🏥 **Health Checks** - Redis connection monitoring
- 🎯 **Cache Keys** - Consistent key generation patterns
- 🎨 **Decorators** - `@Cacheable`, `@CacheEvict`, `@CachePut` decorators
- 🔧 **Configuration** - Environment-based Redis configuration

## Installation

```bash
pnpm add @skillancer/cache
```

## Quick Start

### Basic Usage

```typescript
import { 
  createRedisClient, 
  CacheService, 
  getRedisConfigFromEnv 
} from '@skillancer/cache';

// Create Redis client from environment
const config = getRedisConfigFromEnv();
const redis = createRedisClient(config);

// Create cache service
const cache = new CacheService(redis, 'myapp');

// Set and get values
await cache.set('user:123', { name: 'John', email: 'john@example.com' }, { ttl: 3600 });
const user = await cache.get('user:123');

// Use cache-aside pattern
const user = await cache.getOrSet(
  'user:123',
  async () => userRepository.findById('123'),
  { ttl: 3600, tags: ['users'] }
);

// Invalidate by tag
await cache.deleteByTag('users');
```

### Session Management

```typescript
import { SessionStore } from '@skillancer/cache';

const sessions = new SessionStore(redis, {
  prefix: 'session',
  ttl: 86400, // 24 hours
});

// Create session
const session = await sessions.create({
  userId: 'user123',
  userEmail: 'user@example.com',
  tenantId: 'tenant1',
  metadata: { browser: 'Chrome', ip: '192.168.1.1' }
});

// Get session
const session = await sessions.get(sessionId);

// Refresh session (updates lastAccessedAt)
await sessions.refresh(sessionId);

// Get all sessions for a user
const userSessions = await sessions.getUserSessions('user123');

// Logout from all devices
await sessions.deleteUserSessions('user123');
```

### Rate Limiting

```typescript
import { SlidingWindowLimiter } from '@skillancer/cache';

const limiter = new SlidingWindowLimiter(redis, {
  keyPrefix: 'ratelimit:api',
  points: 100,      // 100 requests
  duration: 60,     // per 60 seconds
});

// In your middleware
async function rateLimitMiddleware(req, res, next) {
  const result = await limiter.consume(req.user.id);
  
  // Set rate limit headers
  const headers = limiter.getHeaders(result);
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
  
  if (!result.allowed) {
    return res.status(429).json({ 
      error: 'Too Many Requests',
      retryAfter: result.retryAfter 
    });
  }
  
  next();
}
```

### Cache Decorators

```typescript
import { 
  Cacheable, 
  CacheEvict, 
  CachePut,
  setDefaultCacheService 
} from '@skillancer/cache/decorators';

// Initialize cache service for decorators
setDefaultCacheService(cache);

class UserService {
  @Cacheable({
    key: (id: string) => `user:${id}`,
    ttl: 3600,
    tags: ['users']
  })
  async getUser(id: string): Promise<User> {
    return this.userRepository.findById(id);
  }

  @CacheEvict({
    key: (id: string) => `user:${id}`,
    tags: ['users']
  })
  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    return this.userRepository.update(id, data);
  }

  @CachePut({
    key: (id: string) => `user:${id}`,
    ttl: 3600
  })
  async refreshUser(id: string): Promise<User> {
    return this.userRepository.findById(id);
  }
}
```

### Cache Key Generation

```typescript
import { CacheKeys, createKey, hashKey } from '@skillancer/cache';

// Pre-defined key patterns
const profileKey = CacheKeys.user.profile('user123');     // 'user:user123:profile'
const jobKey = CacheKeys.market.job('job456');            // 'market:job:job456'
const rateKey = CacheKeys.system.rateLimit('api', 'u1');  // 'ratelimit:api:u1'

// Custom keys
const customKey = createKey('custom', 'namespace', 'id'); // 'custom:namespace:id'

// Hash complex objects for cache keys
const searchKey = `search:${hashKey({ query: 'react', filters: {...} })}`;
```

### Health Checks

```typescript
import { 
  checkRedisHealth, 
  isRedisHealthy, 
  waitForRedis,
  createHealthResponse 
} from '@skillancer/cache';

// Quick health check
const healthy = await isRedisHealthy(redis);

// Detailed health check
const health = await checkRedisHealth(redis, { 
  includeDetails: true,
  timeout: 5000 
});

console.log(health);
// {
//   healthy: true,
//   latency: 5,
//   status: 'connected',
//   details: {
//     version: '7.2.0',
//     usedMemoryHuman: '1.5M',
//     connectedClients: 10,
//     uptimeSeconds: 86400
//   }
// }

// Wait for Redis on startup
const ready = await waitForRedis(redis, {
  maxWait: 30000,
  checkInterval: 1000,
  onRetry: (attempt) => console.log(`Waiting for Redis... attempt ${attempt}`)
});

// Express health endpoint
app.get('/health/redis', async (req, res) => {
  const health = await createHealthResponse(redis, { includeDetails: true });
  res.status(health.data.healthy ? 200 : 503).json(health);
});
```

## Configuration

### Environment Variables

```bash
# Connection
REDIS_URL=redis://user:pass@localhost:6379/0
# or individual settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
REDIS_DATABASE=0

# TLS
REDIS_TLS=true

# Options
REDIS_KEY_PREFIX=myapp:
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000
REDIS_MAX_RETRIES=5
REDIS_RETRY_DELAY=200

# Cluster
REDIS_CLUSTER_NODES=node1:6379,node2:6379,node3:6379
```

### Programmatic Configuration

```typescript
import { 
  createRedisClient, 
  createRedisCluster,
  getConfigForEnvironment,
  validateConfig 
} from '@skillancer/cache';

// Development
const devConfig = getConfigForEnvironment('development');

// Production with validation
const prodConfig = getRedisConfigFromEnv();
const validation = validateConfig(prodConfig);

if (!validation.valid) {
  throw new Error(`Invalid config: ${validation.errors.join(', ')}`);
}

validation.warnings.forEach(w => console.warn(w));

// Create client
const redis = createRedisClient(prodConfig);

// Or use cluster
const cluster = createRedisCluster([
  { host: 'node1', port: 6379 },
  { host: 'node2', port: 6379 },
  { host: 'node3', port: 6379 },
]);
```

## API Reference

### CacheService

| Method | Description |
|--------|-------------|
| `get<T>(key)` | Get cached value |
| `set(key, value, options?)` | Set value with optional TTL and tags |
| `delete(key)` | Delete a key |
| `deleteByTag(tag)` | Delete all keys with tag |
| `deletePattern(pattern)` | Delete keys matching pattern |
| `exists(key)` | Check if key exists |
| `getOrSet(key, factory, options?)` | Get or compute and cache |
| `increment(key, amount?)` | Increment counter |
| `decrement(key, amount?)` | Decrement counter |
| `hset(key, field, value)` | Set hash field |
| `hget(key, field)` | Get hash field |
| `hgetall(key)` | Get all hash fields |
| `hdel(key, ...fields)` | Delete hash fields |
| `flush()` | Clear all cache |

### SessionStore

| Method | Description |
|--------|-------------|
| `create(data)` | Create new session |
| `get(sessionId)` | Get session by ID |
| `update(sessionId, data)` | Update session data |
| `delete(sessionId)` | Delete session |
| `refresh(sessionId)` | Refresh session TTL |
| `getUserSessions(userId)` | Get all user sessions |
| `deleteUserSessions(userId)` | Delete all user sessions |
| `isHealthy()` | Check store health |

### RateLimiter

| Method | Description |
|--------|-------------|
| `consume(key, points?)` | Consume rate limit points |
| `get(key)` | Get current rate limit state |
| `reset(key)` | Reset rate limit for key |
| `getHeaders(result)` | Get HTTP headers for response |

## Testing

The package includes comprehensive tests using Vitest and ioredis-mock:

```bash
pnpm test
```

## License

MIT
