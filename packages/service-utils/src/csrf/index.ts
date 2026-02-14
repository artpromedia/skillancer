/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
/**
 * @module @skillancer/service-utils/csrf
 * CSRF (Cross-Site Request Forgery) Protection
 *
 * Provides token-based CSRF protection for state-changing operations.
 *
 * Features:
 * - Double Submit Cookie pattern
 * - Token generation and validation
 * - Automatic token refresh
 * - Configurable exclusion patterns
 *
 * @example
 * ```typescript
 * import { csrfPlugin, getCsrfToken } from '@skillancer/service-utils/csrf';
 *
 * // Register plugin
 * app.register(csrfPlugin);
 *
 * // Get token endpoint
 * app.get('/csrf-token', (req, reply) => {
 *   reply.send({ token: getCsrfToken(req) });
 * });
 * ```
 */

import crypto from 'crypto';

import fp from 'fastify-plugin';

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

export interface CsrfConfig {
  /** Cookie name for CSRF token */
  cookieName: string;
  /** Header name to check for token */
  headerName: string;
  /** Form field name to check for token */
  formFieldName: string;
  /** Token expiry in seconds */
  tokenExpiry: number;
  /** Secret for HMAC signing */
  secret: string;
  /** HTTP methods that require CSRF validation */
  protectedMethods: string[];
  /** Paths to exclude from CSRF validation */
  excludePaths: string[];
  /** Path patterns (regex) to exclude from CSRF validation */
  excludePatterns: RegExp[];
  /** Whether to set Secure flag on cookie */
  secureCookie: boolean;
  /** SameSite cookie attribute */
  sameSite: 'strict' | 'lax' | 'none';
}

export interface CsrfToken {
  value: string;
  timestamp: number;
  signature: string;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const defaultConfig: CsrfConfig = {
  cookieName: '_csrf',
  headerName: 'x-csrf-token',
  formFieldName: '_csrf',
  tokenExpiry: 3600, // 1 hour
  secret: process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex'),
  protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  excludePaths: [
    '/health',
    '/ready',
    '/metrics',
    '/api/webhooks', // Webhooks use signature verification instead
  ],
  excludePatterns: [
    /^\/api\/v\d+\/webhooks/, // Versioned webhook endpoints
    /^\/api\/auth\/callback/, // OAuth callbacks
  ],
  secureCookie: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
};

// =============================================================================
// TOKEN GENERATION & VALIDATION
// =============================================================================

/**
 * Generate a CSRF token
 */
function generateToken(secret: string): CsrfToken {
  const value = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  const signature = signToken(value, timestamp, secret);

  return { value, timestamp, signature };
}

/**
 * Sign a token with HMAC
 */
function signToken(value: string, timestamp: number, secret: string): string {
  const data = `${value}:${timestamp}`;
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Validate a CSRF token
 */
function validateToken(
  token: string | undefined,
  cookieToken: CsrfToken | undefined,
  config: CsrfConfig
): { valid: boolean; reason?: string } {
  if (!token) {
    return { valid: false, reason: 'Missing CSRF token' };
  }

  if (!cookieToken) {
    return { valid: false, reason: 'Missing CSRF cookie' };
  }

  // Check expiry
  const age = Date.now() - cookieToken.timestamp;
  if (age > config.tokenExpiry * 1000) {
    return { valid: false, reason: 'CSRF token expired' };
  }

  // Verify signature
  const expectedSignature = signToken(cookieToken.value, cookieToken.timestamp, config.secret);
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken.signature), Buffer.from(expectedSignature))) {
    return { valid: false, reason: 'Invalid CSRF cookie signature' };
  }

  // Compare tokens (timing-safe)
  if (token.length !== cookieToken.value.length) {
    return { valid: false, reason: 'CSRF token mismatch' };
  }

  if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(cookieToken.value))) {
    return { valid: false, reason: 'CSRF token mismatch' };
  }

  return { valid: true };
}

