// @ts-nocheck
/**
 * Medical Credentialing Service
 * Sprint M9: Healthcare Vertical Module
 */

import { structlog } from '@skillancer/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

const logger = structlog.get('credentialing-service');

// ============================================================================
// Types
// ============================================================================

export const CredentialTypeSchema = z.enum([
  'MEDICAL_LICENSE_MD',
  'MEDICAL_LICENSE_DO',
  'NURSING_LICENSE_RN',
  'NURSING_LICENSE_LPN',
  'NURSING_LICENSE_NP',
  'PHYSICIAN_ASSISTANT',
  'CERTIFICATION_CPC',
  'CERTIFICATION_CCS',
  'CERTIFICATION_RHIT',
  'CERTIFICATION_RHIA',
  'DEA_REGISTRATION',
  'BOARD_CERTIFICATION',
  'MALPRACTICE_INSURANCE',
  'NPI_NUMBER',
  'STATE_LICENSE_OTHER',
]);

export type CredentialType = z.infer<typeof CredentialTypeSchema>;

export const VerificationStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
]);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export interface MedicalCredential {
  id: string;
  userId: string;
  type: CredentialType;
  licenseNumber: string;
  state: string | null;
  issuingAuthority: string;
  issueDate: Date;
  expirationDate: Date;
  status: VerificationStatus;
  verifiedAt: Date | null;
  verificationMethod: string | null;
  documentUrl: string | null;
  metadata: Record<string, unknown>;
}

export interface AddCredentialInput {
  userId: string;
  type: CredentialType;
  licenseNumber: string;
  state?: string;
  issuingAuthority: string;
  issueDate: Date;
  expirationDate: Date;
  documentUrl?: string;
}

export interface VerificationResult {
  credentialId: string;
  status: VerificationStatus;
  verifiedAt: Date | null;
  verificationMethod: string;
  details: {
    licenseStatus?: string;
    disciplinaryActions?: string[];
    scopeOfPractice?: string;
    originalIssueDate?: Date;
  };
  errors?: string[];
}

// ============================================================================
// Credential Type Definitions
// ============================================================================

const CREDENTIAL_DEFINITIONS: Record<
  CredentialType,
  {
    name: string;
    requiresState: boolean;
    verificationSource: string;
    renewalPeriodMonths: number;
  }
> = {
  MEDICAL_LICENSE_MD: {
    name: 'Medical Doctor License',
    requiresState: true,
    verificationSource: 'State Medical Board',
    renewalPeriodMonths: 24,
  },
  MEDICAL_LICENSE_DO: {
    name: 'Doctor of Osteopathy License',
    requiresState: true,
    verificationSource: 'State Medical Board',
    renewalPeriodMonths: 24,
  },
  NURSING_LICENSE_RN: {
    name: 'Registered Nurse License',
    requiresState: true,
    verificationSource: 'State Board of Nursing',
    renewalPeriodMonths: 24,
  },
  NURSING_LICENSE_LPN: {
    name: 'Licensed Practical Nurse',
    requiresState: true,
    verificationSource: 'State Board of Nursing',
    renewalPeriodMonths: 24,
  },
  NURSING_LICENSE_NP: {
    name: 'Nurse Practitioner License',
    requiresState: true,
    verificationSource: 'State Board of Nursing',
    renewalPeriodMonths: 24,
  },
  PHYSICIAN_ASSISTANT: {
    name: 'Physician Assistant License',
    requiresState: true,
    verificationSource: 'State Medical Board',
    renewalPeriodMonths: 24,
  },
  CERTIFICATION_CPC: {
    name: 'Certified Professional Coder',
    requiresState: false,
    verificationSource: 'AAPC',
    renewalPeriodMonths: 24,
  },
  CERTIFICATION_CCS: {
    name: 'Certified Coding Specialist',
    requiresState: false,
    verificationSource: 'AHIMA',
    renewalPeriodMonths: 24,
  },
  CERTIFICATION_RHIT: {
    name: 'Registered Health Information Technician',
    requiresState: false,
    verificationSource: 'AHIMA',
    renewalPeriodMonths: 24,
  },
  CERTIFICATION_RHIA: {
    name: 'Registered Health Information Administrator',
    requiresState: false,
    verificationSource: 'AHIMA',
    renewalPeriodMonths: 24,
  },
  DEA_REGISTRATION: {
    name: 'DEA Registration',
    requiresState: false,
    verificationSource: 'DEA',
    renewalPeriodMonths: 36,
  },
  BOARD_CERTIFICATION: {
    name: 'Board Certification',
    requiresState: false,
    verificationSource: 'Specialty Board',
    renewalPeriodMonths: 120,
  },
  MALPRACTICE_INSURANCE: {
    name: 'Malpractice Insurance',
    requiresState: false,
    verificationSource: 'Insurance Provider',
    renewalPeriodMonths: 12,
  },
  NPI_NUMBER: {
    name: 'National Provider Identifier',
    requiresState: false,
    verificationSource: 'NPPES',
    renewalPeriodMonths: 0, // No expiration
  },
  STATE_LICENSE_OTHER: {
    name: 'Other State License',
    requiresState: true,
    verificationSource: 'State Licensing Board',
    renewalPeriodMonths: 24,
  },
};

