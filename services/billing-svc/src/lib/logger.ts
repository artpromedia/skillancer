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
