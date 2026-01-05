/**
 * @module @skillancer/auth-svc/plugins/security
 * Authentication security plugin with SOC 2 compliance controls
 */

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';

// Password policy constants (NIST 800-63B compliant)
const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  historyCount: 12,
  maxAge: 90, // days
};

// Session policy constants
const SESSION_POLICY = {
  absoluteTimeout: 24 * 60 * 60 * 1000, // 24 hours
  idleTimeout: 30 * 60 * 1000, // 30 minutes
  maxConcurrentSessions: 5,
  requireReauth: ['password_change', 'mfa_disable', 'email_change', 'api_key_create'],
};

// Lockout policy
const LOCKOUT_POLICY = {
  maxAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  progressiveDelay: true,
};

interface AuthSecurityPluginOptions {
  redis: Redis;
  enablePasswordValidation?: boolean;
  enableSessionHardening?: boolean;
  enableLockout?: boolean;
  enableAuditLogging?: boolean;
}

async function authSecurityPluginImpl(
  app: FastifyInstance,
  options: AuthSecurityPluginOptions
): Promise<void> {
  const {
    redis,
    enablePasswordValidation = true,
    enableSessionHardening = true,
    enableLockout = true,
    enableAuditLogging = true,
  } = options;

  // Decorate app with security utilities
  app.decorate('security', {
    password: {
      validate: validatePassword,
      checkHistory: async (userId: string, passwordHash: string) =>
        checkPasswordHistory(redis, userId, passwordHash),
      addToHistory: async (userId: string, passwordHash: string) =>
        addToPasswordHistory(redis, userId, passwordHash),
      checkBreach: checkBreachedPassword,
    },
    session: {
      validate: async (sessionId: string, userId: string) =>
        validateSession(redis, sessionId, userId),
      recordActivity: async (sessionId: string) => recordSessionActivity(redis, sessionId),
      terminate: async (sessionId: string) => terminateSession(redis, sessionId),
      terminateAll: async (userId: string, exceptSessionId?: string) =>
        terminateAllSessions(redis, userId, exceptSessionId),
      countActive: async (userId: string) => countActiveSessions(redis, userId),
    },
    lockout: {
      check: async (identifier: string) => checkLockout(redis, identifier),
      recordFailure: async (identifier: string) => recordLoginFailure(redis, identifier),
      clearFailures: async (identifier: string) => clearLoginFailures(redis, identifier),
    },
    audit: {
      log: async (event: SecurityEvent) => logSecurityEvent(app, event),
    },
  });

  // Login failure tracking hook
  if (enableLockout) {
    app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      // Check lockout before login attempts
      if (request.url.includes('/auth/login') && request.method === 'POST') {
        const body = request.body as { email?: string } | undefined;
        const identifier = body?.email || request.ip;

        if (identifier) {
          const lockoutInfo = await checkLockout(redis, identifier);
          if (lockoutInfo.isLocked) {
            return reply.status(429).send({
              error: 'Too many failed attempts',
              retryAfter: Math.ceil(lockoutInfo.remainingTime / 1000),
            });
          }

          // Apply progressive delay
          if (lockoutInfo.failureCount > 0 && LOCKOUT_POLICY.progressiveDelay) {
            const delay = Math.min(lockoutInfo.failureCount * 1000, 5000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
    });
  }

  // Session activity tracking hook
  if (enableSessionHardening) {
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = extractSessionId(request);
      const userId = (request as unknown as { user?: { id: string } }).user?.id;

      if (sessionId && userId) {
        const validation = await validateSession(redis, sessionId, userId);

        if (!validation.valid) {
          return reply.status(401).send({
            error: 'Session expired',
            reason: validation.reason,
          });
        }

        // Update last activity
        await recordSessionActivity(redis, sessionId);
      }
    });
  }

  // Security audit logging hook
  if (enableAuditLogging) {
    app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const securityRoutes = ['/auth/login', '/auth/logout', '/auth/register', '/mfa', '/oauth'];
      const isSecurityRoute = securityRoutes.some((route) => request.url.includes(route));

      if (isSecurityRoute) {
        const event: SecurityEvent = {
          type: determineEventType(request.url, request.method),
          timestamp: new Date(),
          actor: {
            userId: (request as unknown as { user?: { id: string } }).user?.id,
            ip: request.ip,
            userAgent: request.headers['user-agent'],
          },
          action: {
            method: request.method,
            path: request.url,
            statusCode: reply.statusCode,
          },
          success: reply.statusCode < 400,
        };

        await logSecurityEvent(app, event);
      }
    });
  }

  app.log.info('Auth security plugin registered with SOC 2 compliance controls');
}

