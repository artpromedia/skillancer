/**
 * @module @skillancer/api-gateway/plugins/security
 * Advanced security plugin integrating SOC 2 compliance controls
 */

import fp from 'fastify-plugin';

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Import type extensions to ensure authenticate/optionalAuth decorators are available
import '../types/index.js';

// Security headers configuration
const SECURITY_HEADERS = {
  // Content Security Policy - restrict resource loading
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.skillancer.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.skillancer.com wss://ws.skillancer.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; '),

  // Strict Transport Security - enforce HTTPS
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Clickjacking protection
  'X-Frame-Options': 'DENY',

  // XSS protection (legacy browsers)
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy - limit referrer info
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy - restrict browser features
  'Permissions-Policy': [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=(self)',
    'usb=()',
  ].join(', '),

  // Prevent caching of sensitive responses
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

// Request validation patterns - split into smaller regexes to reduce complexity
const SQL_INJECTION_BASIC = /('|"|;|--|\/\*|\*\/)/i;
const SQL_INJECTION_COMMANDS = /(xp_|exec\s|execute\s)/i;
const SQL_INJECTION_STATEMENTS =
  /(union\s+select|insert\s+into|delete\s+from|drop\s+table|update\s+set)/i;

const INJECTION_PATTERNS = {
  sqlInjectionBasic: SQL_INJECTION_BASIC,
  sqlInjectionCommands: SQL_INJECTION_COMMANDS,
  sqlInjectionStatements: SQL_INJECTION_STATEMENTS,
  noSqlInjection:
    /(\$where|\$gt|\$lt|\$gte|\$lte|\$ne|\$in|\$nin|\$or|\$and|\$not|\$nor|\$exists|\$type|\$regex)/i,
  pathTraversal: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)/i,
  commandInjection: /(;|\||`|\$\(|&&|\|\||>|<|&)/,
  xssPatterns: /(<script|javascript:|on\w+\s*=|<iframe|<object|<embed|<svg|<img.*onerror)/i,
};

/** Check for SQL injection patterns */
function hasSqlInjection(input: string): boolean {
  return (
    SQL_INJECTION_BASIC.test(input) ||
    SQL_INJECTION_COMMANDS.test(input) ||
    SQL_INJECTION_STATEMENTS.test(input)
  );
}

interface SecurityPluginOptions {
  /**
   * Enable security headers
   * @default true
   */
  headers?: boolean;

  /**
   * Enable request validation (injection detection)
   * @default true
   */
  validation?: boolean;

  /**
   * Enable request size limits
   * @default true
   */
  sizeLimits?: boolean;

  /**
   * Maximum request body size in bytes
   * @default 1MB
   */
  maxBodySize?: number;

  /**
   * Paths to skip validation for
   */
  skipValidation?: string[];

  /**
   * Enable audit logging
   * @default true
   */
  auditLogging?: boolean;
}

function securityPluginImpl(app: FastifyInstance, options: SecurityPluginOptions = {}): void {
  const {
    headers = true,
    validation = true,
    sizeLimits = true,
    maxBodySize = 1024 * 1024, // 1MB
    skipValidation = ['/health', '/ready', '/metrics'],
    auditLogging = true,
  } = options;

  // Add security headers to all responses
  if (headers) {
    // eslint-disable-next-line @typescript-eslint/require-await
    app.addHook('onSend', async (_request: FastifyRequest, reply: FastifyReply) => {
      for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
        void reply.header(header, value);
      }
    });
  }

  // Request validation hook
  if (validation) {
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip validation for health endpoints
      if (skipValidation.some((path) => request.url.startsWith(path))) {
        return;
      }

      // Validate request body
      if (request.body && typeof request.body === 'object') {
        const bodyString = JSON.stringify(request.body);

        if (hasSqlInjection(bodyString)) {
          request.log.warn(
            { type: 'sql_injection_attempt', ip: request.ip },
            'SQL injection attempt detected'
          );
          return reply.status(400).send({ error: 'Invalid request content' });
        }

        if (INJECTION_PATTERNS.noSqlInjection.test(bodyString)) {
          request.log.warn(
            { type: 'nosql_injection_attempt', ip: request.ip },
            'NoSQL injection attempt detected'
          );
          return reply.status(400).send({ error: 'Invalid request content' });
        }

        if (INJECTION_PATTERNS.xssPatterns.test(bodyString)) {
          request.log.warn({ type: 'xss_attempt', ip: request.ip }, 'XSS attempt detected');
          return reply.status(400).send({ error: 'Invalid request content' });
        }
      }

      // Validate URL path
      if (INJECTION_PATTERNS.pathTraversal.test(request.url)) {
        request.log.warn(
          { type: 'path_traversal_attempt', ip: request.ip, path: request.url },
          'Path traversal attempt detected'
        );
        return reply.status(400).send({ error: 'Invalid request path' });
      }

      // Validate query parameters
      const queryString = JSON.stringify(request.query);
      if (hasSqlInjection(queryString) || INJECTION_PATTERNS.noSqlInjection.test(queryString)) {
        request.log.warn(
          { type: 'query_injection_attempt', ip: request.ip },
          'Query injection attempt detected'
        );
        return reply.status(400).send({ error: 'Invalid query parameters' });
      }
    });
  }

  // Request size validation
  if (sizeLimits) {
    app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
      const contentLength = request.headers['content-length'];
      if (contentLength && Number.parseInt(contentLength, 10) > maxBodySize) {
        request.log.warn(
          {
            type: 'request_too_large',
            size: contentLength,
            maxSize: maxBodySize,
          },
          'Request body too large'
        );
        return reply.status(413).send({ error: 'Request entity too large' });
      }
    });
  }

  // Security audit logging
  if (auditLogging) {
    app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      // Log security-relevant requests
      const securityEndpoints = ['/auth', '/mfa', '/oauth', '/admin', '/api-keys'];
      const isSecurityEndpoint = securityEndpoints.some((ep) => request.url.includes(ep));

      if (isSecurityEndpoint || reply.statusCode >= 400) {
        const logData = {
          type: 'security_audit',
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          ip: request.ip,
          userAgent: request.headers['user-agent'],
          requestId: request.id,
          userId: (request as unknown as { user?: { id: string } }).user?.id,
          duration: reply.elapsedTime,
        };

        if (reply.statusCode >= 400) {
          request.log.warn(logData, 'Security event - error response');
        } else {
          request.log.info(logData, 'Security event - auth access');
        }
      }
    });
  }

  // Add security utilities to request
  app.decorateRequest('isTrustedOrigin', function (this: FastifyRequest): boolean {
    const origin = this.headers.origin || this.headers.referer;
    if (!origin) return false;

    const trustedOrigins = [
      'https://skillancer.com',
      'https://www.skillancer.com',
      'https://api.skillancer.com',
      'https://app.skillancer.com',
    ];

    if (process.env['NODE_ENV'] !== 'production') {
      trustedOrigins.push('http://localhost:3000', 'http://localhost:3001');
    }

    return trustedOrigins.some((trusted) => origin.startsWith(trusted));
  });

  app.decorateRequest('getClientFingerprint', function (this: FastifyRequest): string {
    const components = [
      this.ip,
      this.headers['user-agent'] || '',
      this.headers['accept-language'] || '',
      this.headers['accept-encoding'] || '',
    ];

    // Simple hash for fingerprinting
    const str = components.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.codePointAt(i) ?? 0;
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  });

  app.log.info('Security plugin registered with SOC 2 compliance controls');
}

export const securityPlugin = fp(securityPluginImpl, {
  name: 'security',
  fastify: '4.x',
});
