/**
 * @module @skillancer/service-utils/caching
 * HTTP Response Caching Middleware
 *
 * Features:
 * - Cache-Control header management
 * - ETag generation and validation
 * - Conditional request handling (If-None-Match, If-Modified-Since)
 * - Stale-while-revalidate support
 * - Cache key generation
 *
 * @example
 * ```typescript
 * import { cachingPlugin, cacheControl } from '@skillancer/service-utils/caching';
 *
 * app.register(cachingPlugin);
 *
 * // Route with caching
 * app.get('/api/products', {
 *   preHandler: cacheControl({ maxAge: 300, staleWhileRevalidate: 60 }),
 *   handler: async (req, reply) => {
 *     return products;
 *   }
 * });
 * ```
 */

import crypto from 'crypto';
import fp from 'fastify-plugin';

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

export interface CacheControlOptions {
  /** Max age in seconds (browser cache) */
  maxAge?: number;
  /** Shared max age in seconds (CDN cache) */
  sMaxAge?: number;
  /** Stale-while-revalidate in seconds */
  staleWhileRevalidate?: number;
  /** Stale-if-error in seconds */
  staleIfError?: number;
  /** Cache is private (user-specific) */
  isPrivate?: boolean;
  /** No caching allowed */
  noCache?: boolean;
  /** No storing allowed */
  noStore?: boolean;
  /** Must revalidate with origin */
  mustRevalidate?: boolean;
  /** Immutable content (never changes) */
  immutable?: boolean;
  /** Vary headers for cache key */
  vary?: string[];
}

export interface ETagOptions {
  /** Use weak ETags */
  weak?: boolean;
  /** Custom ETag generator */
  generator?: (body: unknown) => string;
}

export interface CachingPluginConfig {
  /** Default cache control for all routes */
  defaultCacheControl?: CacheControlOptions;
  /** Enable ETag generation */
  enableETag?: boolean;
  /** ETag options */
  etagOptions?: ETagOptions;
  /** Routes to exclude from caching */
  excludeRoutes?: string[];
  /** Route patterns to exclude (regex) */
  excludePatterns?: RegExp[];
}

// =============================================================================
// CACHE CONTROL HEADER BUILDER
// =============================================================================

/**
 * Build Cache-Control header value
 */
export function buildCacheControlHeader(options: CacheControlOptions): string {
  const directives: string[] = [];

  if (options.noStore) {
    directives.push('no-store');
    return directives.join(', ');
  }

  if (options.noCache) {
    directives.push('no-cache');
  }

  if (options.isPrivate) {
    directives.push('private');
  } else {
    directives.push('public');
  }

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  if (options.immutable) {
    directives.push('immutable');
  }

  return directives.join(', ');
}

// =============================================================================
// ETAG GENERATION
// =============================================================================

/**
 * Generate ETag from content
 */
export function generateETag(content: unknown, weak = false): string {
  let data: string;

  if (typeof content === 'string') {
    data = content;
  } else if (Buffer.isBuffer(content)) {
    data = content.toString('base64');
  } else {
    data = JSON.stringify(content);
  }

  const hash = crypto.createHash('md5').update(data).digest('hex');
  return weak ? `W/"${hash}"` : `"${hash}"`;
}

/**
 * Parse ETag from If-None-Match header
 */
