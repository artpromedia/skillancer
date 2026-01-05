/**
 * API Metrics Middleware for Fastify
 * Collects and exposes API performance metrics
 */

import { Counter, Histogram, Gauge, Registry } from 'prom-client';

import type { FastifyRequest, FastifyReply, FastifyPluginCallback } from 'fastify';

// Extend FastifyRequest to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: bigint;
  }
}

// Create custom registry
const registry = new Registry();

// Request duration histogram
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

// Request counter
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

// Active requests gauge
const httpRequestsInProgress = new Gauge({
  name: 'http_requests_in_progress',
  help: 'Number of HTTP requests currently being processed',
  labelNames: ['method'],
  registers: [registry],
});

// Error counter
const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'error_type'],
  registers: [registry],
});

// Response size histogram
const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [registry],
});

// Business metrics
const businessMetrics = {
  jobsCreated: new Counter({
    name: 'skillancer_jobs_created_total',
    help: 'Total number of jobs created',
    registers: [registry],
  }),

  proposalsSubmitted: new Counter({
    name: 'skillancer_proposals_submitted_total',
    help: 'Total number of proposals submitted',
    registers: [registry],
  }),

  contractsCreated: new Counter({
    name: 'skillancer_contracts_created_total',
    help: 'Total number of contracts created',
    registers: [registry],
  }),

  paymentsProcessed: new Counter({
    name: 'skillancer_payments_processed_total',
    help: 'Total number of payments processed',
    labelNames: ['status'],
    registers: [registry],
  }),

  activeUsers: new Gauge({
    name: 'skillancer_active_users',
    help: 'Number of currently active users',
    registers: [registry],
  }),

  activeSessions: new Gauge({
    name: 'skillancer_vdi_active_sessions',
    help: 'Number of active VDI sessions',
    registers: [registry],
  }),
};

/**
 * Get normalized route path (replace IDs with :id)
 */
function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

/**
 * Fastify metrics plugin
 */
export const metricsPlugin: FastifyPluginCallback = (fastify, _options, done) => {
  // Track request start time
  fastify.addHook('onRequest', (request: FastifyRequest, _reply, hookDone) => {
    request.startTime = process.hrtime.bigint();
    httpRequestsInProgress.inc({ method: request.method });
    hookDone();
  });

  // Track request completion
  fastify.addHook('onResponse', (request: FastifyRequest, reply: FastifyReply, hookDone) => {
    const startTime = request.startTime ?? process.hrtime.bigint();
    const endTime = process.hrtime.bigint();
    const durationSeconds = Number(endTime - startTime) / 1e9;

    const route = normalizeRoute(request.routeOptions?.url ?? request.url);
    const statusCode = reply.statusCode.toString();

    // Record metrics
    httpRequestDuration.observe(
      { method: request.method, route, status_code: statusCode },
      durationSeconds
    );

    httpRequestsTotal.inc({
      method: request.method,
      route,
      status_code: statusCode,
    });

    httpRequestsInProgress.dec({ method: request.method });

    // Track errors
    if (reply.statusCode >= 400) {
      const errorType = reply.statusCode >= 500 ? 'server_error' : 'client_error';
      httpErrorsTotal.inc({ method: request.method, route, error_type: errorType });
    }

    // Track response size
    const contentLength = reply.getHeader('content-length');
    if (contentLength) {
      httpResponseSize.observe(
        { method: request.method, route },
        typeof contentLength === 'string' ? Number.parseInt(contentLength, 10) : Number(contentLength)
      );
    }

    hookDone();
  });

  done();
};

/**
 * Metrics endpoint handler
 */
export async function metricsHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    void reply.header('Content-Type', registry.contentType);
    void reply.send(await registry.metrics());
  } catch {
    void reply.status(500).send('Error collecting metrics');
  }
}

/**
 * Business metrics helpers
 */
export const trackBusinessMetric = {
  jobCreated: (): void => {
    businessMetrics.jobsCreated.inc();
  },
  proposalSubmitted: (): void => {
    businessMetrics.proposalsSubmitted.inc();
  },
  contractCreated: (): void => {
    businessMetrics.contractsCreated.inc();
  },
  paymentProcessed: (status: 'success' | 'failed'): void => {
    businessMetrics.paymentsProcessed.inc({ status });
  },
  setActiveUsers: (count: number): void => {
    businessMetrics.activeUsers.set(count);
  },
  setActiveSessions: (count: number): void => {
    businessMetrics.activeSessions.set(count);
  },
};

export { registry };
