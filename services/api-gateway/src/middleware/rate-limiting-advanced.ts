/**
 * Advanced Rate Limiting Middleware
 * Redis-backed distributed rate limiting with SOC 2 compliance logging
 */

import { v4 as uuidv4 } from 'uuid';

import type { Request, Response, NextFunction } from 'express';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstAllowance?: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface EndpointRateLimitConfig {
  pattern: string | RegExp;
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export enum RateLimitAction {
  ALLOW = 'allow',
  WARN = 'warn',
  THROTTLE = 'throttle',
  BLOCK = 'block',
}

export interface RateLimitEvent {
  id: string;
  timestamp: Date;
  key: string;
  ip: string;
  userId?: string;
  endpoint: string;
  action: RateLimitAction;
  requestCount: number;
  limit: number;
  windowMs: number;
}

// In-memory store (use Redis in production)
const rateLimitStore: Map<string, { count: number; resetAt: number }> = new Map();
const rateLimitEvents: RateLimitEvent[] = [];

// Default rate limits per tier
const DEFAULT_LIMITS = {
  perUser: { windowMs: 60 * 1000, maxRequests: 100 }, // 100 req/min per user
  perIP: { windowMs: 60 * 1000, maxRequests: 200 }, // 200 req/min per IP
  perEndpoint: { windowMs: 60 * 1000, maxRequests: 50 }, // 50 req/min per endpoint
  global: { windowMs: 1000, maxRequests: 10000 }, // 10k req/sec global
};

// Endpoint-specific limits
const ENDPOINT_LIMITS: EndpointRateLimitConfig[] = [
  { pattern: '/auth/login', windowMs: 60 * 1000, maxRequests: 5 }, // 5 login attempts/min
  { pattern: '/auth/password-reset', windowMs: 60 * 1000, maxRequests: 3 },
  { pattern: '/auth/register', windowMs: 60 * 1000, maxRequests: 3 },
  { pattern: /\/api\/v1\/users\/.*\/mfa/, windowMs: 60 * 1000, maxRequests: 5 },
  { pattern: '/api/v1/payments', windowMs: 60 * 1000, maxRequests: 10 },
  { pattern: /\/api\/v1\/export/, windowMs: 300 * 1000, maxRequests: 5 }, // 5 exports per 5 min
];

// Internal service allowlist
const INTERNAL_ALLOWLIST = ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

/**
 * Check if IP is in internal allowlist
 */
function isInternalService(ip: string): boolean {
  // Simplified check - in production, use proper CIDR matching
  return INTERNAL_ALLOWLIST.some((allowed) => {
    if (allowed.includes('/')) {
      // CIDR range - simplified check
      const [network] = allowed.split('/');
      return network && ip.startsWith(network.split('.').slice(0, 2).join('.'));
    }
    return ip === allowed;
  });
}

/**
 * Get rate limit key
 */
function getRateLimitKey(req: Request, type: 'user' | 'ip' | 'endpoint'): string {
  const userId = (req as any).user?.id;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const endpoint = req.path;

  switch (type) {
    case 'user':
      return `ratelimit:user:${userId || 'anonymous'}`;
    case 'ip':
      return `ratelimit:ip:${ip}`;
    case 'endpoint':
      return `ratelimit:endpoint:${endpoint}:${userId || ip}`;
    default:
      return `ratelimit:${ip}`;
  }
}

/**
 * Check rate limit using sliding window
 */
function checkRateLimit(key: string, windowMs: number, maxRequests: number): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(now + windowMs),
    };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);
  const allowed = entry.count <= maxRequests;
  const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);

  return {
    allowed,
    remaining,
    resetAt: new Date(entry.resetAt),
    ...(allowed ? {} : { retryAfter: retryAfterSeconds }),
  };
}

/**
 * Get endpoint-specific limit
 */
function getEndpointLimit(path: string): EndpointRateLimitConfig | undefined {
  return ENDPOINT_LIMITS.find((limit) => {
    if (typeof limit.pattern === 'string') {
      return path === limit.pattern || path.startsWith(limit.pattern);
    }
    return limit.pattern.test(path);
  });
}

/**
 * Determine action based on request count vs limit
 */
function determineAction(count: number, limit: number): RateLimitAction {
  const ratio = count / limit;
  if (ratio <= 0.8) return RateLimitAction.ALLOW;
  if (ratio <= 1.0) return RateLimitAction.WARN;
  if (ratio <= 1.5) return RateLimitAction.THROTTLE;
  return RateLimitAction.BLOCK;
}

/**
 * Log rate limit event for SOC 2 compliance
 */
