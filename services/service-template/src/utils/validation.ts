/**
 * @module @skillancer/service-template/utils/validation
 * Zod validation helpers
 */

import { z, type ZodSchema, type ZodError, type ZodIssue } from 'zod';

import { ValidationError } from './errors.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{ field: string; message: string; code?: string }>;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Validate data and throw ValidationError if invalid
 */
export function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);

  if (!result.success || result.errors) {
    throw new ValidationError(result.errors ?? []);
  }

  return result.data as T;
}

/**
 * Validate data asynchronously
 */
export async function validateAsync<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  const result = await schema.safeParseAsync(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Validate data asynchronously and throw ValidationError if invalid
 */
export async function validateOrThrowAsync<T>(schema: ZodSchema<T>, data: unknown): Promise<T> {
  const result = await validateAsync(schema, data);

  if (!result.success || result.errors) {
    throw new ValidationError(result.errors ?? []);
  }

  return result.data as T;
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Format Zod errors into a standardized format
 */
export function formatZodErrors(
  error: ZodError
): Array<{ field: string; message: string; code?: string }> {
  return error.errors.map((issue) => ({
    field: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Format Zod path to string
 */
function formatZodPath(path: (string | number)[]): string {
  if (path.length === 0) {
    return '_root';
  }

  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }
      return index === 0 ? segment : `.${segment}`;
    })
    .join('');
}

/**
 * Get first error message from Zod error
 */
export function getFirstZodError(error: ZodError): string {
  const firstIssue = error.errors[0];
  if (!firstIssue) {
    return 'Validation failed';
  }

  const path = formatZodPath(firstIssue.path);
  return path === '_root' ? firstIssue.message : `${path}: ${firstIssue.message}`;
}

// ============================================================================
// SCHEMA UTILITIES
// ============================================================================

/**
 * Create a schema that transforms empty strings to undefined
 */
export function emptyStringToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === '' ? undefined : val), schema);
}

/**
 * Create a schema that trims strings
 */
export function trimmedString(options?: { min?: number; max?: number }) {
  let schema = z.string().trim();
  if (options?.min !== undefined) schema = schema.min(options.min);
  if (options?.max !== undefined) schema = schema.max(options.max);
  return schema;
}

/**
 * Create a nullable version of a schema
 */
export function nullable<T extends z.ZodTypeAny>(schema: T) {
  return schema.nullable();
}

/**
 * Create an optional version of a schema that converts null to undefined
 */
export function optionalNullish<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((val) => (val === null ? undefined : val), schema.optional());
}

/**
 * Create a schema that coerces to boolean
 */
export function coerceBoolean() {
  return z.preprocess((val) => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(lower)) return true;
      if (['false', '0', 'no', 'off'].includes(lower)) return false;
    }
    if (typeof val === 'number') return val !== 0;
    return val;
  }, z.boolean());
}

/**
 * Create a schema for comma-separated values
 */
export function commaSeparatedArray(itemSchema: z.ZodString = z.string()) {
  return z.preprocess((val: unknown): string[] => {
    if (Array.isArray(val)) {
      // Filter to only strings for safety
      return val.filter((item): item is string => typeof item === 'string');
    }
    if (typeof val === 'string') {
      return val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }, z.array(itemSchema));
}

/**
 * Create a schema for JSON string that parses to object
 */
export function jsonString<T extends z.ZodTypeAny>(innerSchema: T) {
  return z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }, innerSchema);
}

// ============================================================================
// QUERY STRING HELPERS
// ============================================================================

/**
 * Parse pagination from query string
 */
export function parsePagination(query: Record<string, unknown>): { page: number; limit: number } {
  const pageSchema = z.coerce.number().int().positive().default(1);
  const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

  return {
    page: pageSchema.parse(query.page),
    limit: limitSchema.parse(query.limit),
  };
}

/**
 * Calculate pagination offset
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Calculate total pages
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/**
 * Build pagination metadata
 */
export function buildPaginationMeta(total: number, page: number, limit: number) {
  const totalPages = calculateTotalPages(total, limit);

  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

// ============================================================================
// FASTIFY INTEGRATION
// ============================================================================

/**
 * Create Fastify-compatible JSON schema from Zod schema
 * Note: For complex schemas, consider using zod-to-json-schema
 */
export function zodToFastifySchema<T>(_zodSchema: ZodSchema<T>) {
  // This is a simplified version - for production, use zod-to-json-schema
  return {
    type: 'object' as const,
    additionalProperties: true,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { z, type ZodSchema, type ZodError, type ZodIssue };
