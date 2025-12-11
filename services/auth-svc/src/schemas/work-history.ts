/**
 * @module @skillancer/auth-svc/schemas/work-history
 * Validation schemas for work history endpoints
 */

import { z } from 'zod';

// =============================================================================
// WORK HISTORY SCHEMAS
// =============================================================================

/**
 * Create work history entry request schema
 */
export const createWorkHistorySchema = z
  .object({
    companyName: z.string().min(1).max(200).trim(),
    title: z.string().min(1).max(200).trim(),
    location: z.string().max(200).trim().optional().nullable(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    isCurrent: z.boolean(),
    description: z.string().max(2000).trim().optional().nullable(),
    skills: z.array(z.string().max(100)).max(20).optional(),
  })
  .refine(
    (data) => {
      // If not current, end date should be after start date
      if (!data.isCurrent && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    { message: 'End date must be after start date', path: ['endDate'] }
  )
  .refine(
    (data) => {
      // Start date should not be in the future
      return data.startDate <= new Date();
    },
    { message: 'Start date cannot be in the future', path: ['startDate'] }
  );

/**
 * Update work history entry request schema
 */
export const updateWorkHistorySchema = z
  .object({
    companyName: z.string().min(1).max(200).trim().optional(),
    title: z.string().min(1).max(200).trim().optional(),
    location: z.string().max(200).trim().optional().nullable(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    isCurrent: z.boolean().optional(),
    description: z.string().max(2000).trim().optional().nullable(),
    skills: z.array(z.string().max(100)).max(20).optional(),
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
 * Work history list query schema
 */
export const workHistoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * Work history entry ID parameter schema
 */
export const workHistoryIdParamSchema = z.object({
  entryId: z.string().uuid(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateWorkHistoryInput = z.infer<typeof createWorkHistorySchema>;
export type UpdateWorkHistoryInput = z.infer<typeof updateWorkHistorySchema>;
export type WorkHistoryListQueryInput = z.infer<typeof workHistoryListQuerySchema>;
