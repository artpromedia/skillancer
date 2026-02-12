/**
 * @module @skillancer/service-utils/validation
 * Zod-based request validation middleware for Fastify
 *
 * Provides type-safe request validation with detailed error messages
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifySchema } from 'fastify';
import { z, ZodError, ZodSchema, ZodTypeAny } from 'zod';
import fp from 'fastify-plugin';

// ==================== Types ====================

export interface ValidationSchemas {
  body?: ZodSchema;
  querystring?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code: string;
  validation: ValidationError[];
}

export interface ValidatorConfig {
  /** Whether to strip unknown properties (default: true) */
  stripUnknown?: boolean;
  /** Whether to coerce types (default: true) */
  coerceTypes?: boolean;
  /** Custom error formatter */
  formatError?: (errors: ValidationError[]) => ValidationErrorResponse;
  /** Additional context for validation */
  context?: Record<string, unknown>;
}

// ==================== Error Formatting ====================

/**
 * Format Zod errors into a consistent structure
 */
function formatZodErrors(error: ZodError, prefix?: string): ValidationError[] {
  return error.errors.map((err) => {
    const path = err.path.join('.');
    const field = prefix ? `${prefix}.${path}` : path;

    return {
      field: field || 'root',
      message: err.message,
      code: err.code,
    };
  });
}

/**
 * Default error response formatter
 */
function defaultErrorFormatter(errors: ValidationError[]): ValidationErrorResponse {
  return {
    statusCode: 400,
    error: 'Bad Request',
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    validation: errors,
  };
}

// ==================== Validation Plugin ====================

declare module 'fastify' {
  interface FastifyRequest {
    validatedBody?: unknown;
    validatedQuery?: unknown;
    validatedParams?: unknown;
  }
}

async function validationPluginImpl(
  app: FastifyInstance,
  config: ValidatorConfig = {}
): Promise<void> {
  const { stripUnknown = true, coerceTypes = true, formatError = defaultErrorFormatter } = config;

  // Validation helper
  function validateSchema<T extends ZodTypeAny>(
    schema: T,
    data: unknown,
    prefix: string
  ): { success: true; data: z.infer<T> } | { success: false; errors: ValidationError[] } {
    try {
      let parseSchema = schema;

      // Apply strip unknown if configured
      if (stripUnknown && schema._def.typeName === 'ZodObject') {
        parseSchema = (schema as unknown as z.ZodObject<z.ZodRawShape>).strip() as unknown as T;
      }

      const result = parseSchema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        return { success: false, errors: formatZodErrors(error, prefix) };
      }
      throw error;
    }
  }

  // Decorator to add validation schemas
  app.decorate('withValidation', function (schemas: ValidationSchemas) {
    return {
      preHandler: async function (request: FastifyRequest, reply: FastifyReply) {
        const allErrors: ValidationError[] = [];

        // Validate body
        if (schemas.body && request.body !== undefined) {
          const result = validateSchema(schemas.body, request.body, 'body');
          if (!result.success) {
            allErrors.push(...result.errors);
          } else {
            request.validatedBody = result.data;
            request.body = result.data;
          }
        }

        // Validate querystring
        if (schemas.querystring && request.query) {
          const result = validateSchema(schemas.querystring, request.query, 'query');
          if (!result.success) {
            allErrors.push(...result.errors);
          } else {
            request.validatedQuery = result.data;
            (request as unknown as { query: unknown }).query = result.data;
          }
        }

        // Validate params
        if (schemas.params && request.params) {
          const result = validateSchema(schemas.params, request.params, 'params');
          if (!result.success) {
            allErrors.push(...result.errors);
          } else {
            request.validatedParams = result.data;
            (request as unknown as { params: unknown }).params = result.data;
          }
        }

        // Validate headers
        if (schemas.headers) {
          const result = validateSchema(schemas.headers, request.headers, 'headers');
          if (!result.success) {
            allErrors.push(...result.errors);
          }
        }

        // Send error response if validation failed
        if (allErrors.length > 0) {
          const errorResponse = formatError(allErrors);
          reply.status(errorResponse.statusCode).send(errorResponse);
        }
      },
    };
  });
}

export const validationPlugin = fp(validationPluginImpl, {
  name: 'zod-validation-plugin',
  fastify: '4.x',
});

// ==================== Common Schemas ====================

/**
 * Common pagination schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

/**
 * Common ID parameter schema
 */
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type IdParam = z.infer<typeof idParamSchema>;

/**
 * Common slug parameter schema
 */
export const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/),
});

export type SlugParam = z.infer<typeof slugParamSchema>;

/**
 * Common date range query schema
 */
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type DateRangeQuery = z.infer<typeof dateRangeSchema>;

/**
 * Common search query schema
 */
export const searchSchema = z.object({
  q: z.string().min(1).max(255).optional(),
  filters: z.record(z.string()).optional(),
});

export type SearchQuery = z.infer<typeof searchSchema>;

// ==================== Schema Builders ====================

/**
 * Create a validated route schema
 */
export function createRouteSchema<
  TBody extends ZodTypeAny = ZodTypeAny,
  TQuery extends ZodTypeAny = ZodTypeAny,
  TParams extends ZodTypeAny = ZodTypeAny,
>(schemas: {
  body?: TBody;
  querystring?: TQuery;
  params?: TParams;
  description?: string;
  tags?: string[];
}): {
  schema: FastifySchema;
  validation: ValidationSchemas;
} {
  const fastifySchema: FastifySchema = {};

  if (schemas.description) {
    fastifySchema.description = schemas.description;
  }
  if (schemas.tags) {
    fastifySchema.tags = schemas.tags;
  }

  const validation: ValidationSchemas = {};

  if (schemas.body) {
    validation.body = schemas.body;
  }
  if (schemas.querystring) {
    validation.querystring = schemas.querystring;
  }
  if (schemas.params) {
    validation.params = schemas.params;
  }

  return { schema: fastifySchema, validation };
}

/**
 * Extend a base schema with additional fields
 */
export function extendSchema<T extends z.ZodRawShape, U extends z.ZodRawShape>(
  base: z.ZodObject<T>,
  extension: U
): z.ZodObject<T & U> {
  return base.extend(extension);
}

/**
 * Make all fields in a schema optional
 */
export function partialSchema<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
): z.ZodObject<{ [K in keyof T]: z.ZodOptional<T[K]> }> {
  return schema.partial();
}

export default validationPlugin;
