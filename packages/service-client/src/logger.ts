/**
 * @module @skillancer/service-client/logger
 * Shared logger for service client
 */

import pinoLogger from 'pino';

export const logger = pinoLogger({
  name: 'service-client',
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(process.env['NODE_ENV'] === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
});

export type Logger = typeof logger;
