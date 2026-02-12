# Production Performance Checklist

Complete this checklist to ensure optimal performance at launch.

## Frontend Performance

### Bundle Optimization

- [ ] JavaScript bundle size < 200KB (gzipped)
- [ ] CSS bundle size < 50KB (gzipped)
- [ ] Code splitting implemented
- [ ] Dynamic imports for routes
- [ ] Tree shaking verified
- [ ] Dead code eliminated
- [ ] Source maps external (not in production bundle)

### Current Bundle Analysis

```bash
# Run bundle analyzer
pnpm analyze

# Expected output:
# Main bundle: < 150KB gzipped
# Vendor bundle: < 80KB gzipped
# Total initial: < 200KB gzipped
```

### Image Optimization

- [ ] All images converted to WebP/AVIF
- [ ] Responsive images with srcset
- [ ] Lazy loading for below-fold images
- [ ] Image dimensions specified (prevent CLS)
- [ ] Placeholder images for loading state
- [ ] SVG icons optimized and inlined
- [ ] No images > 500KB

### Loading Performance

- [ ] Critical CSS inlined
- [ ] Non-critical CSS deferred
- [ ] JavaScript deferred/async
- [ ] Preload critical resources
- [ ] Prefetch anticipated routes
- [ ] Resource hints configured

### Caching

- [ ] Static assets cache: 1 year (immutable)
- [ ] HTML cache: no-cache (revalidate)
- [ ] API cache headers appropriate
- [ ] Service worker caching strategy
- [ ] CDN cache hit ratio > 80%

### CDN Configuration

- [ ] CloudFront distribution active
- [ ] Edge locations optimized
- [ ] Compression enabled (gzip, brotli)
- [ ] HTTP/2 enabled
- [ ] Cache behaviors configured

---

## Backend Performance

### Database Optimization

- [ ] All queries use indexes
- [ ] No N+1 query problems
- [ ] Query performance < 100ms (p95)
- [ ] Connection pooling configured
- [ ] Read replicas for heavy reads
- [ ] Database vacuum scheduled

### Index Verification

```sql
-- Verify critical indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE tablename IN ('users', 'jobs', 'proposals', 'contracts');

-- Check for missing indexes
SELECT
  relname as table,
  seq_scan,
  idx_scan,
  CASE WHEN seq_scan > 0
    THEN round(100.0 * idx_scan / (seq_scan + idx_scan), 1)
    ELSE 100
  END as idx_usage_percent
FROM pg_stat_user_tables
WHERE seq_scan > 1000
ORDER BY seq_scan DESC;
```

### Query Performance

- [ ] Slow query logging enabled (> 1s)
- [ ] Query plans reviewed for critical paths
- [ ] Pagination implemented (no full table scans)
- [ ] Batch operations for bulk updates

### Connection Pooling

- [ ] PgBouncer configured
- [ ] Pool size: 50-100 connections
- [ ] Connection timeout: 30 seconds
- [ ] Idle connection cleanup

### Redis Caching

- [ ] Session caching enabled
- [ ] API response caching configured
- [ ] Cache invalidation working
- [ ] Redis memory < 70% capacity
- [ ] Cache hit ratio > 80%

### Response Compression

- [ ] Gzip enabled for all text responses
- [ ] Brotli for modern browsers
- [ ] Minimum compression size: 1KB

### Request Timeouts

- [ ] API timeout: 30 seconds
- [ ] Database query timeout: 10 seconds
- [ ] External service timeout: 5 seconds
- [ ] Circuit breakers configured

---

## Infrastructure Performance

### Auto-Scaling

- [ ] CPU-based scaling configured
- [ ] Memory-based scaling configured
- [ ] Custom metrics scaling (queue depth)
- [ ] Scale-up: CPU > 70% for 2 min
- [ ] Scale-down: CPU < 30% for 10 min
- [ ] Min replicas: 3
- [ ] Max replicas: 50

### Health Checks

