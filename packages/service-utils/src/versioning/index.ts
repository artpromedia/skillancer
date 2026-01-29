/**
 * @module @skillancer/service-utils/versioning
 * API Versioning middleware and utilities for Skillancer services
 *
 * Supports multiple versioning strategies:
 * - URL path versioning: /v1/users, /v2/users
 * - Header versioning: Accept-Version: v1
 * - Accept header versioning: Accept: application/vnd.skillancer.v1+json
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';

// ==================== Types ====================

export type VersioningStrategy = 'path' | 'header' | 'accept' | 'auto';

export interface ApiVersion {
  /** Version number (e.g., 1, 2) */
  major: number;
  /** Minor version (optional) */
  minor?: number;
  /** Full version string (e.g., 'v1', 'v2.1') */
  string: string;
}

export interface VersioningConfig {
  /** Default version if none specified */
  defaultVersion: string;
  /** Supported versions */
  supportedVersions: string[];
  /** Versioning strategy */
  strategy: VersioningStrategy;
  /** Custom version extractor */
  extractVersion?: (request: FastifyRequest) => string | undefined;
  /** Whether to add version headers to response */
  addResponseHeaders?: boolean;
  /** Deprecation warnings for old versions */
  deprecatedVersions?: string[];
  /** Sunset date for deprecated versions */
  sunsetDates?: Record<string, string>;
}

export interface VersionedRoute {
  version: string;
  deprecated?: boolean;
  sunset?: string;
}

// ==================== Version Extraction ====================

/**
 * Extract version from URL path (/v1/users -> 'v1')
 */
function extractVersionFromPath(request: FastifyRequest): string | undefined {
  const match = request.url.match(/^\/v(\d+(?:\.\d+)?)\//);
  return match ? `v${match[1]}` : undefined;
}

/**
 * Extract version from Accept-Version header
 */
function extractVersionFromHeader(request: FastifyRequest): string | undefined {
  const header = request.headers['accept-version'] || request.headers['x-api-version'];
  if (typeof header === 'string') {
    return header.startsWith('v') ? header : `v${header}`;
  }
  return undefined;
}

/**
 * Extract version from Accept header (application/vnd.skillancer.v1+json)
 */
function extractVersionFromAccept(request: FastifyRequest): string | undefined {
  const accept = request.headers.accept;
  if (typeof accept !== 'string') return undefined;

  const match = accept.match(/application\/vnd\.skillancer\.(v\d+(?:\.\d+)?)\+json/);
  return match ? match[1] : undefined;
}

/**
 * Auto-detect version from multiple sources
 */
function extractVersionAuto(request: FastifyRequest): string | undefined {
  // Priority: header > path > accept
  return (
    extractVersionFromHeader(request) ||
    extractVersionFromPath(request) ||
    extractVersionFromAccept(request)
  );
}

// ==================== Versioning Plugin ====================

declare module 'fastify' {
  interface FastifyRequest {
    apiVersion: ApiVersion;
  }
}

const versioningPluginImpl: FastifyPluginCallback<VersioningConfig> = (
  app: FastifyInstance,
  config: VersioningConfig,
  done: (err?: Error) => void
) => {
  const {
    defaultVersion,
    supportedVersions,
    strategy,
    extractVersion: customExtractor,
    addResponseHeaders = true,
    deprecatedVersions = [],
    sunsetDates = {},
  } = config;

  // Version extraction based on strategy
  const versionExtractors: Record<VersioningStrategy, (req: FastifyRequest) => string | undefined> =
    {
      path: extractVersionFromPath,
      header: extractVersionFromHeader,
      accept: extractVersionFromAccept,
      auto: extractVersionAuto,
    };

  const extractor = customExtractor || versionExtractors[strategy];

  // Request hook to set version
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const versionString = extractor(request) || defaultVersion;

    // Validate version
    if (!supportedVersions.includes(versionString)) {
      reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Unsupported API version: ${versionString}. Supported versions: ${supportedVersions.join(', ')}`,
        code: 'UNSUPPORTED_API_VERSION',
      });
      return;
    }

    // Parse version
    const versionMatch = versionString.match(/v(\d+)(?:\.(\d+))?/);
    const apiVersion: ApiVersion = {
      major: versionMatch ? parseInt(versionMatch[1]!, 10) : 1,
      minor: versionMatch?.[2] ? parseInt(versionMatch[2], 10) : undefined,
      string: versionString,
    };

    request.apiVersion = apiVersion;

    // Add deprecation warning if needed
    if (deprecatedVersions.includes(versionString)) {
      const sunset = sunsetDates[versionString];
      reply.header('Deprecation', 'true');
      if (sunset) {
        reply.header('Sunset', sunset);
      }
      reply.header(
        'Warning',
        `299 - "API version ${versionString} is deprecated${sunset ? ` and will be removed on ${sunset}` : ''}"`
      );
    }
  });

  // Response hook to add version headers
  if (addResponseHeaders) {
    app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
      if (request.apiVersion) {
        reply.header('X-API-Version', request.apiVersion.string);
        reply.header('X-Supported-Versions', supportedVersions.join(', '));
      }
    });
  }

  done();
};

export const versioningPlugin = fp(versioningPluginImpl, {
  name: 'api-versioning-plugin',
  fastify: '4.x',
});

// ==================== Route Helpers ====================

/**
 * Create versioned route prefix
 *
 * @example
 * app.register(userRoutes, { prefix: versionedPrefix('v1', '/users') });
 * // Results in /v1/users routes
 */
export function versionedPrefix(version: string, basePath: string): string {
  const cleanBase = basePath.startsWith('/') ? basePath : `/${basePath}`;
  return `/${version}${cleanBase}`;
}

/**
 * Create route handler for multiple versions
 *
 * @example
 * const handler = createVersionedHandler({
 *   v1: async (req, reply) => { ... },
 *   v2: async (req, reply) => { ... },
 * });
 */
export function createVersionedHandler<T>(
  handlers: Record<string, (request: FastifyRequest, reply: FastifyReply) => Promise<T>>
): (request: FastifyRequest, reply: FastifyReply) => Promise<T> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<T> => {
    const version = request.apiVersion?.string || 'v1';
    const handler = handlers[version];

    if (!handler) {
      // Find the highest available version that's <= requested
      const availableVersions = Object.keys(handlers).sort();
      const fallbackVersion = availableVersions
        .filter((v) => v <= version)
        .pop();

      if (fallbackVersion && handlers[fallbackVersion]) {
        return handlers[fallbackVersion]!(request, reply);
      }

      throw new Error(`No handler for API version ${version}`);
    }

    return handler(request, reply);
  };
}

/**
 * Decorator for versioned routes with metadata
 */
export function versioned(options: VersionedRoute) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      request: FastifyRequest,
      reply: FastifyReply,
      ...args: unknown[]
    ) {
      // Add version metadata
      if (options.deprecated) {
        reply.header('Deprecation', 'true');
        if (options.sunset) {
          reply.header('Sunset', options.sunset);
        }
      }

      return originalMethod.call(this, request, reply, ...args);
    };

    return descriptor;
  };
}

export default versioningPlugin;
