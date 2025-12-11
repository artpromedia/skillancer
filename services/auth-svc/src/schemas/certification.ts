/**
 * @module @skillancer/auth-svc/schemas/certification
 * Validation schemas for certification endpoints
 */

import { z } from 'zod';

// =============================================================================
// CERTIFICATION SCHEMAS
// =============================================================================

/**
 * Create certification request schema
 */
export const createCertificationSchema = z
  .object({
    name: z.string().min(1).max(200).trim(),
    issuingOrganization: z.string().min(1).max(200).trim(),
    issueDate: z.coerce.date().optional().nullable(),
    expirationDate: z.coerce.date().optional().nullable(),
    credentialId: z.string().max(200).trim().optional().nullable(),
    credentialUrl: z.string().url().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      // If both dates provided, expiration should be after issue
      if (data.issueDate && data.expirationDate) {
        return data.expirationDate > data.issueDate;
      }
      return true;
    },
    { message: 'Expiration date must be after issue date', path: ['expirationDate'] }
  );

/**
 * Update certification request schema
 */
export const updateCertificationSchema = z
  .object({
    name: z.string().min(1).max(200).trim().optional(),
    issuingOrganization: z.string().min(1).max(200).trim().optional(),
    issueDate: z.coerce.date().optional().nullable(),
    expirationDate: z.coerce.date().optional().nullable(),
    credentialId: z.string().max(200).trim().optional().nullable(),
    credentialUrl: z.string().url().max(500).optional().nullable(),
  })
  .refine(
    (data) => {
      // If both dates provided, expiration should be after issue
      if (data.issueDate && data.expirationDate) {
        return data.expirationDate > data.issueDate;
      }
      return true;
    },
    { message: 'Expiration date must be after issue date', path: ['expirationDate'] }
  );

/**
 * Certification list query schema
 */
export const certificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  verifiedOnly: z.coerce.boolean().optional(),
});

/**
 * Certification ID parameter schema
 */
export const certificationIdParamSchema = z.object({
  certId: z.string().uuid(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateCertificationInput = z.infer<typeof createCertificationSchema>;
export type UpdateCertificationInput = z.infer<typeof updateCertificationSchema>;
export type CertificationListQueryInput = z.infer<typeof certificationListQuerySchema>;