/**
 * Parse CSRF cookie value
 */
function parseCsrfCookie(cookieValue: string | undefined): CsrfToken | undefined {
  if (!cookieValue) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(cookieValue, 'base64').toString('utf-8');
    return JSON.parse(decoded) as CsrfToken;
  } catch {
    return undefined;
  }
}

/**
 * Serialize CSRF token for cookie
 */
function serializeCsrfToken(token: CsrfToken): string {
  return Buffer.from(JSON.stringify(token)).toString('base64');
}

// =============================================================================
// REQUEST HELPERS
// =============================================================================

/**
 * Extract CSRF token from request
 */
function extractToken(request: FastifyRequest, config: CsrfConfig): string | undefined {
  // Check header first
  const headerToken = request.headers[config.headerName.toLowerCase()];
  if (headerToken && typeof headerToken === 'string') {
    return headerToken;
  }

  // Check body (for form submissions)
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body === 'object' && config.formFieldName in body) {
    const formToken = body[config.formFieldName];
    if (typeof formToken === 'string') {
      return formToken;
    }
  }

  // Check query (for some edge cases)
  const query = request.query as Record<string, unknown>;
  if (query && config.formFieldName in query) {
    const queryToken = query[config.formFieldName];
    if (typeof queryToken === 'string') {
      return queryToken;
    }
  }

  return undefined;
}

/**
 * Check if path should be excluded from CSRF validation
 */
function shouldExclude(path: string, config: CsrfConfig): boolean {
  // Check exact paths
  if (config.excludePaths.some((excluded) => path.startsWith(excluded))) {
    return true;
  }

  // Check patterns
  if (config.excludePatterns.some((pattern) => pattern.test(path))) {
    return true;
  }

  return false;
}

// =============================================================================
// FASTIFY PLUGIN
// =============================================================================

/**
 * Get CSRF token from request (for sending to client)
 */
export function getCsrfToken(request: FastifyRequest): string | undefined {
  return (request as any).csrfToken?.value;
}

/**
 * CSRF Protection Plugin
 */
const csrfPluginImpl: FastifyPluginAsync<Partial<CsrfConfig>> = async (
  app: FastifyInstance,
  options?: Partial<CsrfConfig>
): Promise<void> => {
  const config: CsrfConfig = { ...defaultConfig, ...options };

  // Decorate request with CSRF token
  app.decorateRequest('csrfToken', null);

  // Hook to set CSRF cookie on every response
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const cookies = (request as any).cookies as Record<string, string> | undefined;
    const existingCookie = cookies?.[config.cookieName];
    const existingToken = parseCsrfCookie(existingCookie);

    // Check if token is valid and not expired
    if (existingToken) {
      const age = Date.now() - existingToken.timestamp;
      if (age < config.tokenExpiry * 1000) {
        // Verify signature
        const expectedSignature = signToken(
          existingToken.value,
          existingToken.timestamp,
          config.secret
        );
        if (
          crypto.timingSafeEqual(
            Buffer.from(existingToken.signature),
            Buffer.from(expectedSignature)
          )
        ) {
          // Token is valid, attach to request
          (request as any).csrfToken = existingToken;
          return;
        }
      }
    }

    // Generate new token
    const newToken = generateToken(config.secret);
    (request as any).csrfToken = newToken;

    // Set cookie (will be sent with response)
    (reply as any).setCookie(config.cookieName, serializeCsrfToken(newToken), {
      httpOnly: true,
      secure: config.secureCookie,
      sameSite: config.sameSite,
      path: '/',
      maxAge: config.tokenExpiry,
    });
  });

  // Hook to validate CSRF token on protected methods
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip non-protected methods
    if (!config.protectedMethods.includes(request.method)) {
      return;
    }

    // Skip excluded paths
    if (shouldExclude(request.url, config)) {
      return;
    }

    // Skip if Content-Type indicates webhook/API call with signature verification
    const contentType = request.headers['content-type'];
    if (contentType?.includes('application/webhook+json')) {
      return;
    }

    // Extract and validate token
    const submittedToken = extractToken(request, config);
    const cookieToken = (request as any).csrfToken as CsrfToken | undefined;

    const validation = validateToken(submittedToken, cookieToken, config);

    if (!validation.valid) {
      request.log.warn(
        {
          reason: validation.reason,
          path: request.url,
          method: request.method,
        },
        'CSRF validation failed'
      );

      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'CSRF validation failed',
        code: 'CSRF_INVALID',
      });
    }
  });

  // Endpoint to get CSRF token
  app.get('/csrf-token', {
    schema: {
      description: 'Get CSRF token for form submissions',
      tags: ['security'],
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
          },
        },
      },
    } as any,
    handler: async (request: FastifyRequest) => {
      const token = getCsrfToken(request);
      return { token };
    },
  } as any);

  app.log.info('[CSRF] Protection enabled');
};

