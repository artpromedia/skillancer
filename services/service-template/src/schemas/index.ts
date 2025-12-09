/**
 * @module @skillancer/service-template/schemas
 * Shared Zod schemas
 */

import { z } from 'zod';

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

/**
 * UUID schema
 */
export const uuidSchema = z.string().uuid();

/**
 * Email schema
 */
export const emailSchema = z.string().trim().toLowerCase().email();

/**
 * URL schema
 */
export const urlSchema = z.string().url();

/**
 * Date string schema (ISO 8601)
 */
export const dateStringSchema = z.string().datetime();

/**
 * Phone number schema (E.164 format)
 */
export const phoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid phone number format');

// ============================================================================
// PAGINATION SCHEMAS
// ============================================================================

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Sort query schema
 */
export const sortSchema = z.object({
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Search query schema
 */
export const searchSchema = z.object({
  search: z.string().trim().optional(),
  q: z.string().trim().optional(), // alias
});

/**
 * Combined list query schema
 */
export const listQuerySchema = paginationSchema.merge(sortSchema).merge(searchSchema);

// ============================================================================
// ID PARAMS SCHEMAS
// ============================================================================

/**
 * Single ID param schema
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Multiple IDs body schema
 */
export const idsBodySchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
});

// ============================================================================
// DATE RANGE SCHEMAS
// ============================================================================

/**
 * Date range query schema
 */
export const dateRangeSchema = z
  .object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    { message: 'Start date must be before end date' }
  );

// ============================================================================
// COMMON ENTITY SCHEMAS
// ============================================================================

/**
 * Address schema
 */
export const addressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100).optional(),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2), // ISO 3166-1 alpha-2
});

/**
 * Money/currency schema
 */
export const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default('USD'), // ISO 4217
});

/**
 * Price range schema
 */
export const priceRangeSchema = z
  .object({
    min: z.number().nonnegative().optional(),
    max: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => {
      if (data.min !== undefined && data.max !== undefined) {
        return data.min <= data.max;
      }
      return true;
    },
    { message: 'Min price must be less than max price' }
  );

// ============================================================================
// STATUS SCHEMAS
// ============================================================================

/**
 * Generic status schema
 */
export const statusSchema = z.enum(['active', 'inactive', 'pending', 'archived']);

/**
 * Priority schema
 */
export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

// ============================================================================
// SCHEMA UTILITIES
// ============================================================================

/**
 * Make all fields optional
 */
export function makeOptional<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial();
}

/**
 * Add ID field to schema
 */
export function withId<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.extend({
    id: uuidSchema,
  });
}

/**
 * Add timestamp fields to schema
 */
export function withTimestamps<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.extend({
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
  });
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UUID = z.infer<typeof uuidSchema>;
export type Email = z.infer<typeof emailSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Sort = z.infer<typeof sortSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type Address = z.infer<typeof addressSchema>;
export type Money = z.infer<typeof moneySchema>;
export type Status = z.infer<typeof statusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
