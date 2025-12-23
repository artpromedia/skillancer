/**
 * @fileoverview Health Check Service for Kubernetes Probes
 *
 * Provides comprehensive health monitoring for microservices including:
 * - Liveness probes: Is the process alive?
 * - Readiness probes: Is the service ready to accept traffic?
 * - Startup probes: Has the service completed initialization?
 *
 * Supports health checks for:
 * - Database connections (PostgreSQL, MongoDB)
 * - Redis/cache connections
 * - External service dependencies
 * - Message queues (RabbitMQ, SQS)
 * - Custom health checks
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  lastCheck?: Date;
  metadata?: Record<string, unknown>;
}

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  checks: HealthCheckResult[];
}

export interface HealthCheckOptions {
  /** Timeout for individual health checks in ms */
  timeout?: number;
  /** Whether this check is critical for readiness */
  critical?: boolean;
  /** Check interval in ms for cached results */
  cacheInterval?: number;
}

export type HealthCheckFn = () => Promise<HealthCheckResult>;

interface RegisteredCheck {
  fn: HealthCheckFn;
  options: HealthCheckOptions;
  lastResult?: HealthCheckResult;
  lastCheckTime?: number;
}

/**
 * Health Service for comprehensive service health monitoring
 */
export class HealthService {
  private checks: Map<string, RegisteredCheck> = new Map();
  private startTime: Date;
  private version: string;
  private ready: boolean = false;

  constructor(options: { version?: string } = {}) {
    this.startTime = new Date();
    this.version = options.version || process.env.npm_package_version || '0.0.0';
  }

  /**
   * Register a health check
   */
  register(name: string, checkFn: HealthCheckFn, options: HealthCheckOptions = {}): void {
    this.checks.set(name, {
      fn: checkFn,
      options: {
        timeout: 5000,
        critical: true,
        cacheInterval: 0,
        ...options,
      },
    });
  }

  /**
   * Register a database health check
   */
  registerDatabase(
    name: string,
    checkFn: () => Promise<void>,
    options: HealthCheckOptions = {}
  ): void {
    this.register(
      name,
      async () => {
        const start = Date.now();
        try {
          await checkFn();
          return {
            name,
            status: 'healthy',
            latencyMs: Date.now() - start,
            lastCheck: new Date(),
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
            latencyMs: Date.now() - start,
            lastCheck: new Date(),
          };
        }
      },
      { critical: true, ...options }
    );
  }

  /**
   * Register a Redis health check
   */
  registerRedis(
    name: string,
    pingFn: () => Promise<string>,
    options: HealthCheckOptions = {}
  ): void {
    this.register(
      name,
      async () => {
        const start = Date.now();
        try {
          const result = await pingFn();
          return {
            name,
            status: result === 'PONG' ? 'healthy' : 'degraded',
            message: result,
            latencyMs: Date.now() - start,
            lastCheck: new Date(),
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
            latencyMs: Date.now() - start,
            lastCheck: new Date(),
          };
        }
      },
      { critical: true, ...options }
    );
  }

  /**
   * Register an external service health check
   */
  registerExternalService(name: string, healthUrl: string, options: HealthCheckOptions = {}): void {
    this.register(
      name,
      async () => {
        const start = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeout || 5000);

        try {
          const response = await fetch(healthUrl, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (response.ok) {
            return {
              name,
              status: 'healthy',
              latencyMs: Date.now() - start,
              lastCheck: new Date(),
              metadata: { statusCode: response.status },
            };
          }

          return {
            name,
            status: response.status >= 500 ? 'unhealthy' : 'degraded',
            message: `HTTP ${response.status}`,
            latencyMs: Date.now() - start,
            lastCheck: new Date(),
            metadata: { statusCode: response.status },
          };
        } catch (error) {
          clearTimeout(timeout);
          return {
            name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
            latencyMs: Date.now() - start,
            lastCheck: new Date(),
          };
        }
      },
      { critical: false, ...options }
    );
  }

  /**
   * Register a message queue health check
   */
  registerQueue(
    name: string,
    checkFn: () => Promise<{ connected: boolean; queueSize?: number }>,
    options: HealthCheckOptions = {}
  ): void {
    this.register(
      name,
      async () => {
        const start = Date.now();
        try {
          const result = await checkFn();
          return {
            name,
            status: result.connected ? 'healthy' : 'unhealthy',
            latencyMs: Date.now() - start,
            lastCheck: new Date(),
            metadata: { queueSize: result.queueSize },
          };
        } catch (error) {
          return {
            name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
            latencyMs: Date.now() - start,
            lastCheck: new Date(),
          };
        }
      },
      { critical: true, ...options }
    );
  }

