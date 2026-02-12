/**
 * @skillancer/types - Common Base Types
 * Base schemas and utilities used across all domains
 */

import { z } from 'zod';

// =============================================================================
// Primitive Schemas
// =============================================================================

/**
 * UUID v4 schema
 * @example "550e8400-e29b-41d4-a716-446655440000"
 */
export const uuidSchema = z.string().uuid();
export type UUID = z.infer<typeof uuidSchema>;

/**
 * Email schema with validation
 * @example "user@example.com"
 */
export const emailSchema = z.string().email();
export type Email = z.infer<typeof emailSchema>;

/**
 * Date schema that coerces strings/numbers to Date objects
 */
export const dateSchema = z.coerce.date();

/**
 * URL schema with validation
 * @example "https://example.com/path"
 */
export const urlSchema = z.string().url();
export type Url = z.infer<typeof urlSchema>;

/**
 * Phone number schema (E.164 format)
 * @example "+14155552671"
 */
export const phoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, {
  message: 'Phone number must be in E.164 format (e.g., +14155552671)',
});
export type Phone = z.infer<typeof phoneSchema>;

/**
 * Slug schema for URL-friendly identifiers
 * @example "my-awesome-project"
 */
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
  message: 'Slug must contain only lowercase letters, numbers, and hyphens',
});
export type Slug = z.infer<typeof slugSchema>;

/**
 * Currency code schema (ISO 4217)
 * @example "USD", "EUR", "GBP"
 */
export const currencyCodeSchema = z.string().length(3).toUpperCase();
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

/**
 * Country code schema (ISO 3166-1 alpha-2)
 * @example "US", "GB", "DE"
 */
export const countryCodeSchema = z.string().length(2).toUpperCase();
export type CountryCode = z.infer<typeof countryCodeSchema>;

/**
 * Language code schema (ISO 639-1)
 * @example "en", "es", "fr"
 */
export const languageCodeSchema = z.string().length(2).toLowerCase();
export type LanguageCode = z.infer<typeof languageCodeSchema>;

// =============================================================================
// Pagination
// =============================================================================

/**
 * Pagination parameters for list endpoints
 */
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Pagination metadata in responses
 */
export const paginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

// =============================================================================
// API Response Wrappers
// =============================================================================

/**
 * Generic success response wrapper
 * @param dataSchema - The schema for the response data
 */
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: paginationMetaSchema.optional(),
    timestamp: dateSchema.optional(),
  });

/**
 * Success response type helper
 */
export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta;
  timestamp?: Date;
};

/**
 * API Error response schema
 */
export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    field: z.string().optional(),
    stack: z.string().optional(),
  }),
  timestamp: dateSchema.optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Common error codes
 */
export const errorCodes = {
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Business logic errors
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
} as const;

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

// =============================================================================
// Audit & Timestamps
// =============================================================================

/**
 * Base timestamps for all entities
 */
export const timestampsSchema = z.object({
  createdAt: dateSchema,
  updatedAt: dateSchema,
});
export type Timestamps = z.infer<typeof timestampsSchema>;

/**
 * Soft delete timestamp
 */
export const softDeleteSchema = z.object({
  deletedAt: dateSchema.nullable().optional(),
});
export type SoftDelete = z.infer<typeof softDeleteSchema>;

/**
 * Audit fields for tracking changes
 */
export const auditFieldsSchema = z.object({
  createdBy: uuidSchema.optional(),
  updatedBy: uuidSchema.optional(),
  deletedBy: uuidSchema.optional(),
});
export type AuditFields = z.infer<typeof auditFieldsSchema>;

// =============================================================================
// Money & Financial
// =============================================================================

/**
 * Money value with currency
 */
export const moneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: currencyCodeSchema.default('USD'),
});
export type Money = z.infer<typeof moneySchema>;

/**
 * Price range for budgets
 */
export const priceRangeSchema = z
  .object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    currency: currencyCodeSchema.default('USD'),
  })
  .refine((data) => data.min <= data.max, {
    message: 'Minimum price must be less than or equal to maximum price',
  });
export type PriceRange = z.infer<typeof priceRangeSchema>;

// =============================================================================
// Address
// =============================================================================

/**
 * Physical address schema
 */
export const addressSchema = z.object({
  street1: z.string().min(1).max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: countryCodeSchema,
});
export type Address = z.infer<typeof addressSchema>;

// =============================================================================
// File & Media
// =============================================================================

/**
 * File attachment schema
 */
export const fileAttachmentSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(255),
  url: urlSchema,
  mimeType: z.string(),
  size: z.number().int().positive(),
  uploadedAt: dateSchema,
});
export type FileAttachment = z.infer<typeof fileAttachmentSchema>;

// =============================================================================
// Utility Types
// =============================================================================

/**
 * ID only selection (for references)
 */
export const idOnlySchema = z.object({
  id: uuidSchema,
});
export type IdOnly = z.infer<typeof idOnlySchema>;

/**
 * Generic key-value metadata
 */
export const metadataSchema = z.record(z.string(), z.unknown());
export type Metadata = z.infer<typeof metadataSchema>;
