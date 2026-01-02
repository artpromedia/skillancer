/**
 * API Key Authentication Middleware
 * Sprint M10: Talent Intelligence API
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { structlog } from '@skillancer/logger';

const logger = structlog.get('api-key-auth');

// ============================================================================
// Types
// ============================================================================

export interface APIKeyContext {
  customerId: string;
  keyId: string;
  companyName: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  scopes: string[];
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyContext?: APIKeyContext;
  }
}

// ============================================================================
// Key Hashing
// ============================================================================

function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

function extractKeyPrefix(apiKey: string): string {
  // Format: sk_live_xxxxxxxxxxxx or sk_test_xxxxxxxxxxxx
  return apiKey.substring(0, 15) + '...';
}

// ============================================================================
// Scope Validation
// ============================================================================

const ENDPOINT_SCOPES: Record<string, string[]> = {
  '/v1/rates': ['rates:read'],
  '/v1/availability': ['availability:read'],
  '/v1/demand': ['demand:read'],
  '/v1/workforce': ['workforce:read', 'workforce:write'],
};

function getRequiredScopes(path: string): string[] {
  for (const [endpoint, scopes] of Object.entries(ENDPOINT_SCOPES)) {
    if (path.startsWith(endpoint)) {
      return scopes;
    }
  }
  return [];
}

function hasRequiredScopes(userScopes: string[], requiredScopes: string[]): boolean {
  // If no scopes required, allow
  if (requiredScopes.length === 0) return true;

  // Check if user has at least one required scope or wildcard
  if (userScopes.includes('*')) return true;

  return requiredScopes.some((scope) => userScopes.includes(scope));
}

// ============================================================================
// Rate Limiting (Per API Key)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(
  keyId: string,
  limitPerMinute: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = `rate:${keyId}:minute`;

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + 60000, // 1 minute from now
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);

  const remaining = Math.max(0, limitPerMinute - entry.count);
  const allowed = entry.count <= limitPerMinute;

  return { allowed, remaining, resetAt: entry.resetAt };
}

// ============================================================================
// Authentication Middleware
// ============================================================================

export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string;

  // Check for API key presence
  if (!apiKey) {
    logger.warn('Missing API key', {
      url: request.url,
      ip: request.ip,
    });

    return reply.status(401).send({
      error: 'UNAUTHORIZED',
      message: 'API key is required. Include it in the X-API-Key header.',
      statusCode: 401,
    });
  }

  // Validate API key format
  if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
    logger.warn('Invalid API key format', {
      prefix: extractKeyPrefix(apiKey),
      ip: request.ip,
    });

    return reply.status(401).send({
      error: 'INVALID_API_KEY',
      message: 'Invalid API key format',
      statusCode: 401,
    });
  }

  // Hash the API key for lookup
  const keyHash = hashApiKey(apiKey);

  // Look up API key in database
  const keyData = await lookupApiKey(keyHash);

  if (!keyData) {
    logger.warn('API key not found', {
      prefix: extractKeyPrefix(apiKey),
      ip: request.ip,
    });

    return reply.status(401).send({
      error: 'INVALID_API_KEY',
      message: 'API key not found or invalid',
      statusCode: 401,
    });
  }

  // Check if key is active
  if (keyData.status !== 'ACTIVE') {
    logger.warn('API key not active', {
      keyId: keyData.keyId,
      status: keyData.status,
    });

    return reply.status(401).send({
      error: 'API_KEY_INACTIVE',
      message: `API key is ${keyData.status.toLowerCase()}`,
      statusCode: 401,
    });
  }

  // Check if key has expired
  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
    logger.warn('API key expired', { keyId: keyData.keyId });

    return reply.status(401).send({
      error: 'API_KEY_EXPIRED',
      message: 'API key has expired',
      statusCode: 401,
    });
  }

  // Check if customer is active
  if (keyData.customerStatus !== 'ACTIVE') {
    logger.warn('Customer not active', {
      customerId: keyData.customerId,
      status: keyData.customerStatus,
    });

    return reply.status(403).send({
      error: 'ACCOUNT_SUSPENDED',
      message: 'Your account is suspended. Please contact support.',
      statusCode: 403,
    });
  }

  // Check scopes
  const requiredScopes = getRequiredScopes(request.url);
  if (!hasRequiredScopes(keyData.scopes, requiredScopes)) {
    logger.warn('Insufficient scopes', {
      keyId: keyData.keyId,
      required: requiredScopes,
      has: keyData.scopes,
    });

    return reply.status(403).send({
      error: 'INSUFFICIENT_SCOPES',
      message: `This endpoint requires one of: ${requiredScopes.join(', ')}`,
      statusCode: 403,
    });
  }

  // Check rate limit
  const rateLimit = checkRateLimit(keyData.keyId, keyData.rateLimitPerMinute);

  // Set rate limit headers
  reply.header('X-RateLimit-Limit', keyData.rateLimitPerMinute);
  reply.header('X-RateLimit-Remaining', rateLimit.remaining);
  reply.header('X-RateLimit-Reset', Math.ceil(rateLimit.resetAt / 1000));

  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { keyId: keyData.keyId });

    return reply.status(429).send({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Rate limit exceeded. Please slow down your requests.',
      retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      statusCode: 429,
    });
  }

  // Attach context to request
  request.apiKeyContext = {
    customerId: keyData.customerId,
    keyId: keyData.keyId,
    companyName: keyData.companyName,
    plan: keyData.plan,
    scopes: keyData.scopes,
    rateLimitPerMinute: keyData.rateLimitPerMinute,
    rateLimitPerDay: keyData.rateLimitPerDay,
  };

  // Update last used timestamp (async, don't wait)
  updateLastUsed(keyData.keyId).catch((err) =>
    logger.error('Failed to update last used', { error: err })
  );

  logger.info('API key authenticated', {
    keyId: keyData.keyId,
    customerId: keyData.customerId,
    endpoint: request.url,
  });
}

// ============================================================================
// Database Functions
// ============================================================================

interface APIKeyData {
  keyId: string;
  customerId: string;
  companyName: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  customerStatus: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'PENDING';
  expiresAt: Date | null;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
}

async function lookupApiKey(keyHash: string): Promise<APIKeyData | null> {
  // In production, query from database:
  // const key = await prisma.aPIKey.findUnique({
  //   where: { keyHash },
  //   include: { customer: true },
  // });

  // Mock implementation for development
  if (keyHash === hashApiKey('sk_test_demo_key_12345')) {
    return {
      keyId: 'key_demo_123',
      customerId: 'cust_demo_123',
      companyName: 'Demo Company',
      plan: 'PROFESSIONAL',
      scopes: ['rates:read', 'availability:read', 'demand:read', 'workforce:read'],
      status: 'ACTIVE',
      customerStatus: 'ACTIVE',
      expiresAt: null,
      rateLimitPerMinute: 100,
      rateLimitPerDay: 10000,
    };
  }

  return null;
}

async function updateLastUsed(keyId: string): Promise<void> {
  // In production:
  // await prisma.aPIKey.update({
  //   where: { id: keyId },
  //   data: { lastUsedAt: new Date() },
  // });

  logger.debug('Updated last used', { keyId });
}

export { hashApiKey, extractKeyPrefix };
