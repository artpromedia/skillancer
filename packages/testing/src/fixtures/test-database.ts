/**
 * Test Database Utilities
 *
 * Provides database utilities for integration testing with proper
 * isolation and cleanup.
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export interface TestDatabaseOptions {
  /**
   * Database URL override
   */
  databaseUrl?: string;

  /**
   * Whether to use schema isolation (recommended for parallel tests)
   */
  useSchemaIsolation?: boolean;

  /**
   * Schema name prefix
   */
  schemaPrefix?: string;

  /**
   * Whether to run migrations
   */
  runMigrations?: boolean;

  /**
   * Whether to seed the database
   */
  seed?: boolean;
}

export interface TestDatabaseContext {
  prisma: PrismaClient;
  schemaName: string;
  cleanup: () => Promise<void>;
}

// ==================== Test Database Class ====================

/**
 * Test database manager for integration testing
 *
 * @example
 * ```typescript
 * const testDb = new TestDatabase();
 *
 * beforeAll(async () => {
 *   await testDb.setup();
 * });
 *
 * afterAll(async () => {
 *   await testDb.teardown();
 * });
 *
 * test('database operation', async () => {
 *   const user = await testDb.prisma.user.create({
 *     data: { email: 'test@example.com' }
 *   });
 *   expect(user.id).toBeDefined();
 * });
 * ```
 */
export class TestDatabase {
  private _prisma: PrismaClient | null = null;
  private _schemaName: string;
  private _options: Required<TestDatabaseOptions>;
  private _isSetup: boolean = false;

  constructor(options: TestDatabaseOptions = {}) {
    this._schemaName = `${options.schemaPrefix || 'test'}_${uuidv4().replace(/-/g, '_')}`;
    this._options = {
      databaseUrl: options.databaseUrl || process.env.DATABASE_URL || '',
      useSchemaIsolation: options.useSchemaIsolation ?? true,
      schemaPrefix: options.schemaPrefix || 'test',
      runMigrations: options.runMigrations ?? false,
      seed: options.seed ?? false,
    };
  }

  /**
   * Get the Prisma client instance
   */
  get prisma(): PrismaClient {
    if (!this._prisma) {
      throw new Error('TestDatabase not initialized. Call setup() first.');
    }
    return this._prisma;
  }

  /**
   * Get the schema name
   */
  get schemaName(): string {
    return this._schemaName;
  }

  /**
   * Check if the database is set up
   */
  get isSetup(): boolean {
    return this._isSetup;
  }

  /**
   * Set up the test database
   */
  async setup(): Promise<void> {
    if (this._isSetup) {
      return;
    }

    // Create Prisma client with test database URL
    const url = this._options.useSchemaIsolation
      ? this.appendSchemaToUrl(this._options.databaseUrl)
      : this._options.databaseUrl;

    this._prisma = new PrismaClient({
      datasources: {
        db: {
          url,
        },
      },
      log: process.env.DEBUG_PRISMA === 'true' ? ['query', 'error', 'warn'] : ['error'],
    });

    // Create schema if using isolation
    if (this._options.useSchemaIsolation) {
      await this._prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${this._schemaName}"`);
      await this._prisma.$executeRawUnsafe(`SET search_path TO "${this._schemaName}"`);
    }

    // Run migrations if requested
    if (this._options.runMigrations) {
      await this.runMigrations();
    }

    // Seed database if requested
    if (this._options.seed) {
      await this.seed();
    }

    this._isSetup = true;
  }

  /**
   * Tear down the test database
   */
  async teardown(): Promise<void> {
    if (!this._isSetup || !this._prisma) {
      return;
    }

    // Drop schema if using isolation
    if (this._options.useSchemaIsolation) {
      await this._prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${this._schemaName}" CASCADE`);
    }

    // Disconnect Prisma
    await this._prisma.$disconnect();
    this._prisma = null;
    this._isSetup = false;
  }

  /**
   * Clean all tables without dropping the schema
   */
  async clean(): Promise<void> {
    if (!this._prisma) {
      throw new Error('TestDatabase not initialized. Call setup() first.');
    }

    // Get all table names
    const tables = await this._prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = ${this._schemaName}
    `;

    // Disable foreign key checks and truncate all tables
    await this._prisma.$executeRawUnsafe('SET session_replication_role = replica;');

    for (const { tablename } of tables) {
      if (tablename !== '_prisma_migrations') {
        await this._prisma.$executeRawUnsafe(
          `TRUNCATE TABLE "${this._schemaName}"."${tablename}" CASCADE`
        );
      }
    }

    // Re-enable foreign key checks
    await this._prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    // In a real implementation, this would use Prisma's migrate deploy
    // For testing, we typically use schema push or have pre-migrated test databases
    console.log('Running migrations...');
  }

  /**
   * Seed the database with test data
   */
  private async seed(): Promise<void> {
    // Override in subclass or use with factories
    console.log('Seeding database...');
  }

  /**
   * Append schema to database URL
   */
  private appendSchemaToUrl(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}schema=${this._schemaName}`;
  }
}

// ==================== Database Factory Helpers ====================

/**
 * Create a test database context for a test suite
 */
export async function createTestDatabaseContext(
  options: TestDatabaseOptions = {}
): Promise<TestDatabaseContext> {
  const testDb = new TestDatabase(options);
  await testDb.setup();

  return {
    prisma: testDb.prisma,
    schemaName: testDb.schemaName,
    cleanup: () => testDb.teardown(),
  };
}

/**
 * Create a shared database context for multiple test files
 */
export function createSharedDatabaseContext(): {
  getContext: () => TestDatabaseContext;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
} {
  let context: TestDatabaseContext | null = null;

  return {
    getContext: () => {
      if (!context) {
        throw new Error('Shared database context not initialized. Call setup() first.');
      }
      return context;
    },
    setup: async () => {
      context = await createTestDatabaseContext();
    },
    teardown: async () => {
      if (context) {
        await context.cleanup();
        context = null;
      }
    },
  };
}

// ==================== Transaction Helpers ====================

/**
 * Run a test within a transaction that gets rolled back
 */
export async function withRollback<T>(
  prisma: PrismaClient,
  fn: (tx: Omit<PrismaClient, '$transaction'>) => Promise<T>
): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx as Omit<PrismaClient, '$transaction'>);
      // Always rollback by throwing
      throw new RollbackError();
    });
  } catch (error) {
    if (!(error instanceof RollbackError)) {
      throw error;
    }
    // Transaction was rolled back as expected
  }
}

class RollbackError extends Error {
  constructor() {
    super('Rollback transaction');
    this.name = 'RollbackError';
  }
}

// ==================== Query Assertions ====================

/**
 * Assert that a record exists in the database
 */
export async function assertRecordExists<T>(
  prisma: PrismaClient,
  model: keyof PrismaClient,
  where: Record<string, unknown>
): Promise<T> {
  const result = await (prisma[model] as any).findUnique({ where });
  expect(result).not.toBeNull();
  return result as T;
}

/**
 * Assert that a record does not exist in the database
 */
export async function assertRecordNotExists(
  prisma: PrismaClient,
  model: keyof PrismaClient,
  where: Record<string, unknown>
): Promise<void> {
  const result = await (prisma[model] as any).findUnique({ where });
  expect(result).toBeNull();
}

/**
 * Assert record count for a model
 */
export async function assertRecordCount(
  prisma: PrismaClient,
  model: keyof PrismaClient,
  where: Record<string, unknown>,
  expectedCount: number
): Promise<void> {
  const count = await (prisma[model] as any).count({ where });
  expect(count).toBe(expectedCount);
}
