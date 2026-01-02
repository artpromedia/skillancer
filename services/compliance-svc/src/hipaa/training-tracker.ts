/**
 * HIPAA Training Tracker
 * Sprint M9: Healthcare Vertical Module
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { structlog } from '@skillancer/logger';

const logger = structlog.get('hipaa-training-tracker');

// ============================================================================
// Types
// ============================================================================

export const TrainingTypeSchema = z.enum([
  'HIPAA_AWARENESS',
  'PRIVACY_RULE',
  'SECURITY_RULE',
  'BREACH_NOTIFICATION',
  'PHI_HANDLING',
  'ROLE_SPECIFIC',
]);

export type TrainingType = z.infer<typeof TrainingTypeSchema>;

export const TrainingStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED']);

export type TrainingStatus = z.infer<typeof TrainingStatusSchema>;

export interface TrainingRequirement {
  type: TrainingType;
  name: string;
  description: string;
  validityPeriodDays: number;
  isRequired: boolean;
}

export interface TrainingRecord {
  id: string;
  userId: string;
  trainingType: TrainingType;
  status: TrainingStatus;
  completedAt: Date | null;
  expiresAt: Date | null;
  certificateUrl: string | null;
  provider: string | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
}

export interface TrainingCompletionInput {
  userId: string;
  trainingType: TrainingType;
  completedAt: Date;
  certificateUrl?: string;
  provider?: string;
  externalCertificateId?: string;
}

export interface TrainingVerificationInput {
  trainingId: string;
  verifiedBy: string;
  verificationNotes?: string;
}

// ============================================================================
// Training Requirements Definition
// ============================================================================

const TRAINING_REQUIREMENTS: TrainingRequirement[] = [
  {
    type: 'HIPAA_AWARENESS',
    name: 'HIPAA Awareness Training',
    description: 'General HIPAA awareness for all healthcare workers',
    validityPeriodDays: 365,
    isRequired: true,
  },
  {
    type: 'PRIVACY_RULE',
    name: 'HIPAA Privacy Rule Training',
    description: 'Understanding patient privacy rights and PHI handling',
    validityPeriodDays: 365,
    isRequired: true,
  },
  {
    type: 'SECURITY_RULE',
    name: 'HIPAA Security Rule Training',
    description: 'Technical and administrative safeguards for ePHI',
    validityPeriodDays: 365,
    isRequired: true,
  },
  {
    type: 'BREACH_NOTIFICATION',
    name: 'Breach Notification Training',
    description: 'Procedures for identifying and reporting breaches',
    validityPeriodDays: 365,
    isRequired: false,
  },
  {
    type: 'PHI_HANDLING',
    name: 'PHI Handling Best Practices',
    description: 'Proper handling and disposal of PHI',
    validityPeriodDays: 365,
    isRequired: true,
  },
  {
    type: 'ROLE_SPECIFIC',
    name: 'Role-Specific HIPAA Training',
    description: 'Training specific to job function',
    validityPeriodDays: 365,
    isRequired: false,
  },
];

const APPROVED_TRAINING_PROVIDERS = [
  'HIPAA Exams',
  'Compliancy Group',
  'HIPAA Training',
  'MedTrainer',
  'Healthicity',
  'Skillancer Healthcare Academy',
];

// ============================================================================
// Training Tracker Service
// ============================================================================

export class HIPAATrainingTracker {
  /**
   * Get all training requirements
   */
  async getTrainingRequirements(): Promise<TrainingRequirement[]> {
    return TRAINING_REQUIREMENTS;
  }

  /**
   * Get required trainings for a user
   */
  async getRequiredTrainings(userId: string): Promise<TrainingRequirement[]> {
    logger.info('Getting required trainings', { userId });
    return TRAINING_REQUIREMENTS.filter((t) => t.isRequired);
  }

  /**
   * Get user's training status for all requirements
   */
  async getUserTrainingStatus(userId: string): Promise<{
    records: TrainingRecord[];
    compliant: boolean;
    missingTrainings: TrainingType[];
    expiringTrainings: { type: TrainingType; expiresAt: Date }[];
  }> {
    logger.info('Getting user training status', { userId });

    // In real implementation, fetch from database
    const records = await this.getUserTrainingRecords(userId);

    const requiredTypes = TRAINING_REQUIREMENTS.filter((t) => t.isRequired).map((t) => t.type);

    const completedTypes = records
      .filter((r) => r.status === 'COMPLETED' && r.expiresAt && r.expiresAt > new Date())
      .map((r) => r.trainingType);

    const missingTrainings = requiredTypes.filter((type) => !completedTypes.includes(type));

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringTrainings = records
      .filter(
        (r) =>
          r.status === 'COMPLETED' &&
          r.expiresAt &&
          r.expiresAt > now &&
          r.expiresAt <= thirtyDaysFromNow
      )
      .map((r) => ({ type: r.trainingType, expiresAt: r.expiresAt! }));

    return {
      records,
      compliant: missingTrainings.length === 0,
      missingTrainings,
      expiringTrainings,
    };
  }

  /**
   * Get user's training records
   */
  async getUserTrainingRecords(userId: string): Promise<TrainingRecord[]> {
    logger.info('Fetching training records', { userId });

    // In real implementation, query database
    // For now, return empty array - records would be fetched from HIPAATraining table
    return [];
  }

  /**
   * Record training completion
   */
  async recordTrainingCompletion(input: TrainingCompletionInput): Promise<TrainingRecord> {
    logger.info('Recording training completion', {
      userId: input.userId,
      trainingType: input.trainingType,
    });

    const requirement = TRAINING_REQUIREMENTS.find((r) => r.type === input.trainingType);

    if (!requirement) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Unknown training type: ${input.trainingType}`,
      });
    }

    const expiresAt = new Date(input.completedAt);
    expiresAt.setDate(expiresAt.getDate() + requirement.validityPeriodDays);

    const record: TrainingRecord = {
      id: crypto.randomUUID(),
      userId: input.userId,
      trainingType: input.trainingType,
      status: 'COMPLETED',
      completedAt: input.completedAt,
      expiresAt,
      certificateUrl: input.certificateUrl || null,
      provider: input.provider || null,
      verifiedAt: null,
      verifiedBy: null,
    };

    // In real implementation, save to database
    logger.info('Training completion recorded', {
      trainingId: record.id,
      expiresAt: record.expiresAt,
    });

    return record;
  }

  /**
   * Verify external training certificate
   */
  async verifyExternalCertificate(input: TrainingVerificationInput): Promise<TrainingRecord> {
    logger.info('Verifying external certificate', { trainingId: input.trainingId });

    // In real implementation, fetch record and update
    const record: TrainingRecord = {
      id: input.trainingId,
      userId: '',
      trainingType: 'HIPAA_AWARENESS',
      status: 'COMPLETED',
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      certificateUrl: null,
      provider: null,
      verifiedAt: new Date(),
      verifiedBy: input.verifiedBy,
    };

    logger.info('Certificate verified', { trainingId: input.trainingId });

    return record;
  }

  /**
   * Check if user is compliant for PHI access
   */
  async checkPHIAccessCompliance(userId: string): Promise<{
    allowed: boolean;
    reasons: string[];
  }> {
    logger.info('Checking PHI access compliance', { userId });

    const status = await this.getUserTrainingStatus(userId);
    const reasons: string[] = [];

    if (!status.compliant) {
      reasons.push(`Missing required trainings: ${status.missingTrainings.join(', ')}`);
    }

    // Check for expired trainings
    const expiredRecords = status.records.filter((r) => r.status === 'EXPIRED');
    if (expiredRecords.length > 0) {
      reasons.push(`Expired trainings: ${expiredRecords.map((r) => r.trainingType).join(', ')}`);
    }

    return {
      allowed: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Get approved training providers
   */
  getApprovedProviders(): string[] {
    return APPROVED_TRAINING_PROVIDERS;
  }

  /**
   * Check if provider is approved
   */
  isApprovedProvider(provider: string): boolean {
    return APPROVED_TRAINING_PROVIDERS.some((p) => p.toLowerCase() === provider.toLowerCase());
  }

  /**
   * Get training expiration reminders
   */
  async getExpirationReminders(daysAhead: number = 30): Promise<
    {
      userId: string;
      trainingType: TrainingType;
      expiresAt: Date;
      daysUntilExpiry: number;
    }[]
  > {
    logger.info('Getting expiration reminders', { daysAhead });

    // In real implementation, query database for expiring trainings
    return [];
  }

  /**
   * Update expired training statuses
   */
  async updateExpiredTrainings(): Promise<number> {
    logger.info('Updating expired training statuses');

    // In real implementation:
    // 1. Query all COMPLETED trainings where expiresAt < now
    // 2. Update status to EXPIRED
    // 3. Return count of updated records

    return 0;
  }

  /**
   * Generate training certificate
   */
  async generateCertificate(
    trainingId: string
  ): Promise<{ certificateUrl: string; certificateId: string }> {
    logger.info('Generating training certificate', { trainingId });

    // In real implementation, generate PDF certificate
    const certificateId = crypto.randomUUID();
    const certificateUrl = `/certificates/${certificateId}.pdf`;

    return { certificateUrl, certificateId };
  }

  /**
   * Block user PHI access due to training non-compliance
   */
  async blockPHIAccess(userId: string, reason: string): Promise<void> {
    logger.warn('Blocking PHI access due to training non-compliance', {
      userId,
      reason,
    });

    // In real implementation:
    // 1. Update user's PHI access status
    // 2. Terminate active PHI sessions
    // 3. Send notification to user
    // 4. Log action for audit
  }
}

// Export singleton instance
export const hipaaTrainingTracker = new HIPAATrainingTracker();
