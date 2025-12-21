/**
 * @module @skillancer/database/client
 * Prisma client singleton with extensions
 */
import { PrismaClient, Prisma } from '@prisma/client';
/**
 * Prisma client singleton
 * - In development: reuses the same client across hot-reloads
 * - In production: creates a new client
 */
export declare const prisma: PrismaClient<Prisma.PrismaClientOptions, never, import("@prisma/client/runtime/library").DefaultArgs>;
/**
 * Type-safe database client type
 */
export type DatabaseClient = typeof prisma;
/**
 * Prisma transaction client type
 */
export type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
/**
 * Re-export Prisma types and utilities
 */
export { PrismaClient, Prisma };
export type { Prisma as PrismaNamespace } from '@prisma/client';
//# sourceMappingURL=client.d.ts.map