export function parseIfNoneMatch(header: string | undefined): string[] {
  if (!header) return [];

  return header
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Check if ETag matches
 */
export function etagMatches(etag: string, ifNoneMatch: string[]): boolean {
  if (ifNoneMatch.includes('*')) return true;

  // Normalize ETags for comparison (strip W/ prefix for weak comparison)
  const normalizedEtag = etag.replace(/^W\//, '');

  return ifNoneMatch.some((tag) => {
    const normalizedTag = tag.replace(/^W\//, '');
    return normalizedTag === normalizedEtag;
  });
}

// =============================================================================
// CACHE PRESETS
// =============================================================================

export const CachePresets = {
  /** No caching at all */
  noCache: (): CacheControlOptions => ({
    noStore: true,
  }),

  /** Private user data (short cache) */
  privateShort: (): CacheControlOptions => ({
    isPrivate: true,
    maxAge: 60,
    mustRevalidate: true,
  }),

  /** Private user data (medium cache) */
  privateMedium: (): CacheControlOptions => ({
    isPrivate: true,
    maxAge: 300,
    staleWhileRevalidate: 60,
  }),

  /** Public data (short cache) */
  publicShort: (): CacheControlOptions => ({
    isPrivate: false,
    maxAge: 60,
    sMaxAge: 120,
    staleWhileRevalidate: 30,
  }),

  /** Public data (medium cache) */
  publicMedium: (): CacheControlOptions => ({
    isPrivate: false,
    maxAge: 300,
    sMaxAge: 600,
    staleWhileRevalidate: 60,
  }),

  /** Public data (long cache) */
  publicLong: (): CacheControlOptions => ({
    isPrivate: false,
    maxAge: 3600,
    sMaxAge: 86400,
    staleWhileRevalidate: 300,
  }),

  /** Static assets (very long cache) */
  staticAssets: (): CacheControlOptions => ({
    isPrivate: false,
    maxAge: 31536000, // 1 year
    immutable: true,
  }),

  /** API response (short with revalidation) */
  apiResponse: (): CacheControlOptions => ({
    isPrivate: false,
    maxAge: 60,
    sMaxAge: 120,
    staleWhileRevalidate: 30,
    staleIfError: 300,
  }),
} as const;

// =============================================================================
// CACHE CONTROL DECORATOR
// =============================================================================

/**
 * Create cache control preHandler
 */
export function cacheControl(options: CacheControlOptions) {
  const headerValue = buildCacheControlHeader(options);

  return async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', headerValue);

    if (options.vary && options.vary.length > 0) {
      reply.header('Vary', options.vary.join(', '));
    }
  };
}

/**
 * Create no-cache preHandler
 */
export function noCache() {
  return cacheControl(CachePresets.noCache());
}

// =============================================================================
// FASTIFY PLUGIN
// =============================================================================

const defaultConfig: CachingPluginConfig = {
  enableETag: true,
  etagOptions: { weak: true },
  excludeRoutes: ['/health', '/ready', '/metrics'],
  excludePatterns: [/^\/api\/auth/, /^\/api\/webhooks/],
};

const cachingPluginImpl: FastifyPluginAsync<Partial<CachingPluginConfig>> = async (
  app: FastifyInstance,
  options?: Partial<CachingPluginConfig>
): Promise<void> => {
  const config: CachingPluginConfig = { ...defaultConfig, ...options };

  // Add ETag generation hook
  if (config.enableETag) {
    app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
      // Skip excluded routes
      if (shouldExclude(request.url, config)) {
        return payload;
      }

      // Skip non-GET/HEAD requests
      if (!['GET', 'HEAD'].includes(request.method)) {
        return payload;
      }

      // Skip if already has ETag
      if (reply.getHeader('etag')) {
        return payload;
      }

      // Skip error responses
      if (reply.statusCode >= 400) {
        return payload;
      }

      // Generate ETag
      const etag = config.etagOptions?.generator
        ? config.etagOptions.generator(payload)
        : generateETag(payload, config.etagOptions?.weak);

      reply.header('ETag', etag);

      // Check If-None-Match
      const ifNoneMatch = parseIfNoneMatch(request.headers['if-none-match'] as string);
      if (ifNoneMatch.length > 0 && etagMatches(etag, ifNoneMatch)) {
        reply.status(304);
        return '';
      }

      return payload;
    });
  }

  // Add default cache control for responses
  if (config.defaultCacheControl) {
    const headerValue = buildCacheControlHeader(config.defaultCacheControl);

    app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload) => {
      // Skip if already has Cache-Control
      if (reply.getHeader('cache-control')) {
        return payload;
      }

      // Skip excluded routes
      if (shouldExclude(request.url, config)) {
        return payload;
      }

      // Skip non-GET requests
      if (request.method !== 'GET') {
        return payload;
      }

      reply.header('Cache-Control', headerValue);
      return payload;
    });
  }

  app.log.info('[Caching] HTTP caching middleware enabled');
};

function shouldExclude(url: string, config: CachingPluginConfig): boolean {
  const path = url.split('?')[0];

  if (config.excludeRoutes?.some((route) => path.startsWith(route))) {
    return true;
  }

  if (config.excludePatterns?.some((pattern) => pattern.test(path))) {
    return true;
  }

  return false;
}

export const cachingPlugin = fp(cachingPluginImpl, {
  name: 'caching-plugin',
});

// =============================================================================
// CACHE KEY UTILITIES
// =============================================================================

/**
 * Generate cache key from request
 */
export function generateCacheKey(
  request: FastifyRequest,
  options?: {
    includeQuery?: boolean;
    includeHeaders?: string[];
    prefix?: string;
  }
): string {
  const parts: string[] = [];

  if (options?.prefix) {
    parts.push(options.prefix);
  }

  parts.push(request.method);
  parts.push(request.url.split('?')[0]);

  if (options?.includeQuery) {
    const query = request.query as Record<string, unknown>;
    if (Object.keys(query).length > 0) {
      const sortedQuery = Object.keys(query)
        .sort()
        .map((key) => `${key}=${query[key]}`)
        .join('&');
      parts.push(sortedQuery);
    }
  }

  if (options?.includeHeaders) {
    for (const header of options.includeHeaders) {
      const value = request.headers[header.toLowerCase()];
      if (value) {
        parts.push(`${header}:${value}`);
      }
    }
  }

  return parts.join(':');
}

/**
 * Generate cache key hash (for Redis)
 */
export function hashCacheKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

// =============================================================================
// CONDITIONAL REQUEST HELPERS
// =============================================================================

/**
 * Parse If-Modified-Since header
 */
export function parseIfModifiedSince(header: string | undefined): Date | null {
  if (!header) return null;

  const date = new Date(header);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Check if content was modified since date
 */
export function wasModifiedSince(lastModified: Date, ifModifiedSince: Date | null): boolean {
  if (!ifModifiedSince) return true;

  // Round to seconds for comparison
  const lastMod = Math.floor(lastModified.getTime() / 1000);
  const ifMod = Math.floor(ifModifiedSince.getTime() / 1000);

  return lastMod > ifMod;
}

/**
 * Format date for Last-Modified header
 */
export function formatLastModified(date: Date): string {
  return date.toUTCString();
}

export default {
  cachingPlugin,
  cacheControl,
  noCache,
  buildCacheControlHeader,
  generateETag,
  generateCacheKey,
  hashCacheKey,
  CachePresets,
};
