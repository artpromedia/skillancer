// @ts-nocheck
/**
 * Healthcare API Routes
 * Sprint M9: Healthcare Vertical Module
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { credentialingService } from '../healthcare/credentialing-service';
import { exclusionScreeningService } from '../healthcare/exclusion-screening';
import { healthcareJobService } from '../healthcare/healthcare-jobs';
import { healthcareMatchingService } from '../healthcare/healthcare-matching';
import { licenseVerificationService } from '../healthcare/license-verification';
import { router, protectedProcedure, adminProcedure } from '../trpc';

// ============================================================================
// Input Schemas
// ============================================================================

const AddCredentialInput = z.object({
  freelancerId: z.string(),
  credentialType: z.enum([
    'MD',
    'DO',
    'NP',
    'PA',
    'RN',
    'LPN',
    'CNA',
    'PHARMD',
    'RPH',
    'CPC',
    'CCS',
    'RHIA',
    'RHIT',
    'LCSW',
    'LPC',
    'OTHER',
  ]),
  licenseNumber: z.string(),
  issuingState: z.string().length(2).optional(),
  issuingAuthority: z.string(),
  issuedAt: z.date(),
  expiresAt: z.date().optional(),
  documentUrls: z.array(z.string()).optional(),
});

const VerifyCredentialInput = z.object({
  credentialId: z.string(),
  verificationMethod: z.enum(['NPI_LOOKUP', 'STATE_BOARD_API', 'MANUAL_REVIEW']).optional(),
});

const RunExclusionScreeningInput = z.object({
  freelancerId: z.string(),
  screeningTypes: z.array(z.enum(['OIG_LEIE', 'SAM_GOV', 'STATE_MEDICAID'])).optional(),
});

const CreateHealthcareJobInput = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(50),
  category: z.enum([
    'CLINICAL',
    'ADMINISTRATIVE',
    'TELEHEALTH',
    'HEALTH_IT',
    'REVENUE_CYCLE',
    'COMPLIANCE',
    'RESEARCH',
  ]),
  healthcareDetails: z.object({
    requiredCredentials: z.array(z.string()),
    preferredCredentials: z.array(z.string()).optional(),
    hipaaCompliant: z.boolean(),
    baaRequired: z.boolean(),
    backgroundCheckRequired: z.boolean(),
    drugScreenRequired: z.boolean().optional(),
    phiAccessRequired: z.boolean(),
    phiAccessLevel: z.enum(['NONE', 'LIMITED', 'FULL']),
    ehrSystemRequired: z.string().optional(),
    ehrExperienceYears: z.number().optional(),
    stateLicenseRequired: z.array(z.string()).optional(),
    multiStatePractice: z.boolean().optional(),
    specialties: z.array(z.string()).optional(),
    subspecialties: z.array(z.string()).optional(),
    onCallRequired: z.boolean().optional(),
    weekendRequired: z.boolean().optional(),
    holidayRequired: z.boolean().optional(),
  }),
  hourlyRateMin: z.number().min(0),
  hourlyRateMax: z.number().min(0),
  estimatedHours: z.number().min(1),
  expiresAt: z.date(),
});

const SearchJobsInput = z.object({
  category: z
    .enum([
      'CLINICAL',
      'ADMINISTRATIVE',
      'TELEHEALTH',
      'HEALTH_IT',
      'REVENUE_CYCLE',
      'COMPLIANCE',
      'RESEARCH',
    ])
    .optional(),
  credentials: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  phiAccess: z.boolean().optional(),
  ehrSystem: z.string().optional(),
  minRate: z.number().optional(),
  maxRate: z.number().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
});

// ============================================================================
// Router
// ============================================================================

export const healthcareRouter = router({
  // ========================================
  // Credentials
  // ========================================

  /**
   * Add a credential
   */
  addCredential: protectedProcedure.input(AddCredentialInput).mutation(async ({ input, ctx }) => {
    // Verify user owns this freelancer profile
    if (ctx.user.freelancerId !== input.freelancerId && !ctx.user.isAdmin) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Cannot add credentials for another user',
      });
    }

    const credential = await credentialingService.addCredential(input);
    return credential;
  }),

  /**
   * Get freelancer credentials
   */
  getCredentials: protectedProcedure
    .input(z.object({ freelancerId: z.string() }))
    .query(async ({ input, ctx }) => {
      const credentials = await credentialingService.getCredentials(input.freelancerId);
      return credentials;
    }),

  /**
   * Request credential verification
   */
  requestVerification: protectedProcedure
    .input(VerifyCredentialInput)
    .mutation(async ({ input, ctx }) => {
      const result = await credentialingService.requestVerification(
        input.credentialId,
        input.verificationMethod
      );
      return result;
    }),

  /**
   * Verify credential (admin)
   */
  verifyCredential: adminProcedure
    .input(
      z.object({
        credentialId: z.string(),
        verified: z.boolean(),
        verificationNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const credential = await credentialingService.verifyCredential(
        input.credentialId,
        input.verified,
        ctx.user.id,
        input.verificationNotes
      );
      return credential;
    }),

  /**
   * Verify NPI number
   */
  verifyNpi: protectedProcedure
    .input(z.object({ npi: z.string() }))
    .query(async ({ input, ctx }) => {
      const result = await licenseVerificationService.verifyNPI(input.npi);
      return result;
    }),

  /**
   * Check compliance status
   */
  checkCredentialCompliance: protectedProcedure
    .input(z.object({ freelancerId: z.string() }))
    .query(async ({ input, ctx }) => {
      const compliance = await credentialingService.checkCompliance(input.freelancerId);
      return compliance;
    }),

  // ========================================
  // Exclusion Screening
  // ========================================

  /**
   * Run exclusion screening
   */
  runExclusionScreening: protectedProcedure
    .input(RunExclusionScreeningInput)
    .mutation(async ({ input, ctx }) => {
      const result = await exclusionScreeningService.runFullScreening(
        input.freelancerId,
        input.screeningTypes
      );
      return result;
    }),

  /**
   * Get exclusion screening history
   */
  getExclusionHistory: protectedProcedure
    .input(z.object({ freelancerId: z.string() }))
    .query(async ({ input, ctx }) => {
      const history = await exclusionScreeningService.getScreeningHistory(input.freelancerId);
      return history;
    }),

  /**
   * Get latest exclusion status
   */
  getExclusionStatus: protectedProcedure
    .input(z.object({ freelancerId: z.string() }))
    .query(async ({ input, ctx }) => {
      const status = await exclusionScreeningService.getLatestStatus(input.freelancerId);
      return status;
    }),

  // ========================================
  // Healthcare Jobs
  // ========================================

  /**
   * Create healthcare job
   */
  createJob: protectedProcedure.input(CreateHealthcareJobInput).mutation(async ({ input, ctx }) => {
    const job = await healthcareJobService.createJob(ctx.user.clientId, {
      ...input,
      healthcareDetails: {
        requiredCredentials: input.healthcareDetails.requiredCredentials,
        preferredCredentials: input.healthcareDetails.preferredCredentials || [],
        hipaaCompliant: input.healthcareDetails.hipaaCompliant,
        baaRequired: input.healthcareDetails.baaRequired,
        backgroundCheckRequired: input.healthcareDetails.backgroundCheckRequired,
        drugScreenRequired: input.healthcareDetails.drugScreenRequired || false,
        phiAccessRequired: input.healthcareDetails.phiAccessRequired,
        phiAccessLevel: input.healthcareDetails.phiAccessLevel,
        ehrSystemRequired: input.healthcareDetails.ehrSystemRequired || null,
        ehrExperienceYears: input.healthcareDetails.ehrExperienceYears || 0,
        stateLicenseRequired: input.healthcareDetails.stateLicenseRequired || [],
        multiStatePractice: input.healthcareDetails.multiStatePractice || false,
        specialties: input.healthcareDetails.specialties || [],
        subspecialties: input.healthcareDetails.subspecialties || [],
        onCallRequired: input.healthcareDetails.onCallRequired || false,
        weekendRequired: input.healthcareDetails.weekendRequired || false,
        holidayRequired: input.healthcareDetails.holidayRequired || false,
      },
    });
    return job;
  }),

  /**
   * Get healthcare job
   */
  getJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input, ctx }) => {
      const job = await healthcareJobService.getJob(input.jobId);
      if (!job) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Job not found',
        });
      }
      return job;
    }),

  /**
   * Search healthcare jobs
   */
  searchJobs: protectedProcedure.input(SearchJobsInput).query(async ({ input, ctx }) => {
    const results = await healthcareJobService.searchJobs(
      {
        category: input.category,
        credentials: input.credentials,
        states: input.states,
        phiAccess: input.phiAccess,
        ehrSystem: input.ehrSystem,
        minRate: input.minRate,
        maxRate: input.maxRate,
      },
      input.page,
      input.limit
    );
    return results;
  }),

  /**
   * Publish job
   */
  publishJob: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const job = await healthcareJobService.publishJob(input.jobId);
      return job;
    }),

  /**
   * Get client's healthcare jobs
   */
  getClientJobs: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        status: z.enum(['DRAFT', 'OPEN', 'IN_REVIEW', 'FILLED', 'CLOSED', 'CANCELLED']).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const jobs = await healthcareJobService.getClientJobs(input.clientId, input.status);
      return jobs;
    }),

  // ========================================
  // Healthcare Matching
  // ========================================

  /**
   * Get matches for job
   */
  getJobMatches: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const matches = await healthcareMatchingService.findMatchesForJob(input.jobId, input.limit);
      return matches;
    }),

  /**
   * Get jobs matching freelancer
   */
  getMatchingJobs: protectedProcedure
    .input(
      z.object({
        freelancerId: z.string(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const jobs = await healthcareMatchingService.findJobsForFreelancer(
        input.freelancerId,
        input.limit
      );
      return jobs;
    }),

  /**
   * Calculate match score
   */
  getMatchScore: protectedProcedure
    .input(
      z.object({
        freelancerId: z.string(),
        jobId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const match = await healthcareMatchingService.calculateMatchScore(
        input.freelancerId,
        input.jobId
      );
      return match;
    }),

  /**
   * Check if freelancer can apply
   */
  canApply: protectedProcedure
    .input(
      z.object({
        freelancerId: z.string(),
        jobId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const result = await healthcareMatchingService.canApply(input.freelancerId, input.jobId);
      return result;
    }),

  /**
   * Get top matches for invitations
   */
  getTopMatches: protectedProcedure
    .input(
      z.object({
        jobId: z.string(),
        minScore: z.number().default(70),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const matches = await healthcareMatchingService.getTopMatches(
        input.jobId,
        input.minScore,
        input.limit
      );
      return matches;
    }),

  // ========================================
  // Reference Data
  // ========================================

  /**
   * Get healthcare job categories
   */
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    return healthcareJobService.getCategories();
  }),

  /**
   * Get credential types
   */
  getCredentialTypes: protectedProcedure.query(async ({ ctx }) => {
    return credentialingService.getCredentialTypes();
  }),
});

export type HealthcareRouter = typeof healthcareRouter;
