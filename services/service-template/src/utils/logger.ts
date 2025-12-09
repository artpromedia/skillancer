/**
 * @module @skillancer/service-template/utils/logger
 * Logging utilities
 */

import * as pino from 'pino';

import { getConfig } from '../config/index.js';

import type { Logger, LoggerOptions } from 'pino';

let rootLogger: Logger | null = null;

/**
 * Get or create the root logger instance
 */
export function getLogger(): Logger {
  if (rootLogger) {
    return rootLogger;
  }

  const config = getConfig();

  const options: LoggerOptions = {
    level: config.logging.level,
    base: {
      service: config.service.name,
      version: config.service.version,
      env: config.env,
    },
  };

  if (config.logging.pretty) {
    options.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    };
  }

  rootLogger = (pino as unknown as typeof pino.default)(options);
  return rootLogger;
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(bindings: Record<string, unknown>): Logger {
  return getLogger().child(bindings);
}

/**
 * Log an operation with timing
 */
export async function logOperation<T>(
  logger: Logger,
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const start = Date.now();
  const operationLogger = logger.child({ operation, ...context });

  operationLogger.debug('Starting operation');

  try {
    const result = await fn();
    const duration = Date.now() - start;

    operationLogger.info({ duration }, 'Operation completed');
    return result;
  } catch (error) {
    const duration = Date.now() - start;

    operationLogger.error({ err: error, duration }, 'Operation failed');
    throw error;
  }
}