// ============================================================================
// Credentialing Service
// ============================================================================

export class CredentialingService {
  /**
   * Get credential type definitions
   */
  getCredentialTypes(): typeof CREDENTIAL_DEFINITIONS {
    return CREDENTIAL_DEFINITIONS;
  }

  /**
   * Add a new credential
   */
  async addCredential(input: AddCredentialInput): Promise<MedicalCredential> {
    logger.info('Adding credential', {
      userId: input.userId,
      type: input.type,
    });

    const definition = CREDENTIAL_DEFINITIONS[input.type];

    if (definition.requiresState && !input.state) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `State is required for ${definition.name}`,
      });
    }

    const credential: MedicalCredential = {
      id: crypto.randomUUID(),
      userId: input.userId,
      type: input.type,
      licenseNumber: input.licenseNumber,
      state: input.state || null,
      issuingAuthority: input.issuingAuthority,
      issueDate: input.issueDate,
      expirationDate: input.expirationDate,
      status: 'PENDING',
      verifiedAt: null,
      verificationMethod: null,
      documentUrl: input.documentUrl || null,
      metadata: {},
    };

    // In real implementation, save to database
    logger.info('Credential added', { credentialId: credential.id });

    return credential;
  }

  /**
   * Get user's credentials
   */
  async getUserCredentials(userId: string): Promise<MedicalCredential[]> {
    logger.info('Getting user credentials', { userId });
    // In real implementation, query database
    return [];
  }

  /**
   * Get credential by ID
   */
  async getCredential(credentialId: string): Promise<MedicalCredential | null> {
    logger.info('Getting credential', { credentialId });
    // In real implementation, query database
    return null;
  }

  /**
   * Request verification for a credential
   */
  async requestVerification(credentialId: string): Promise<VerificationResult> {
    logger.info('Requesting credential verification', { credentialId });

    const credential = await this.getCredential(credentialId);
    if (!credential) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Credential not found',
      });
    }

    // Update status to in progress
    // In real implementation, queue verification job

    return {
      credentialId,
      status: 'IN_PROGRESS',
      verifiedAt: null,
      verificationMethod: 'primary_source',
      details: {},
    };
  }

  /**
   * Check if user has valid credentials for healthcare work
   */
  async checkCredentialCompliance(
    userId: string,
    requiredCredentials: CredentialType[]
  ): Promise<{
    compliant: boolean;
    missingCredentials: CredentialType[];
    expiredCredentials: CredentialType[];
    unverifiedCredentials: CredentialType[];
  }> {
    logger.info('Checking credential compliance', { userId, requiredCredentials });

    const userCredentials = await this.getUserCredentials(userId);
    const now = new Date();

    const missingCredentials: CredentialType[] = [];
    const expiredCredentials: CredentialType[] = [];
    const unverifiedCredentials: CredentialType[] = [];

    for (const required of requiredCredentials) {
      const credential = userCredentials.find((c) => c.type === required);

      if (!credential) {
        missingCredentials.push(required);
      } else if (credential.expirationDate < now) {
        expiredCredentials.push(required);
      } else if (credential.status !== 'VERIFIED') {
        unverifiedCredentials.push(required);
      }
    }

    return {
      compliant:
        missingCredentials.length === 0 &&
        expiredCredentials.length === 0 &&
        unverifiedCredentials.length === 0,
      missingCredentials,
      expiredCredentials,
      unverifiedCredentials,
    };
  }

  /**
   * Get credentials expiring soon
   */
  async getExpiringCredentials(daysAhead: number = 30): Promise<MedicalCredential[]> {
    logger.info('Getting expiring credentials', { daysAhead });
    // In real implementation, query database
    return [];
  }

  /**
   * Update credential status
   */
  async updateCredentialStatus(
    credentialId: string,
    status: VerificationStatus,
    verificationDetails?: Record<string, unknown>
  ): Promise<MedicalCredential> {
    logger.info('Updating credential status', { credentialId, status });

    // In real implementation, update database
    const credential: MedicalCredential = {
      id: credentialId,
      userId: '',
      type: 'MEDICAL_LICENSE_MD',
      licenseNumber: '',
      state: null,
      issuingAuthority: '',
      issueDate: new Date(),
      expirationDate: new Date(),
      status,
      verifiedAt: status === 'VERIFIED' ? new Date() : null,
      verificationMethod: null,
      documentUrl: null,
      metadata: verificationDetails || {},
    };

    return credential;
  }
}

export const credentialingService = new CredentialingService();

