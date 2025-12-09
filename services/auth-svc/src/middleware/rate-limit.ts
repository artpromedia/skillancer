/**
 * @module @skillancer/auth-svc/middleware/rate-limit
 * Rate limiting middleware for authentication endpoints
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { Redis } from 'ioredis';

import { RateLimiter, type RateLimitConfig, type RateLimitResult } from '@skillancer/cache';

import { getConfig } from '../config/index.js';
import { RateLimitExceededError } from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface RateLimitOptions {
  redis: Redis;
}

declare module 'fastify' {
  interface FastifyInstance {
    rateLimit: {
      login: (key: string) => Promise<RateLimitResult>;
      registration: (key: string) => Promise<RateLimitResult>;
      passwordReset: (key: string) => Promise<RateLimitResult>;
      checkLogin: (key: string) => Promise<RateLimitResult>;
      checkRegistration: (key: string) => Promise<RateLimitResult>;
      checkPasswordReset: (key: string) => Promise<RateLimitResult>;
      resetLogin: (key: string) => Promise<void>;
      resetRegistration: (key: string) => Promise<void>;
      resetPasswordReset: (key: string) => Promise<void>;
    };
  }
}

// =============================================================================
// RATE LIMIT CONFIGS
// =============================================================================

/**
 * Get rate limit configurations from config
 */
function getRateLimitConfigs(): {
  login: RateLimitConfig;
  registration: RateLimitConfig;
  passwordReset: RateLimitConfig;
} {
  const config = getConfig();

  return {
    login: {
      maxRequests: config.rateLimit.login.maxAttempts,
      windowMs: config.rateLimit.login.windowMs,
    },
    registration: {
      maxRequests: config.rateLimit.registration.maxAttempts,
      windowMs: config.rateLimit.registration.windowMs,
    },
    passwordReset: {
      maxRequests: config.rateLimit.passwordReset.maxAttempts,
      windowMs: config.rateLimit.passwordReset.windowMs,
    },
  };
}

// =============================================================================
// RATE LIMIT PLUGIN
// =============================================================================

/**
 * Rate limiting plugin for auth endpoints
 *
 * Provides:
 * - Login rate limiting: 5 attempts per 15 minutes per email
 * - Registration rate limiting: 3 attempts per hour per IP
 * - Password reset rate limiting: 3 attempts per hour per email
 *
 * @example
 * ```typescript
 * // In route handler
 * const result = await fastify.rateLimit.login(email);
 * if (!result.allowed) {
 *   throw new RateLimitExceededError('Too many login attempts', result.retryAfter);
 * }
 * ```
 */
async function rateLimitPluginImpl(
  fastify: FastifyInstance,
  options: RateLimitOptions
): Promise<void> {
  const { redis } = options;
  const configs = getRateLimitConfigs();

  const loginLimiter = new RateLimiter(redis, 'auth:ratelimit:login');
  const registrationLimiter = new RateLimiter(redis, 'auth:ratelimit:registration');
  const passwordResetLimiter = new RateLimiter(redis, 'auth:ratelimit:password_reset');

  fastify.decorate('rateLimit', {
    // Consume and check
    login: async (key: string) => loginLimiter.consume(key, configs.login),
    registration: async (key: string) => registrationLimiter.consume(key, configs.registration),
    passwordReset: async (key: string) => passwordResetLimiter.consume(key, configs.passwordReset),

    // Check without consuming
    checkLogin: async (key: string) => loginLimiter.check(key, configs.login),
    checkRegistration: async (key: string) => registrationLimiter.check(key, configs.registration),
    checkPasswordReset: async (key: string) =>
      passwordResetLimiter.check(key, configs.passwordReset),

    // Reset rate limits
    resetLogin: async (key: string) => loginLimiter.reset(key),
    resetRegistration: async (key: string) => registrationLimiter.reset(key),
    resetPasswordReset: async (key: string) => passwordResetLimiter.reset(key),
  });
}

export const rateLimitPlugin = fp(rateLimitPluginImpl, {
  name: 'auth-rate-limit',
  dependencies: [],
});

// =============================================================================
// RATE LIMIT HELPERS
// =============================================================================

/**
 * Get client IP from request
 */
export function getClientIp(request: FastifyRequest): string {
  // Check forwarded headers first (for proxies)
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0];
    return first ? first.trim() : request.ip;
  }

  const realIp = request.headers['x-real-ip'];
  if (typeof realIp === 'string') {
    return realIp;
  }

  return request.ip;
}

/**
 * Get rate limit key for login (by email)
 */
export function getLoginRateLimitKey(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Get rate limit key for registration (by IP)
 */
export function getRegistrationRateLimitKey(request: FastifyRequest): string {
  return getClientIp(request);
}

/**
 * Get rate limit key for password reset (by email)
 */
export function getPasswordResetRateLimitKey(email: string): string {
  return email.toLowerCase().trim();
}

// =============================================================================
// RATE LIMIT HOOK FACTORY
// =============================================================================

/**
 * Create a preHandler hook for rate limiting
 *
 * @example
 * ```typescript
 * fastify.post('/login', {
 *   preHandler: createRateLimitHook('login', (req) => req.body.email),
 * }, loginHandler);
 * ```
 */
export function createRateLimitHook(
  type: 'login' | 'registration' | 'passwordReset',
  getKey: (request: FastifyRequest) => string
) {
  return async function rateLimitHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const fastify = request.server;
    const key = getKey(request);

    let result: RateLimitResult;

    switch (type) {
      case 'login':
        result = await fastify.rateLimit.login(key);
        break;
      case 'registration':
        result = await fastify.rateLimit.registration(key);
        break;
      case 'passwordReset':
        result = await fastify.rateLimit.passwordReset(key);
        break;
    }

    // Set rate limit headers
    void reply.header('X-RateLimit-Limit', result.current + result.remaining);
    void reply.header('X-RateLimit-Remaining', result.remaining);
    void reply.header('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      void reply.header('Retry-After', result.retryAfter);
      throw new RateLimitExceededError(
        `Too many ${type} attempts. Please try again later.`,
        result.retryAfter
      );
    }
  };
}

// =============================================================================
// PRE-BUILT HOOKS
// =============================================================================

/**
 * Rate limit hook for login endpoint
 */
export const loginRateLimitHook = createRateLimitHook('login', (request) => {
  const body = request.body as { email?: string };
  return body.email?.toLowerCase().trim() || getClientIp(request);
});

/**
 * Rate limit hook for registration endpoint
 */
export const registrationRateLimitHook = createRateLimitHook('registration', (request) => {
  return getClientIp(request);
});

/**
 * Rate limit hook for password reset endpoint
 */
export const passwordResetRateLimitHook = createRateLimitHook('passwordReset', (request) => {
  const body = request.body as { email?: string };
  return body.email?.toLowerCase().trim() || getClientIp(request);
});
