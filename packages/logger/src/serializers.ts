/**
 * @fileoverview Custom serializers for structured logging
 *
 * Serializers transform objects into log-friendly formats, ensuring
 * consistent structure and preventing sensitive data from being logged.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Request, Response } from 'express';
import type { HttpRequestLog, HttpResponseLog, ErrorLog } from './types.js';

/**
 * Headers that should be included in request logs
 */
const ALLOWED_REQUEST_HEADERS = [
  'host',
  'user-agent',
  'accept',
  'accept-language',
  'accept-encoding',
  'content-type',
  'content-length',
  'origin',
  'referer',
  'x-request-id',
  'x-correlation-id',
  'x-forwarded-for',
  'x-forwarded-proto',
  'x-real-ip',
];

/**
 * Headers that should be included in response logs
 */
const ALLOWED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'cache-control',
  'x-request-id',
  'x-correlation-id',
  'x-response-time',
];

/**
 * Filter headers to only include allowed ones
 */
function filterHeaders(
  headers: Record<string, unknown> | undefined,
  allowedHeaders: string[]
): Record<string, string> {
  if (!headers) return {};

  const filtered: Record<string, string> = {};

  for (const key of allowedHeaders) {
    const value = headers[key] ?? headers[key.toLowerCase()];
    if (value !== undefined && value !== null) {
      filtered[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  }

  return filtered;
}

/**
 * Extract client IP from request
 */
function getClientIp(req: {
  headers?: Record<string, unknown>;
  ip?: string | undefined;
  socket?: { remoteAddress?: string | undefined } | undefined;
}): string | undefined {
  // Check X-Forwarded-For header first (for proxied requests)
  const forwardedFor = req.headers?.['x-forwarded-for'];
  if (forwardedFor) {
    const ips = String(forwardedFor)
      .split(',')
      .map((ip) => ip.trim());
    return ips[0];
  }

  // Check X-Real-IP header
  const realIp = req.headers?.['x-real-ip'];
  if (realIp) {
    return String(realIp);
  }

  // Fall back to direct IP
  return req.ip ?? req.socket?.remoteAddress;
}

/**
 * Serialize a Fastify request for logging
 */
export function serializeFastifyRequest(req: FastifyRequest): HttpRequestLog {
  return {
    method: req.method,
    url: req.url,
    path: req.routerPath ?? req.url.split('?')[0],
    query: req.query as Record<string, string> | undefined,
    params: req.params as Record<string, string> | undefined,
    headers: filterHeaders(req.headers as Record<string, unknown>, ALLOWED_REQUEST_HEADERS),
    remoteAddress: getClientIp({
      headers: req.headers as Record<string, unknown>,
      ip: req.ip,
      socket: req.socket,
    }),
    userAgent: req.headers['user-agent'],
  };
}

/**
 * Serialize a Fastify reply for logging
 */
export function serializeFastifyReply(reply: FastifyReply): HttpResponseLog {
  return {
    statusCode: reply.statusCode,
    headers: filterHeaders(reply.getHeaders() as Record<string, unknown>, ALLOWED_RESPONSE_HEADERS),
  };
}

/**
 * Serialize an Express request for logging
 */
export function serializeExpressRequest(req: Request): HttpRequestLog {
  return {
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    query: req.query as Record<string, string> | undefined,
    params: req.params as Record<string, string> | undefined,
    headers: filterHeaders(req.headers as Record<string, unknown>, ALLOWED_REQUEST_HEADERS),
    remoteAddress: getClientIp({
      headers: req.headers as Record<string, unknown>,
      ip: req.ip,
      socket: req.socket,
    }),
    userAgent: req.headers['user-agent'],
  };
}

/**
 * Serialize an Express response for logging
 */
export function serializeExpressResponse(res: Response): HttpResponseLog {
  const headers: Record<string, unknown> = {};

  // Express responses use getHeader method
  for (const key of ALLOWED_RESPONSE_HEADERS) {
    const value = res.getHeader(key);
    if (value !== undefined) {
      headers[key] = value;
    }
  }

  return {
    statusCode: res.statusCode,
    headers: filterHeaders(headers, ALLOWED_RESPONSE_HEADERS),
  };
}

/**
 * Serialize an error for logging
 */
export function serializeError(error: unknown): ErrorLog {
  if (error instanceof Error) {
    const serialized: ErrorLog = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    // Include additional properties from custom error classes
    const errorWithCode = error as Error & {
      code?: string;
      statusCode?: number;
      details?: unknown;
    };

    if (errorWithCode.code) {
      serialized.code = errorWithCode.code;
    }

    if (errorWithCode.statusCode) {
      serialized.statusCode = errorWithCode.statusCode;
    }

    if (errorWithCode.details) {
      serialized.details = errorWithCode.details;
    }

    // Handle cause chain (ES2022+)
    if (error.cause) {
      serialized.cause = serializeError(error.cause);
    }

    return serialized;
  }

  // Handle non-Error objects
  if (typeof error === 'object' && error !== null) {
    return {
      name: 'UnknownError',
      message: String(error),
      details: error,
    };
  }

  // Handle primitives
  return {
    name: 'UnknownError',
    message: String(error),
  };
}

/**
 * Create Pino serializers object for use with createLogger
 */
export function createSerializers() {
  return {
    req: serializeFastifyRequest,
    res: serializeFastifyReply,
    err: serializeError,
    error: serializeError,
  };
}

/**
 * Sanitize an object for safe logging by removing circular references
 * and converting non-serializable values
 */
export function sanitizeForLogging(obj: unknown, seen = new WeakSet()): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'function') {
    return '[Function]';
  }

  if (typeof obj === 'symbol') {
    return obj.toString();
  }

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (obj instanceof RegExp) {
    return obj.toString();
  }

  if (obj instanceof Error) {
    return serializeError(obj);
  }

  if (ArrayBuffer.isView(obj) || obj instanceof ArrayBuffer) {
    return '[Binary Data]';
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Handle circular references
  if (seen.has(obj as object)) {
    return '[Circular]';
  }
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeForLogging(value, seen);
  }

  return sanitized;
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}µs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Calculate response time from request start
 */
export function calculateResponseTime(startTime: [number, number]): number {
  const [seconds, nanoseconds] = process.hrtime(startTime);
  return seconds * 1000 + nanoseconds / 1_000_000;
}
