/**
 * @module @skillancer/database/client
 * Prisma client singleton with extensions
 */

import { PrismaClient, Prisma } from '@prisma/client';

// Global reference for development hot-reload
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create a new Prisma client instance with logging configuration
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });
}

/**
 * Prisma client singleton
 * - In development: reuses the same client across hot-reloads
 * - In production: creates a new client
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Alias for prisma client (used by some services as `db`)
 */
export const db = prisma;

/**
 * Type-safe database client type
 */
export type DatabaseClient = typeof prisma;

/**
 * Prisma transaction client type
 */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Re-export Prisma types and utilities
 */
export { PrismaClient, Prisma };
export type { Prisma as PrismaNamespace } from '@prisma/client';
