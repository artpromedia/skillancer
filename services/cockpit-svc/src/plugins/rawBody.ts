/**
 * Raw Body Plugin
 *
 * Fastify plugin to capture the raw request body for webhook signature verification.
 * This is required for services like Stripe and PayPal that need the raw body
 * to verify webhook signatures.
 */

import fp from 'fastify-plugin';

import type { FastifyInstance, FastifyRequest } from 'fastify';

// Extend FastifyRequest to include rawBody
declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer | string;
  }

  interface FastifyContextConfig {
    rawBody?: boolean;
  }
}

export interface RawBodyPluginOptions {
  /**
   * Routes that should capture raw body (glob patterns supported)
   * Default: ['/webhooks/*']
   */
  routes?: string[];

  /**
   * Encoding for the raw body (default: 'utf8')
   */
  encoding?: BufferEncoding;

  /**
   * Global flag to enable raw body for all routes (default: false)
   */
  global?: boolean;
}

async function rawBodyPluginImpl(
  app: FastifyInstance,
  options: RawBodyPluginOptions
): Promise<void> {
  const routes = options.routes || ['/webhooks/'];
  const global = options.global || false;

  // Helper to check if a route should capture raw body
  const shouldCaptureRawBody = (url: string, routeConfig?: { rawBody?: boolean }): boolean => {
    // Check route-level config first
    if (routeConfig?.rawBody === true) {
      return true;
    }

    // Check global flag
    if (global) {
      return true;
    }

    // Check if URL matches any of the configured routes
    return routes.some((route) => url.includes(route));
  };

  // Add raw body content type parser for JSON
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done) => {
      // Check if this route should capture raw body
      // Note: req.routeOptions is available during parsing in Fastify 4+
      const shouldCapture = shouldCaptureRawBody(
        req.url,
        (req.routeOptions as any)?.config
      );

      if (shouldCapture) {
        req.rawBody = body;
      }

      // Parse the JSON as usual
      try {
        const json = body.length > 0 ? JSON.parse(body.toString('utf8')) : {};
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    }
  );

  // Also handle text/plain for some webhook providers
  app.addContentTypeParser(
    'text/plain',
    { parseAs: 'buffer' },
    (req: FastifyRequest, body: Buffer, done) => {
      const shouldCapture = shouldCaptureRawBody(
        req.url,
        (req.routeOptions as any)?.config
      );

      if (shouldCapture) {
        req.rawBody = body;
      }

      done(null, body.toString('utf8'));
    }
  );
}

export const rawBodyPlugin = fp(rawBodyPluginImpl, {
  name: 'cockpit-rawbody-plugin',
});