  /**
   * Execute a single health check with timeout
   */
  private async executeCheck(registered: RegisteredCheck): Promise<HealthCheckResult> {
    const { fn, options, lastResult, lastCheckTime } = registered;

    // Return cached result if within cache interval
    if (
      options.cacheInterval &&
      lastResult &&
      lastCheckTime &&
      Date.now() - lastCheckTime < options.cacheInterval
    ) {
      return lastResult;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          name: 'unknown',
          status: 'unhealthy',
          message: 'Health check timed out',
          lastCheck: new Date(),
        });
      }, options.timeout || 5000);

      fn()
        .then((result) => {
          clearTimeout(timeout);
          registered.lastResult = result;
          registered.lastCheckTime = Date.now();
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          const result: HealthCheckResult = {
            name: 'unknown',
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
            lastCheck: new Date(),
          };
          registered.lastResult = result;
          registered.lastCheckTime = Date.now();
          resolve(result);
        });
    });
  }

  /**
   * Run all health checks
   */
  private async runChecks(): Promise<HealthCheckResult[]> {
    const results = await Promise.all(
      Array.from(this.checks.entries()).map(async ([, registered]) => this.executeCheck(registered))
    );
    return results;
  }

  /**
   * Calculate overall status from individual check results
   */
  private calculateOverallStatus(results: HealthCheckResult[]): HealthStatus {
    const criticalChecks = Array.from(this.checks.entries())
      .filter(([, r]) => r.options.critical)
      .map(([name]) => name);

    const criticalResults = results.filter((r) => criticalChecks.includes(r.name));

    // If any critical check is unhealthy, overall is unhealthy
    if (criticalResults.some((r) => r.status === 'unhealthy')) {
      return 'unhealthy';
    }

    // If any check is degraded, overall is degraded
    if (results.some((r) => r.status === 'degraded')) {
      return 'degraded';
    }

    // If any non-critical check is unhealthy, overall is degraded
    if (results.some((r) => r.status === 'unhealthy')) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Mark service as ready to accept traffic
   */
  setReady(ready: boolean): void {
    this.ready = ready;
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Get liveness probe response
   * Returns true if process is alive (always true if this code runs)
   */
  async getLiveness(): Promise<{ status: 'ok' | 'fail'; uptime: number }> {
    return {
      status: 'ok',
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Get readiness probe response
   * Returns true if service is ready to accept traffic
   */
  async getReadiness(): Promise<HealthResponse> {
    const checks = await this.runChecks();
    const status = this.calculateOverallStatus(checks);

    // Service is ready if it's marked ready AND health checks pass
    const overallStatus = this.ready && status === 'healthy' ? 'healthy' : 'unhealthy';

    return {
      status: overallStatus,
      version: this.version,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Get full health check response
   */
  async getHealth(): Promise<HealthResponse> {
    const checks = await this.runChecks();
    const status = this.calculateOverallStatus(checks);

    return {
      status,
      version: this.version,
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Get startup probe response
   * Returns true once initial startup checks have completed
   */
  async getStartup(): Promise<{ status: 'ok' | 'fail'; ready: boolean }> {
    return {
      status: this.ready ? 'ok' : 'fail',
      ready: this.ready,
    };
  }
}

// Express middleware
export function createHealthRoutes(healthService: HealthService) {
  return {
    /**
     * Liveness probe handler
     * GET /health/live
     */
    liveness: async (
      _req: unknown,
      res: { status: (code: number) => { json: (data: unknown) => void } }
    ) => {
      const result = await healthService.getLiveness();
      res.status(200).json(result);
    },

    /**
     * Readiness probe handler
     * GET /health/ready
     */
    readiness: async (
      _req: unknown,
      res: { status: (code: number) => { json: (data: unknown) => void } }
    ) => {
      const result = await healthService.getReadiness();
      const statusCode = result.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(result);
    },

    /**
     * Full health check handler
     * GET /health
     */
    health: async (
      _req: unknown,
      res: { status: (code: number) => { json: (data: unknown) => void } }
    ) => {
      const result = await healthService.getHealth();
      const statusCode =
        result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(result);
    },

    /**
     * Startup probe handler
     * GET /health/startup
     */
    startup: async (
      _req: unknown,
      res: { status: (code: number) => { json: (data: unknown) => void } }
    ) => {
      const result = await healthService.getStartup();
      const statusCode = result.status === 'ok' ? 200 : 503;
      res.status(statusCode).json(result);
    },
  };
}

// Singleton pattern
let healthServiceInstance: HealthService | null = null;

/**
 * Create a new HealthService instance
 */
export function createHealthService(options?: { version?: string }): HealthService {
  return new HealthService(options);
}

/**
 * Get or create the singleton HealthService instance
 */
export function getHealthService(options?: { version?: string }): HealthService {
  if (!healthServiceInstance) {
    healthServiceInstance = new HealthService(options);
  }
  return healthServiceInstance;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetHealthService(): void {
  healthServiceInstance = null;
}