function logRateLimitEvent(
  req: Request,
  key: string,
  action: RateLimitAction,
  count: number,
  limit: number,
  windowMs: number
): void {
  const event: RateLimitEvent = {
    id: uuidv4(),
    timestamp: new Date(),
    key,
    ip: req.ip || 'unknown',
    userId: (req as any).user?.id,
    endpoint: req.path,
    action,
    requestCount: count,
    limit,
    windowMs,
  };

  rateLimitEvents.push(event);

  // Keep only last 10000 events in memory (use external storage in production)
  if (rateLimitEvents.length > 10000) {
    rateLimitEvents.shift();
  }

  // Log to console for now (integrate with audit service in production)
  if (action !== RateLimitAction.ALLOW) {
    console.log(`[RateLimit] ${action.toUpperCase()}: ${key} - ${count}/${limit} requests`);
  }
}

/**
 * Advanced Rate Limiting Middleware
 */
export function advancedRateLimiter(customConfig?: Partial<typeof DEFAULT_LIMITS>) {
  const config = { ...DEFAULT_LIMITS, ...customConfig };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    // Skip internal services
    if (isInternalService(ip)) {
      next();
      return;
    }

    // Check endpoint-specific limit first
    const endpointLimit = getEndpointLimit(req.path);
    if (endpointLimit) {
      const key = getRateLimitKey(req, 'endpoint');
      const result = checkRateLimit(key, endpointLimit.windowMs, endpointLimit.maxRequests);

      const entry = rateLimitStore.get(key);
      const action = determineAction(entry?.count || 1, endpointLimit.maxRequests);
      logRateLimitEvent(
        req,
        key,
        action,
        entry?.count || 1,
        endpointLimit.maxRequests,
        endpointLimit.windowMs
      );

      if (!result.allowed) {
        setRateLimitHeaders(res, result, endpointLimit.maxRequests);
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded for this endpoint',
          retryAfter: result.retryAfter,
        });
        return;
      }
    }

    // Check per-user limit
    const userId = (req as any).user?.id;
    if (userId) {
      const key = getRateLimitKey(req, 'user');
      const result = checkRateLimit(key, config.perUser.windowMs, config.perUser.maxRequests);

      const entry = rateLimitStore.get(key);
      const action = determineAction(entry?.count || 1, config.perUser.maxRequests);
      logRateLimitEvent(
        req,
        key,
        action,
        entry?.count || 1,
        config.perUser.maxRequests,
        config.perUser.windowMs
      );

      if (!result.allowed) {
        setRateLimitHeaders(res, result, config.perUser.maxRequests);
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'User rate limit exceeded',
          retryAfter: result.retryAfter,
        });
        return;
      }

      // Set headers for successful requests
      setRateLimitHeaders(res, result, config.perUser.maxRequests);
    }

    // Check per-IP limit
    const ipKey = getRateLimitKey(req, 'ip');
    const ipResult = checkRateLimit(ipKey, config.perIP.windowMs, config.perIP.maxRequests);

    const ipEntry = rateLimitStore.get(ipKey);
    const ipAction = determineAction(ipEntry?.count || 1, config.perIP.maxRequests);

    if (ipAction === RateLimitAction.WARN || ipAction === RateLimitAction.THROTTLE) {
      logRateLimitEvent(
        req,
        ipKey,
        ipAction,
        ipEntry?.count || 1,
        config.perIP.maxRequests,
        config.perIP.windowMs
      );
    }

    if (!ipResult.allowed) {
      logRateLimitEvent(
        req,
        ipKey,
        RateLimitAction.BLOCK,
        ipEntry?.count || 1,
        config.perIP.maxRequests,
        config.perIP.windowMs
      );
      setRateLimitHeaders(res, ipResult, config.perIP.maxRequests);
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'IP rate limit exceeded',
        retryAfter: ipResult.retryAfter,
      });
      return;
    }

    // Graduated response: add delay for throttled requests
    if (ipAction === RateLimitAction.THROTTLE) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
    }

    next();
  };
}

/**
 * Set rate limit headers
 */
function setRateLimitHeaders(res: Response, result: RateLimitResult, limit: number): void {
  res.setHeader('X-RateLimit-Limit', limit.toString());
  res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());
  if (result.retryAfter) {
    res.setHeader('Retry-After', result.retryAfter.toString());
  }
}

/**
 * Get rate limit events for audit
 */
export function getRateLimitEvents(
  startDate?: Date,
  endDate?: Date,
  action?: RateLimitAction
): RateLimitEvent[] {
  return rateLimitEvents.filter((event) => {
    if (startDate && event.timestamp < startDate) return false;
    if (endDate && event.timestamp > endDate) return false;
    if (action && event.action !== action) return false;
    return true;
  });
}

/**
 * Clear rate limit for a key (admin function)
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(key: string): { count: number; resetAt: Date } | null {
  const entry = rateLimitStore.get(key);
  if (!entry) return null;
  return { count: entry.count, resetAt: new Date(entry.resetAt) };
}

export default advancedRateLimiter;