- [ ] Liveness probes configured
- [ ] Readiness probes configured
- [ ] Health check endpoint < 100ms
- [ ] Graceful shutdown implemented

### Load Balancer

- [ ] Health check interval: 10 seconds
- [ ] Unhealthy threshold: 2 checks
- [ ] Connection draining: 30 seconds
- [ ] Sticky sessions (if needed)

### Resource Limits

```yaml
# Kubernetes resource configuration
resources:
  requests:
    cpu: '100m'
    memory: '256Mi'
  limits:
    cpu: '1000m'
    memory: '1Gi'
```

### CDN Performance

- [ ] Cache hit ratio > 80%
- [ ] Origin shield enabled
- [ ] Edge caching optimized
- [ ] Custom error pages cached

### Database Read Replicas

- [ ] At least 1 read replica active
- [ ] Read traffic routed to replicas
- [ ] Replica lag < 1 second
- [ ] Failover tested

---

## Performance Metrics

### Target SLOs

| Metric                         | Target   | Current   |
| ------------------------------ | -------- | --------- |
| TTFB (Time to First Byte)      | < 200ms  | \_\_\_ ms |
| FCP (First Contentful Paint)   | < 1.5s   | \_\_\_ s  |
| LCP (Largest Contentful Paint) | < 2.5s   | \_\_\_ s  |
| FID (First Input Delay)        | < 100ms  | \_\_\_ ms |
| CLS (Cumulative Layout Shift)  | < 0.1    | \_\_\_    |
| TTI (Time to Interactive)      | < 3.5s   | \_\_\_ s  |
| API Response (p50)             | < 100ms  | \_\_\_ ms |
| API Response (p95)             | < 500ms  | \_\_\_ ms |
| API Response (p99)             | < 1000ms | \_\_\_ ms |

### Lighthouse Scores

| Page        | Performance | Accessibility | Best Practices | SEO  |
| ----------- | ----------- | ------------- | -------------- | ---- |
| Homepage    | > 90        | > 95          | > 95           | > 90 |
| Job Listing | > 85        | > 95          | > 95           | > 90 |
| Profile     | > 85        | > 95          | > 95           | > 90 |
| Dashboard   | > 80        | > 95          | > 95           | > 90 |

### Load Test Results

```bash
# Run load test
k6 run --vus 1000 --duration 5m load-test.js

# Expected results:
# - Requests/sec: > 5000
# - Error rate: < 0.1%
# - p95 latency: < 500ms
```

| Test     | VUs  | Duration | Req/s | Error Rate | p95 |
| -------- | ---- | -------- | ----- | ---------- | --- |
| Baseline | 100  | 5m       |       |            |     |
| Normal   | 500  | 10m      |       |            |     |
| Peak     | 1000 | 5m       |       |            |     |
| Stress   | 2000 | 5m       |       |            |     |

---

## Monitoring

### Dashboards

- [ ] Real-time performance dashboard
- [ ] Error rate monitoring
- [ ] Response time percentiles
- [ ] Resource utilization
- [ ] CDN performance

### Alerts

- [ ] p95 latency > 500ms (warning)
- [ ] p99 latency > 1000ms (critical)
- [ ] Error rate > 1% (warning)
- [ ] Error rate > 5% (critical)
- [ ] CPU > 80% (warning)
- [ ] Memory > 85% (critical)

---

## Optimization Tools

### Analysis Commands

```bash
# Bundle analysis
pnpm build && pnpm analyze

# Lighthouse CI
pnpm lighthouse https://skillancer.com

# Load testing
k6 run tests/performance/load-test.js

# Database query analysis
pnpm db:analyze-queries
```

### Verification

| Area               | Verified By | Date | Notes |
| ------------------ | ----------- | ---- | ----- |
| Frontend Bundle    |             |      |       |
| Image Optimization |             |      |       |
| CDN Configuration  |             |      |       |
| Database Indexes   |             |      |       |
| Caching            |             |      |       |
| Load Testing       |             |      |       |

**Performance Lead Approval:**

Name: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***
Date: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***
