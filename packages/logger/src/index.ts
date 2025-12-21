/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unused-vars, import/export, import/no-named-as-default */
/**
 * @skillancer/logger
 *
 * Structured logging package for Skillancer services with:
 * - JSON structured logs for CloudWatch
 * - Request ID tracing across services
 * - Sensitive data masking
 * - Async context propagation
 *
 * @example
 * ```typescript
 * import { createLogger } from '@skillancer/logger';
 *
 * const logger = createLogger({
 *   serviceName: 'api',
 *   environment: 'production',
 * });
 *
 * logger.info('Server started', { port: 3000 });
 * logger.error('Database error', { error });
 * ```
 */

import pino, { type Logger, type LoggerOptions, type DestinationStream } from 'pino';

import { asyncLocalStorage, getContext } from './context.js';
import { SENSITIVE_FIELDS, createRedactPaths } from './redaction.js';

export type { Logger } from 'pino';
export { asyncLocalStorage, getContext, setContext, runWithContext } from './context.js';
export type { LogContext } from './context.js';
export * from './serializers.js';
export * from './types.js';

/**
 * Configuration for creating a logger instance
 */
export interface LoggerConfig {
  /** Name of the service (e.g., 'api', 'worker', 'scheduler'). Alias for serviceName. */
  name?: string;
  /** Name of the service (e.g., 'api', 'worker', 'scheduler') */
  serviceName?: string;
  /** Environment name (e.g., 'development', 'staging', 'production') */
  environment?: string;
  /** Log level (default: process.env.LOG_LEVEL || 'info') */
  level?: string;
  /** Enable pretty printing for development (default: true in development) */
  prettyPrint?: boolean;
  /** Additional fields to always include in logs */
  baseFields?: Record<string, unknown>;
  /** Additional sensitive fields to redact */
  additionalSensitiveFields?: string[];
  /** Custom destination stream */
  destination?: DestinationStream;
  /** Disable redaction (not recommended for production) */
  disableRedaction?: boolean;
}

/**
 * Creates a configured Pino logger instance
 *
 * @param config - Logger configuration
 * @returns Configured Pino logger
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   serviceName: 'api',
 *   environment: process.env.NODE_ENV || 'development',
 *   level: 'debug',
 * });
 * ```
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  const {
    name,
    serviceName: configServiceName,
    environment = process.env.NODE_ENV || 'development',
    level = process.env.LOG_LEVEL || 'info',
    prettyPrint = process.env.NODE_ENV === 'development',
    baseFields = {},
    additionalSensitiveFields = [],
    destination,
    disableRedaction = false,
  } = config;

  // Use name or serviceName (name takes precedence for simplicity)
  const serviceName = name || configServiceName || 'app';

  // Build redaction paths
  const allSensitiveFields = [...SENSITIVE_FIELDS, ...additionalSensitiveFields];
  const redactPaths = createRedactPaths(allSensitiveFields);

  // Build options object
  const options: LoggerOptions = {
    name: serviceName,
    level,

    // Add context from async local storage and base fields
    mixin() {
      const context = getContext();
      return {
        service: serviceName,
        environment,
        ...baseFields,
        ...(context || {}),
      };
    },

    // Format for CloudWatch compatibility
    formatters: {
      level(label) {
        return { level: label.toUpperCase() };
      },
      bindings(bindings) {
        return {
          pid: bindings.pid,
          hostname: bindings.hostname,
        };
      },
    },

    // ISO timestamp for CloudWatch
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

    // Custom serializers
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
  };

  // Add redaction if enabled
  if (!disableRedaction) {
    options.redact = {
      paths: redactPaths,
      censor: '[REDACTED]',
    };
  }

  // Pretty print for development
  if (prettyPrint) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        singleLine: false,
        messageFormat: '{service} | {msg}',
      },
    };
  }

  // Create logger with optional destination
  return destination ? pino(options, destination) : pino(options);
}

/**
 * Creates a child logger with additional context
 *
 * @param parent - Parent logger instance
 * @param context - Additional context to include in all logs
 * @returns Child logger with merged context
 *
 * @example
 * ```typescript
 * const requestLogger = createChildLogger(logger, {
 *   requestId: 'abc-123',
 *   userId: 'user-456',
 * });
 * ```
 */
export function createChildLogger(parent: Logger, context: Record<string, unknown>): Logger {
  return parent.child(context);
}

/**
 * Creates a silent logger for testing
 *
 * @returns Logger that doesn't output anything
 */
export function createSilentLogger(): Logger {
  return pino({ level: 'silent' });
}

/**
 * Creates a logger that writes to an array (for testing)
 *
 * @param logs - Array to collect log entries
 * @returns Logger that writes to the array
 */
export function createTestLogger(logs: unknown[] = []): Logger {
  return pino(
    {
      level: 'trace',
    },
    {
      write: (msg: string) => {
        logs.push(JSON.parse(msg));
      },
    }
  );
}
