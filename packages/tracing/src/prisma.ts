/**
 * Prisma tracing instrumentation
 *
 * Provides automatic tracing for Prisma database operations
 */

import { trace, SpanStatusCode, SpanKind, type Attributes, type Span } from '@opentelemetry/api';
import { SEMATTRS_DB_SYSTEM, SEMATTRS_DB_NAME } from '@opentelemetry/semantic-conventions';

export interface PrismaTracingOptions {
  serviceName?: string;
  dbName?: string;
  logQueries?: boolean;
}

type PrismaAction =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findMany'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'count'
  | 'aggregate'
  | 'groupBy';

interface PrismaMiddlewareParams {
  model?: string;
  action: PrismaAction;
  args: unknown;
  dataPath: string[];
  runInTransaction: boolean;
}

type PrismaMiddlewareNext = (params: PrismaMiddlewareParams) => Promise<unknown>;

/**
 * Create Prisma middleware for automatic tracing
 *
 * @example
 * ```typescript
 * import { PrismaClient } from '@prisma/client';
 * import { createPrismaTracingMiddleware } from '@skillancer/tracing/prisma';
 *
 * const prisma = new PrismaClient();
 * prisma.$use(createPrismaTracingMiddleware({ dbName: 'skillancer' }));
 * ```
 */
export function createPrismaTracingMiddleware(options: PrismaTracingOptions = {}) {
  const tracer = trace.getTracer(options.serviceName || 'prisma');
  const dbName = options.dbName || 'database';

  return async (params: PrismaMiddlewareParams, next: PrismaMiddlewareNext): Promise<unknown> => {
    const model = params.model || 'unknown';
    const action = params.action;
    const spanName = `prisma.${model}.${action}`;

    const attributes: Attributes = {
      [SEMATTRS_DB_SYSTEM]: 'postgresql',
      [SEMATTRS_DB_NAME]: dbName,
      'db.operation': action,
      'db.prisma.model': model,
      'db.prisma.action': action,
    };

    if (params.runInTransaction) {
      attributes['db.prisma.transaction'] = true;
    }

    return tracer.startActiveSpan(
      spanName,
      {
        kind: SpanKind.CLIENT,
        attributes,
      },
      async (span) => {
        try {
          // Log query args if enabled (be careful with sensitive data)
          if (options.logQueries && params.args) {
            span.setAttribute('db.prisma.args', JSON.stringify(sanitizeArgs(params.args)));
          }

          const result = await next(params);

          // Add result count for array results
          if (Array.isArray(result)) {
            span.setAttribute('db.prisma.result_count', result.length);
          }

          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : 'Database error',
          });
          if (error instanceof Error) {
            span.recordException(error);
            span.setAttribute('error.type', error.name);
          }
          throw error;
        } finally {
          span.end();
        }
      }
    );
  };
}

/**
 * Sanitize query arguments to avoid logging sensitive data
 */
function sanitizeArgs(args: unknown): unknown {
  if (args === null || args === undefined) {
    return args;
  }

  if (typeof args !== 'object') {
    return args;
  }

  if (Array.isArray(args)) {
    return args.map(sanitizeArgs);
  }

  const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'accessToken', 'refreshToken'];
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeArgs(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Create a traced Prisma transaction
 *
 * @example
 * ```typescript
 * const result = await tracedTransaction(prisma, 'create-order', async (tx) => {
 *   const order = await tx.order.create({ data: orderData });
 *   await tx.orderItem.createMany({ data: items });
 *   return order;
 * });
 * ```
 */
export async function tracedTransaction<T>(
  prisma: { $transaction: (fn: (tx: unknown) => Promise<T>) => Promise<T> },
  name: string,
  fn: (tx: unknown) => Promise<T>,
  attributes?: Attributes
): Promise<T> {
  const tracer = trace.getTracer('prisma');

  return tracer.startActiveSpan(
    `prisma.transaction.${name}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        [SEMATTRS_DB_SYSTEM]: 'postgresql',
        'db.operation': 'transaction',
        'db.prisma.transaction_name': name,
        ...attributes,
      },
    },
    async (span) => {
      try {
        const result = await prisma.$transaction(fn);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Transaction error',
        });
        if (error instanceof Error) {
          span.recordException(error);
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Decorator for methods that perform database operations
 *
 * @example
 * ```typescript
 * class UserRepository {
 *   @TracedQuery('user.findById')
 *   async findById(id: string) {
 *     return this.prisma.user.findUnique({ where: { id } });
 *   }
 * }
 * ```
 */
export function TracedQuery(spanName?: string, attributes?: Attributes) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name =
      spanName ||
      `db.${(target as Record<string, unknown>).constructor?.name || 'Unknown'}.${propertyKey}`;

    descriptor.value = async function (...args: unknown[]) {
      const tracer = trace.getTracer('prisma');

      return tracer.startActiveSpan(
        name,
        {
          kind: SpanKind.CLIENT,
          attributes: {
            [SEMATTRS_DB_SYSTEM]: 'postgresql',
            'code.function': propertyKey,
            'code.namespace': (target as Record<string, unknown>).constructor?.name || 'Unknown',
            ...attributes,
          },
        },
        async (span) => {
          try {
            const result = await originalMethod.apply(this, args);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : 'Unknown error',
            });
            if (error instanceof Error) {
              span.recordException(error);
            }
            throw error;
          } finally {
            span.end();
          }
        }
      );
    };

    return descriptor;
  };
}

export default createPrismaTracingMiddleware;