export const csrfPlugin = fp(csrfPluginImpl, {
  name: 'csrf-plugin',
  dependencies: ['@fastify/cookie'],
});

// =============================================================================
// REACT HOOK HELPERS
// =============================================================================

/**
 * Configuration for client-side CSRF handling
 */
export const csrfClientConfig = {
  headerName: defaultConfig.headerName,
  formFieldName: defaultConfig.formFieldName,
  tokenEndpoint: '/csrf-token',
};

/**
 * Type for CSRF fetch wrapper options
 */
export interface CsrfFetchOptions extends RequestInit {
  csrfToken?: string;
}

/**
 * Create a CSRF-protected fetch function
 * For use in client-side code
 */
export function createCsrfFetch(csrfToken: string) {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const method = options.method?.toUpperCase() || 'GET';

    // Only add token for state-changing methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const headers = new Headers(options.headers);
      headers.set(defaultConfig.headerName, csrfToken);

      return fetch(url, {
        ...options,
        headers,
      });
    }

    return fetch(url, options);
  };
}

// =============================================================================
// EXPRESS MIDDLEWARE (for compatibility)
// =============================================================================

/**
 * Express-style CSRF middleware
 */
export function createExpressCsrfMiddleware(options: Partial<CsrfConfig> = {}) {
  const config: CsrfConfig = { ...defaultConfig, ...options };

  return (req: any, res: any, next: () => void) => {
    // Generate or validate token
    const existingCookie = req.cookies?.[config.cookieName];
    const existingToken = parseCsrfCookie(existingCookie);

    if (!existingToken || Date.now() - existingToken.timestamp > config.tokenExpiry * 1000) {
      // Generate new token
      const newToken = generateToken(config.secret);
      req.csrfToken = newToken.value;

      res.cookie(config.cookieName, serializeCsrfToken(newToken), {
        httpOnly: true,
        secure: config.secureCookie,
        sameSite: config.sameSite,
        path: '/',
        maxAge: config.tokenExpiry * 1000,
      });
    } else {
      req.csrfToken = existingToken.value;
    }

    // Skip validation for safe methods
    if (!config.protectedMethods.includes(req.method)) {
      return next();
    }

    // Skip excluded paths
    if (shouldExclude(req.path, config)) {
      return next();
    }

    // Validate token
    const submittedToken =
      req.headers[config.headerName.toLowerCase()] || req.body?.[config.formFieldName];

    const validation = validateToken(submittedToken, existingToken, config);

    if (!validation.valid) {
      return res.status(403).json({
        statusCode: 403,
        error: 'Forbidden',
        message: 'CSRF validation failed',
        code: 'CSRF_INVALID',
      });
    }

    next();
  };
}

export default {
  csrfPlugin,
  getCsrfToken,
  createCsrfFetch,
  createExpressCsrfMiddleware,
  csrfClientConfig,
};
