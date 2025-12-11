/**
 * @module @skillancer/auth-svc/schemas/freelancer-profile
 * Zod schemas for freelancer profile validation
 */

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const FreelancerAvailabilityEnum = z.enum([
  'AVAILABLE',
  'PARTIALLY',
  'BUSY',
  'NOT_AVAILABLE',
  'ON_VACATION',
]);

export const JobTypeEnum = z.enum(['FIXED_PRICE', 'HOURLY', 'RETAINER', 'CONTRACT']);

// =============================================================================
// FREELANCER PROFILE SCHEMAS
// =============================================================================

export const createFreelancerProfileSchema = z
  .object({
    headline: z.string().max(200).optional(),
    specializations: z.array(z.string().max(100)).max(20).optional(),
    availability: FreelancerAvailabilityEnum.optional(),
    hoursPerWeek: z.number().int().min(1).max(168).optional(),
    availableFrom: z.coerce.date().optional(),
    hourlyRateMin: z.number().min(0).max(10000).optional(),
    hourlyRateMax: z.number().min(0).max(10000).optional(),
    preferredCurrency: z.string().length(3).optional(),
    preferredJobTypes: z.array(JobTypeEnum).optional(),
    preferredDurations: z.array(z.string().max(50)).max(10).optional(),
    preferredProjectMin: z.number().min(0).optional(),
    preferredProjectMax: z.number().min(0).optional(),
    remoteOnly: z.boolean().optional(),
    willingToTravel: z.boolean().optional(),
    travelRadius: z.number().int().min(0).max(50000).optional(),
    industries: z.array(z.string().max(100)).max(10).optional(),
    allowDirectContact: z.boolean().optional(),
    responseTime: z.string().max(50).optional(),
  })
  .refine(
    (data) => {
      if (data.hourlyRateMin !== undefined && data.hourlyRateMax !== undefined) {
        return data.hourlyRateMin <= data.hourlyRateMax;
      }
      return true;
    },
    { message: 'hourlyRateMin must be less than or equal to hourlyRateMax' }
  )
  .refine(
    (data) => {
      if (data.preferredProjectMin !== undefined && data.preferredProjectMax !== undefined) {
        return data.preferredProjectMin <= data.preferredProjectMax;
      }
      return true;
    },
    { message: 'preferredProjectMin must be less than or equal to preferredProjectMax' }
  );

export const updateFreelancerProfileSchema = createFreelancerProfileSchema;

export const updateAvailabilitySchema = z.object({
  availability: FreelancerAvailabilityEnum,
  availableFrom: z.coerce.date().optional(),
});

export const freelancerSearchSchema = z.object({
  skills: z.array(z.string()).optional(),
  specializations: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  availability: z.array(FreelancerAvailabilityEnum).optional(),
  minRate: z.coerce.number().min(0).optional(),
  maxRate: z.coerce.number().min(0).optional(),
  country: z.string().length(2).optional(),
  remoteOnly: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  query: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z
    .enum(['relevance', 'rate_asc', 'rate_desc', 'rating', 'experience', 'recent'])
    .optional(),
});

// =============================================================================
// TYPES
// =============================================================================

export type CreateFreelancerProfileInput = z.infer<typeof createFreelancerProfileSchema>;
export type UpdateFreelancerProfileInput = z.infer<typeof updateFreelancerProfileSchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type FreelancerSearchInput = z.infer<typeof freelancerSearchSchema>;
