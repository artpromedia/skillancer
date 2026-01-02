/**
 * HIPAA API Routes
 * Sprint M9: Healthcare Vertical Module
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { hipaaComplianceManager } from '../hipaa/hipaa-manager';
import { baaService } from '../hipaa/baa-service';
import { trainingTracker } from '../hipaa/training-tracker';
import { phiContainmentService } from '../hipaa/phi-containment';

// ============================================================================
// Input Schemas
// ============================================================================

const GetComplianceStatusInput = z.object({
  entityType: z.enum(['USER', 'ORGANIZATION', 'CLIENT']),
  entityId: z.string(),
});

const InitiateBAAInput = z.object({
  clientId: z.string(),
  organizationId: z.string().optional(),
  signatureRequired: z.boolean().default(true),
});

const SignBAAInput = z.object({
  baaId: z.string(),
  signatureData: z.object({
    signerName: z.string(),
    signerTitle: z.string(),
    signerEmail: z.string().email(),
    signatureImage: z.string().optional(),
    ipAddress: z.string(),
  }),
});

const CompleteTrainingInput = z.object({
  userId: z.string(),
  trainingType: z.enum([
    'HIPAA_BASICS',
    'HIPAA_SECURITY',
    'HIPAA_PRIVACY',
    'PHI_HANDLING',
    'BREACH_RESPONSE',
    'ANNUAL_REFRESHER',
  ]),
  completionDate: z.date().optional(),
  score: z.number().min(0).max(100).optional(),
  certificateUrl: z.string().optional(),
});

const RecordPHIAccessInput = z.object({
  userId: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  accessType: z.enum(['VIEW', 'EDIT', 'DOWNLOAD', 'PRINT', 'EXPORT']),
  reason: z.string(),
  skillpodSessionId: z.string().optional(),
});

const ReportBreachInput = z.object({
  reporterId: z.string(),
  description: z.string(),
  affectedRecords: z.number().optional(),
  discoveredAt: z.date(),
  potentiallyAffectedUsers: z.array(z.string()).optional(),
});

// ============================================================================
// Router
// ============================================================================

export const hipaaRouter = router({
  /**
   * Get compliance status
   */
  getComplianceStatus: protectedProcedure
    .input(GetComplianceStatusInput)
    .query(async ({ input, ctx }) => {
      const status = await hipaaComplianceManager.checkComplianceStatus(
        input.entityType,
        input.entityId
      );
      return status;
    }),

  /**
   * Get user's HIPAA training status
   */
  getTrainingStatus: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const status = await trainingTracker.getTrainingStatus(input.userId);
      return status;
    }),

  /**
   * Get required trainings for user
   */
  getRequiredTrainings: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      const trainings = await trainingTracker.getRequiredTrainings(input.userId);
      return trainings;
    }),

  /**
   * Record training completion
   */
  recordTrainingCompletion: protectedProcedure
    .input(CompleteTrainingInput)
    .mutation(async ({ input, ctx }) => {
      // Verify user has permission to record for this user
      if (ctx.user.id !== input.userId && !ctx.user.isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot record training for another user',
        });
      }

      await trainingTracker.recordCompletion(input.userId, input.trainingType, {
        completedAt: input.completionDate || new Date(),
        score: input.score,
        certificateUrl: input.certificateUrl,
      });

      return { success: true };
    }),

  /**
   * Initiate BAA signing process
   */
  initiateBaa: protectedProcedure.input(InitiateBAAInput).mutation(async ({ input, ctx }) => {
    const baa = await baaService.initiateSigning({
      clientId: input.clientId,
      organizationId: input.organizationId,
      initiatedBy: ctx.user.id,
    });

    return baa;
  }),

  /**
   * Sign BAA
   */
  signBaa: protectedProcedure.input(SignBAAInput).mutation(async ({ input, ctx }) => {
    const signedBaa = await baaService.signBAA(input.baaId, input.signatureData);

    return signedBaa;
  }),

  /**
   * Get BAA status for relationship
   */
  getBaaStatus: protectedProcedure
    .input(
      z.object({
        clientId: z.string(),
        organizationId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const baaStatus = await baaService.getStatus(input.clientId, input.organizationId);
      return baaStatus;
    }),

  /**
   * Record PHI access (for audit)
   */
  recordPhiAccess: protectedProcedure
    .input(RecordPHIAccessInput)
    .mutation(async ({ input, ctx }) => {
      await phiContainmentService.recordAccess({
        userId: input.userId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        accessType: input.accessType,
        reason: input.reason,
        sessionId: input.skillpodSessionId,
        ipAddress: ctx.ipAddress,
        timestamp: new Date(),
      });

      return { success: true };
    }),

  /**
   * Get PHI access log
   */
  getPhiAccessLog: adminProcedure
    .input(
      z.object({
        entityType: z.enum(['USER', 'RESOURCE']),
        entityId: z.string(),
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ input, ctx }) => {
      const log = await phiContainmentService.getAccessLog(
        input.entityType,
        input.entityId,
        input.startDate,
        input.endDate
      );
      return log;
    }),

  /**
   * Check PHI access permission
   */
  checkPhiPermission: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        resourceType: z.string(),
        resourceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const canAccess = await phiContainmentService.checkPermission(
        input.userId,
        input.resourceType,
        input.resourceId
      );
      return { canAccess };
    }),

  /**
   * Report potential breach
   */
  reportBreach: protectedProcedure.input(ReportBreachInput).mutation(async ({ input, ctx }) => {
    const breachReport = await hipaaComplianceManager.initiateBreachResponse({
      reporterId: input.reporterId || ctx.user.id,
      description: input.description,
      affectedRecords: input.affectedRecords,
      discoveredAt: input.discoveredAt,
      potentiallyAffectedUsers: input.potentiallyAffectedUsers,
    });

    return breachReport;
  }),

  /**
   * Get compliance dashboard data
   */
  getComplianceDashboard: adminProcedure
    .input(
      z.object({
        organizationId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const dashboard = await hipaaComplianceManager.getDashboardData(input.organizationId);
      return dashboard;
    }),

  /**
   * Get expiring trainings (admin)
   */
  getExpiringTrainings: adminProcedure
    .input(
      z.object({
        daysUntilExpiry: z.number().default(30),
      })
    )
    .query(async ({ input, ctx }) => {
      const expiring = await trainingTracker.getExpiringTrainings(input.daysUntilExpiry);
      return expiring;
    }),

  /**
   * Get expiring BAAs (admin)
   */
  getExpiringBaas: adminProcedure
    .input(
      z.object({
        daysUntilExpiry: z.number().default(60),
      })
    )
    .query(async ({ input, ctx }) => {
      const expiring = await baaService.getExpiringBAAs(input.daysUntilExpiry);
      return expiring;
    }),
});

export type HIPAARouter = typeof hipaaRouter;
