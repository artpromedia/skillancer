/**
 * @module @skillancer/database/extensions/query-optimizer
 * Database query optimization utilities
 *
 * Features:
 * - N+1 query detection
 * - Query logging with timing
 * - Pagination helpers
 * - Batch operation utilities
 *
 * @example
 * ```typescript
 * import { withQueryOptimizer, detectN1Queries } from '@skillancer/database/extensions';
 *
 * const db = new PrismaClient().$extends(withQueryOptimizer());
 *
 * // Queries will be logged with timing info
 * // N+1 patterns will be detected and warned
 * ```
 */

import { Prisma } from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

interface QueryMetrics {
  model: string;
  operation: string;
  duration: number;
  timestamp: Date;
  args?: unknown;
}

interface N1Detection {
  pattern: string;
  count: number;
  threshold: number;
  queries: QueryMetrics[];
}

interface QueryOptimizerConfig {
  /** Enable query logging */
  enableLogging: boolean;
  /** Log slow queries above this threshold (ms) */
  slowQueryThreshold: number;
  /** Enable N+1 detection */
  enableN1Detection: boolean;
  /** N+1 detection threshold */
  n1Threshold: number;
  /** N+1 detection time window (ms) */
  n1TimeWindow: number;
  /** Custom logger */
  logger?: (message: string, meta?: Record<string, unknown>) => void;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const defaultConfig: QueryOptimizerConfig = {
  enableLogging: process.env.NODE_ENV !== 'production',
  slowQueryThreshold: 100,
  enableN1Detection: process.env.NODE_ENV !== 'production',
  n1Threshold: 5,
  n1TimeWindow: 1000,
  logger: console.log,
};

// =============================================================================
// QUERY TRACKER
// =============================================================================

class QueryTracker {
  private queries: QueryMetrics[] = [];
  private config: QueryOptimizerConfig;

  constructor(config: QueryOptimizerConfig) {
    this.config = config;
  }

  track(metric: QueryMetrics): void {
    this.queries.push(metric);

    // Log slow queries
    if (this.config.enableLogging && metric.duration > this.config.slowQueryThreshold) {
      this.config.logger?.(
        `[SLOW QUERY] ${metric.model}.${metric.operation} took ${metric.duration}ms`,
        { model: metric.model, operation: metric.operation, duration: metric.duration }
      );
    }

    // Detect N+1 patterns
    if (this.config.enableN1Detection) {
      this.detectN1();
    }

    // Cleanup old queries
    this.cleanup();
  }

  private detectN1(): void {
    const now = Date.now();
    const windowStart = now - this.config.n1TimeWindow;

    // Filter queries within time window
    const recentQueries = this.queries.filter((q) => q.timestamp.getTime() > windowStart);

    // Group by model.operation pattern
    const grouped = new Map<string, QueryMetrics[]>();
    for (const query of recentQueries) {
      const pattern = `${query.model}.${query.operation}`;
      if (!grouped.has(pattern)) {
        grouped.set(pattern, []);
      }
      grouped.get(pattern)!.push(query);
    }

    // Check for N+1 patterns
    for (const [pattern, queries] of grouped) {
      if (queries.length >= this.config.n1Threshold) {
        this.config.logger?.(
          `[N+1 DETECTED] ${pattern} called ${queries.length} times in ${this.config.n1TimeWindow}ms. Consider using include/select.`,
          {
            pattern,
            count: queries.length,
            threshold: this.config.n1Threshold,
            suggestion: 'Use Prisma include/select to batch queries',
          }
        );
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.config.n1TimeWindow * 2;
    this.queries = this.queries.filter((q) => q.timestamp.getTime() > cutoff);
  }

  getMetrics(): QueryMetrics[] {
    return [...this.queries];
  }

  clear(): void {
    this.queries = [];
  }
}

// =============================================================================
// PRISMA EXTENSION
// =============================================================================

/**
 * Create query optimizer extension for Prisma
 */
export function withQueryOptimizer(options?: Partial<QueryOptimizerConfig>) {
  const config = { ...defaultConfig, ...options };
  const tracker = new QueryTracker(config);

  return Prisma.defineExtension({
    name: 'query-optimizer',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const start = performance.now();

          try {
            const result = await query(args);
            const duration = performance.now() - start;

            tracker.track({
              model: model ?? 'unknown',
              operation,
              duration: Math.round(duration * 100) / 100,
              timestamp: new Date(),
              args: config.enableLogging ? args : undefined,
            });

            return result;
          } catch (error) {
            const duration = performance.now() - start;

            tracker.track({
              model: model ?? 'unknown',
              operation: `${operation} (failed)`,
              duration: Math.round(duration * 100) / 100,
              timestamp: new Date(),
            });

            throw error;
          }
        },
      },
    },
    model: {
      $allModels: {
        getQueryMetrics() {
          return tracker.getMetrics();
        },
        clearQueryMetrics() {
          tracker.clear();
        },
      },
    },
  });
}

