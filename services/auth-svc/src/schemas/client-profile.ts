/**
 * @module @skillancer/auth-svc/schemas/client-profile
 * Zod schemas for client profile validation
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const CompanySizeEnum = z.enum(['SOLO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']);

export const HiringFrequencyEnum = z.enum(['ONE_TIME', 'OCCASIONAL', 'REGULAR', 'FREQUENT']);

export const JobTypeEnum = z.enum(['FIXED_PRICE', 'HOURLY', 'RETAINER', 'CONTRACT']);

// =============================================================================
// CLIENT PROFILE SCHEMAS
// =============================================================================

export const createClientProfileSchema = z
  .object({
    companyName: z.string().max(200).optional(),
    companySize: CompanySizeEnum.optional(),
    companyWebsite: z.string().url().max(500).optional().or(z.literal('')),
    companyLogoUrl: z.string().url().max(500).optional().or(z.literal('')),
    industry: z.string().max(100).optional(),
    companyBio: z.string().max(2000).optional(),
    typicalBudgetMin: z.number().min(0).optional(),
    typicalBudgetMax: z.number().min(0).optional(),
    preferredCurrency: z.string().length(3).optional(),
    typicalProjectTypes: z.array(JobTypeEnum).optional(),
    hiringFrequency: HiringFrequencyEnum.optional(),
    teamSize: z.number().int().min(1).optional(),
    hasHrDepartment: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.typicalBudgetMin !== undefined && data.typicalBudgetMax !== undefined) {
        return data.typicalBudgetMin <= data.typicalBudgetMax;
      }
      return true;
    },
    { message: 'typicalBudgetMin must be less than or equal to typicalBudgetMax' }
  );

export const updateClientProfileSchema = createClientProfileSchema;

export const clientSearchSchema = z.object({
  companySize: z.array(CompanySizeEnum).optional(),
  industry: z.string().optional(),
  hiringFrequency: z.array(HiringFrequencyEnum).optional(),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  country: z.string().length(2).optional(),
  isVerified: z.coerce.boolean().optional(),
  paymentVerified: z.coerce.boolean().optional(),
  query: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(['relevance', 'jobs_posted', 'total_spent', 'recent']).optional(),
});

// =============================================================================
// TYPES
// =============================================================================

export type CreateClientProfileInput = z.infer<typeof createClientProfileSchema>;
export type UpdateClientProfileInput = z.infer<typeof updateClientProfileSchema>;
export type ClientSearchInput = z.infer<typeof clientSearchSchema>;
