/**
 * @module @skillancer/auth-svc/schemas/education
 * Validation schemas for education endpoints
 */

import { z } from 'zod';

// =============================================================================
// EDUCATION SCHEMAS
// =============================================================================

/**
 * Create education entry request schema
 */
export const createEducationSchema = z
  .object({
    institution: z.string().min(1).max(200).trim(),
    degree: z.string().max(200).trim().optional().nullable(),
    fieldOfStudy: z.string().max(200).trim().optional().nullable(),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    description: z.string().max(2000).trim().optional().nullable(),
  })
  .refine(
    (data) => {
      // If both dates provided, end date should be after start date
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    { message: 'End date must be after start date', path: ['endDate'] }
  );

/**
 * Update education entry request schema
 */
export const updateEducationSchema = z
  .object({
    institution: z.string().min(1).max(200).trim().optional(),
    degree: z.string().max(200).trim().optional().nullable(),
    fieldOfStudy: z.string().max(200).trim().optional().nullable(),
    startDate: z.coerce.date().optional().nullable(),
    endDate: z.coerce.date().optional().nullable(),
    description: z.string().max(2000).trim().optional().nullable(),
  })
  .refine(
    (data) => {
      // If both dates provided, end date should be after start date
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    { message: 'End date must be after start date', path: ['endDate'] }
  );

/**
 * Education list query schema
 */
export const educationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * Education entry ID parameter schema
 */
export const educationIdParamSchema = z.object({
  entryId: z.string().uuid(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateEducationInput = z.infer<typeof createEducationSchema>;
export type UpdateEducationInput = z.infer<typeof updateEducationSchema>;
export type EducationListQueryInput = z.infer<typeof educationListQuerySchema>;