// =============================================================================
// PAGINATION HELPERS
// =============================================================================

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextCursor?: string;
  };
}

/**
 * Convert pagination params to Prisma skip/take
 */
export function toPrismaPageParams(params: PaginationParams) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * Create paginated result
 */
export function createPaginatedResult<T extends { id: string }>(
  data: T[],
  totalCount: number,
  params: PaginationParams
): PaginatedResult<T> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextCursor: data.length > 0 ? data[data.length - 1].id : undefined,
    },
  };
}

// =============================================================================
// BATCH OPERATION HELPERS
// =============================================================================

export interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (processed: number, total: number) => void;
}

/**
 * Process items in batches
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  options: BatchOptions = {}
): Promise<R[]> {
  const { batchSize = 100, onProgress } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);

    onProgress?.(Math.min(i + batchSize, items.length), items.length);
  }

  return results;
}

/**
 * Batch upsert helper
 */
export async function batchUpsert<T, R>(
  items: T[],
  upsertFn: (item: T) => Promise<R>,
  options: BatchOptions = {}
): Promise<R[]> {
  const { batchSize = 50, onProgress } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(upsertFn));
    results.push(...batchResults);

    onProgress?.(Math.min(i + batchSize, items.length), items.length);
  }

  return results;
}

// =============================================================================
// SELECT/INCLUDE BUILDERS
// =============================================================================

/**
 * Build minimal select for list views
 */
export function minimalSelect<T extends Record<string, boolean>>(
  fields: (keyof T)[]
): Record<keyof T, true> {
  return Object.fromEntries(fields.map((f) => [f, true])) as Record<keyof T, true>;
}

/**
 * Build include with nested selects
 */
export function buildInclude<T extends Record<string, unknown>>(includes: Partial<T>): Partial<T> {
  return includes;
}

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Build OR conditions from search term
 */
export function searchConditions(
  searchTerm: string,
  fields: string[]
): { OR: Array<Record<string, { contains: string; mode: 'insensitive' }>> } {
  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: searchTerm,
        mode: 'insensitive' as const,
      },
    })),
  };
}

/**
 * Build date range filter
 */
export function dateRangeFilter(
  field: string,
  start?: Date,
  end?: Date
): Record<string, { gte?: Date; lte?: Date }> | undefined {
  if (!start && !end) return undefined;

  return {
    [field]: {
      ...(start && { gte: start }),
      ...(end && { lte: end }),
    },
  };
}

/**
 * Combine multiple where conditions
 */
export function combineWhere<T>(
  ...conditions: (T | undefined | null)[]
): { AND: T[] } | T | undefined {
  const validConditions = conditions.filter((c): c is T => c !== undefined && c !== null);

  if (validConditions.length === 0) return undefined;
  if (validConditions.length === 1) return validConditions[0];

  return { AND: validConditions };
}

export default {
  withQueryOptimizer,
  toPrismaPageParams,
  createPaginatedResult,
  processBatch,
  batchUpsert,
  minimalSelect,
  buildInclude,
  searchConditions,
  dateRangeFilter,
  combineWhere,
};