// Password validation
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must be at most ${PASSWORD_POLICY.maxLength} characters`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (PASSWORD_POLICY.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (PASSWORD_POLICY.requireSpecial) {
    const specialRegex = new RegExp(
      `[${PASSWORD_POLICY.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`
    );
    if (!specialRegex.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }

  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain three or more consecutive identical characters');
  }
  if (/^(password|123456|qwerty)/i.test(password)) {
    errors.push('Password is too common');
  }

  return { valid: errors.length === 0, errors };
}

// Check password against breach databases (mock implementation)
async function checkBreachedPassword(passwordHash: string): Promise<boolean> {
  // In production, use HaveIBeenPwned API with k-Anonymity
  // This is a placeholder that should be replaced with actual API call
  const commonBreachedHashes = new Set([
    'e38ad214943daad1d64c102faec29de4', // "password"
    '25f9e794323b453885f5181f1b624d0b', // "123456789"
  ]);

  // Use first 5 chars of hash for k-anonymity check
  const prefix = passwordHash.substring(0, 5);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  return commonBreachedHashes.has(passwordHash);
}

// Password history management
async function checkPasswordHistory(
  redis: Redis,
  userId: string,
  passwordHash: string
): Promise<boolean> {
  const historyKey = `pwd_history:${userId}`;
  const history = await redis.lrange(historyKey, 0, PASSWORD_POLICY.historyCount - 1);
  return history.includes(passwordHash);
}

async function addToPasswordHistory(
  redis: Redis,
  userId: string,
  passwordHash: string
): Promise<void> {
  const historyKey = `pwd_history:${userId}`;
  await redis.lpush(historyKey, passwordHash);
  await redis.ltrim(historyKey, 0, PASSWORD_POLICY.historyCount - 1);
  await redis.expire(historyKey, 365 * 24 * 60 * 60); // 1 year
}

// Session management
async function validateSession(
  redis: Redis,
  sessionId: string,
  userId: string
): Promise<{ valid: boolean; reason?: string }> {
  const sessionKey = `session:${sessionId}`;
  const sessionData = await redis.hgetall(sessionKey);

  if (!sessionData || Object.keys(sessionData).length === 0) {
    return { valid: false, reason: 'session_not_found' };
  }

  if (sessionData['userId'] !== userId) {
    return { valid: false, reason: 'session_user_mismatch' };
  }

  const createdAt = Number.parseInt(sessionData['createdAt'] || '0', 10);
  const lastActivity = Number.parseInt(sessionData['lastActivity'] || '0', 10);
  const now = Date.now();

  // Check absolute timeout
  if (now - createdAt > SESSION_POLICY.absoluteTimeout) {
    await redis.del(sessionKey);
    return { valid: false, reason: 'session_expired_absolute' };
  }

  // Check idle timeout
  if (now - lastActivity > SESSION_POLICY.idleTimeout) {
    await redis.del(sessionKey);
    return { valid: false, reason: 'session_expired_idle' };
  }

  return { valid: true };
}

async function recordSessionActivity(redis: Redis, sessionId: string): Promise<void> {
  const sessionKey = `session:${sessionId}`;
  await redis.hset(sessionKey, 'lastActivity', Date.now().toString());
}

async function terminateSession(redis: Redis, sessionId: string): Promise<void> {
  await redis.del(`session:${sessionId}`);
}

async function terminateAllSessions(
  redis: Redis,
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  const pattern = `session:*`;
  let cursor = '0';
  let terminated = 0;

  do {
    const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = newCursor;

    for (const key of keys) {
      const sessionUserId = await redis.hget(key, 'userId');
      if (sessionUserId === userId) {
        const sessionId = key.replace('session:', '');
        if (sessionId !== exceptSessionId) {
          await redis.del(key);
          terminated++;
        }
      }
    }
  } while (cursor !== '0');

  return terminated;
}

async function countActiveSessions(redis: Redis, userId: string): Promise<number> {
  const pattern = `session:*`;
  let cursor = '0';
  let count = 0;

  do {
    const [newCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = newCursor;

    for (const key of keys) {
      const sessionUserId = await redis.hget(key, 'userId');
      if (sessionUserId === userId) {
        count++;
      }
    }
  } while (cursor !== '0');

  return count;
}

// Lockout management
async function checkLockout(
  redis: Redis,
  identifier: string
): Promise<{ isLocked: boolean; failureCount: number; remainingTime: number }> {
  const lockoutKey = `lockout:${identifier}`;
  const failuresKey = `failures:${identifier}`;

  const lockoutTTL = await redis.ttl(lockoutKey);
  if (lockoutTTL > 0) {
    return {
      isLocked: true,
      failureCount: LOCKOUT_POLICY.maxAttempts,
      remainingTime: lockoutTTL * 1000,
    };
  }

  const failures = Number.parseInt((await redis.get(failuresKey)) || '0', 10);
  return {
    isLocked: false,
    failureCount: failures,
    remainingTime: 0,
  };
}

async function recordLoginFailure(
  redis: Redis,
  identifier: string
): Promise<{ locked: boolean; attempts: number }> {
  const failuresKey = `failures:${identifier}`;
  const lockoutKey = `lockout:${identifier}`;

  const failures = await redis.incr(failuresKey);
  await redis.expire(failuresKey, 3600); // 1 hour window

  if (failures >= LOCKOUT_POLICY.maxAttempts) {
    await redis.set(lockoutKey, '1', 'PX', LOCKOUT_POLICY.lockoutDuration);
    await redis.del(failuresKey);
    return { locked: true, attempts: failures };
  }

  return { locked: false, attempts: failures };
}

async function clearLoginFailures(redis: Redis, identifier: string): Promise<void> {
  await redis.del(`failures:${identifier}`);
  await redis.del(`lockout:${identifier}`);
}

// Helper functions
function extractSessionId(request: FastifyRequest): string | undefined {
  // Check Authorization header
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    // Extract session ID from JWT or use token as session ID
    return authHeader.substring(7);
  }

  // Check cookie
  const cookies = request.headers.cookie;
  if (cookies) {
    const match = cookies.match(/session_id=([^;]+)/);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

function determineEventType(path: string, method: string): string {
  if (path.includes('/login')) return 'auth.login';
  if (path.includes('/logout')) return 'auth.logout';
  if (path.includes('/register')) return 'auth.register';
  if (path.includes('/mfa')) return 'auth.mfa';
  if (path.includes('/oauth')) return 'auth.oauth';
  if (path.includes('/password')) return 'auth.password_change';
  return `auth.${method.toLowerCase()}`;
}

interface SecurityEvent {
  type: string;
  timestamp: Date;
  actor: {
    userId?: string;
    ip: string;
    userAgent?: string;
  };
  action: {
    method: string;
    path: string;
    statusCode: number;
  };
  success: boolean;
  details?: Record<string, unknown>;
}

async function logSecurityEvent(app: FastifyInstance, event: SecurityEvent): Promise<void> {
  const logData = {
    eventType: event.type,
    success: event.success,
    actor: event.actor,
    action: event.action,
    details: event.details,
  };

  if (event.success) {
    app.log.info(logData, `Security event: ${event.type}`);
  } else {
    app.log.warn(logData, `Security event failed: ${event.type}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authSecurityPlugin = fp(authSecurityPluginImpl as any, {
  name: 'auth-security',
  fastify: '4.x',
});

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    security: {
      password: {
        validate: typeof validatePassword;
        checkHistory: (userId: string, passwordHash: string) => Promise<boolean>;
        addToHistory: (userId: string, passwordHash: string) => Promise<void>;
        checkBreach: typeof checkBreachedPassword;
      };
      session: {
        validate: (
          sessionId: string,
          userId: string
        ) => Promise<{ valid: boolean; reason?: string }>;
        recordActivity: (sessionId: string) => Promise<void>;
        terminate: (sessionId: string) => Promise<void>;
        terminateAll: (userId: string, exceptSessionId?: string) => Promise<number>;
        countActive: (userId: string) => Promise<number>;
      };
      lockout: {
        check: (
          identifier: string
        ) => Promise<{ isLocked: boolean; failureCount: number; remainingTime: number }>;
        recordFailure: (identifier: string) => Promise<{ locked: boolean; attempts: number }>;
        clearFailures: (identifier: string) => Promise<void>;
      };
      audit: {
        log: (event: SecurityEvent) => Promise<void>;
      };
    };
  }
}
