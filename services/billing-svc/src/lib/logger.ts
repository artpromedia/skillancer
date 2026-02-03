/**
 * @module @skillancer/billing-svc/lib/logger
 * Logger wrapper for billing service
 *
 * This wrapper provides a flexible interface that accepts pino-style logging
 * with either argument order to fix TypeScript strict typing issues.
 */

import { logger as baseLogger } from '@skillancer/logger';

// Type-safe wrapper that accepts both argument orders
type LogFn = {
  (obj: Record<string, unknown>, msg?: string): void;
  (msg: string, obj?: Record<string, unknown>): void;
};

function createLogFn(level: 'info' | 'warn' | 'error' | 'debug' | 'trace' | 'fatal'): LogFn {
  return function log(
    first: string | Record<string, unknown>,
    second?: string | Record<string, unknown>
  ): void {
    if (typeof first === 'string') {
      // Called as logger.info('message', { obj }) - convert to pino style
      const obj = (second as Record<string, unknown>) ?? {};
      (baseLogger[level] as (obj: Record<string, unknown>, msg: string) => void)(obj, first);
    } else {
      // Called as logger.info({ obj }, 'message') - pino style
      const msg = (second as string) ?? '';
      (baseLogger[level] as (obj: Record<string, unknown>, msg: string) => void)(first, msg);
    }
  };
}

/**
 * Billing service logger with flexible argument order support
 */
export const logger = {
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  debug: createLogFn('debug'),
  trace: createLogFn('trace'),
  fatal: createLogFn('fatal'),
  // Passthrough for child logger creation
  child: baseLogger.child.bind(baseLogger),
};

export type Logger = typeof logger;

/**
 * Create a named logger instance for a specific module
 * @param name - The name of the module (used for context)
 * @returns A logger instance with the module name in context
 */
export function createLogger(name: string): Logger {
  return {
    info: (first: string | Record<string, unknown>, second?: string | Record<string, unknown>) => {
      const obj =
        typeof first === 'string'
          ? { module: name, ...((second as Record<string, unknown>) ?? {}) }
          : { module: name, ...first };
      const msg = typeof first === 'string' ? first : ((second as string) ?? '');
      (baseLogger.info as (obj: Record<string, unknown>, msg: string) => void)(obj, msg);
    },
    warn: (first: string | Record<string, unknown>, second?: string | Record<string, unknown>) => {
      const obj =
        typeof first === 'string'
          ? { module: name, ...((second as Record<string, unknown>) ?? {}) }
          : { module: name, ...first };
      const msg = typeof first === 'string' ? first : ((second as string) ?? '');
      (baseLogger.warn as (obj: Record<string, unknown>, msg: string) => void)(obj, msg);
    },
    error: (first: string | Record<string, unknown>, second?: string | Record<string, unknown>) => {
      const obj =
        typeof first === 'string'
          ? { module: name, ...((second as Record<string, unknown>) ?? {}) }
          : { module: name, ...first };
      const msg = typeof first === 'string' ? first : ((second as string) ?? '');
      (baseLogger.error as (obj: Record<string, unknown>, msg: string) => void)(obj, msg);
    },
    debug: (first: string | Record<string, unknown>, second?: string | Record<string, unknown>) => {
      const obj =
        typeof first === 'string'
          ? { module: name, ...((second as Record<string, unknown>) ?? {}) }
          : { module: name, ...first };
      const msg = typeof first === 'string' ? first : ((second as string) ?? '');
      (baseLogger.debug as (obj: Record<string, unknown>, msg: string) => void)(obj, msg);
    },
    trace: (first: string | Record<string, unknown>, second?: string | Record<string, unknown>) => {
      const obj =
        typeof first === 'string'
          ? { module: name, ...((second as Record<string, unknown>) ?? {}) }
          : { module: name, ...first };
      const msg = typeof first === 'string' ? first : ((second as string) ?? '');
      (baseLogger.trace as (obj: Record<string, unknown>, msg: string) => void)(obj, msg);
    },
    fatal: (first: string | Record<string, unknown>, second?: string | Record<string, unknown>) => {
      const obj =
        typeof first === 'string'
          ? { module: name, ...((second as Record<string, unknown>) ?? {}) }
          : { module: name, ...first };
      const msg = typeof first === 'string' ? first : ((second as string) ?? '');
      (baseLogger.fatal as (obj: Record<string, unknown>, msg: string) => void)(obj, msg);
    },
    child: baseLogger.child.bind(baseLogger),
  };
}
