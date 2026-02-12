// @ts-nocheck
/**
 * License Verification Service
 * Sprint M9: Healthcare Vertical Module
 */

import { structlog } from '@skillancer/logger';

import type { CredentialType, VerificationStatus } from './credentialing-service';

const logger = structlog.get('license-verification');

// ============================================================================
// Types
// ============================================================================

export interface LicenseVerificationRequest {
  credentialId: string;
  licenseType: CredentialType;
  licenseNumber: string;
  state?: string;
  lastName: string;
  firstName?: string;
  dateOfBirth?: Date;
}

export interface LicenseVerificationResult {
  credentialId: string;
  verified: boolean;
  status: VerificationStatus;
  verificationDate: Date;
  verificationMethod: 'API' | 'MANUAL' | 'NPDB';
  licenseDetails: {
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
    issueDate?: Date;
    expirationDate?: Date;
    disciplinaryActions: DisciplinaryAction[];
    scopeOfPractice?: string;
    restrictions?: string[];
  };
  sourceUrl?: string;
  rawResponse?: Record<string, unknown>;
}

export interface DisciplinaryAction {
  date: Date;
  type: string;
  description: string;
  status: 'ACTIVE' | 'RESOLVED';
}

export interface NPDBQueryResult {
  hasReports: boolean;
  reportCount: number;
  reports: NPDBReport[];
}

export interface NPDBReport {
  reportDate: Date;
  reportType: string;
  basis: string;
  action: string;
}

// ============================================================================
// State Medical Board APIs (simulated)
// ============================================================================

const STATE_BOARD_ENDPOINTS: Record<string, string> = {
  CA: 'https://api.mbc.ca.gov/license/verify',
  NY: 'https://api.nysed.gov/op/verify',
  TX: 'https://api.tmb.state.tx.us/verify',
  FL: 'https://api.flhealthsource.gov/verify',
  // Add more states...
};

// ============================================================================
// License Verification Service
// ============================================================================

export class LicenseVerificationService {
  /**
   * Verify a license through primary source
   */
  async verifyLicense(request: LicenseVerificationRequest): Promise<LicenseVerificationResult> {
    logger.info('Starting license verification', {
      credentialId: request.credentialId,
      licenseType: request.licenseType,
      state: request.state,
    });

    // Determine verification method based on license type
    if (this.hasAPIAccess(request.licenseType, request.state)) {
      return this.verifyViaAPI(request);
    } else {
      return this.verifyManually(request);
    }
  }

  /**
   * Check if API access is available for this license type/state
   */
  private hasAPIAccess(licenseType: CredentialType, state?: string): boolean {
    if (licenseType === 'NPI_NUMBER') {
      return true; // NPPES API is always available
    }

    if (state && STATE_BOARD_ENDPOINTS[state]) {
      return true;
    }

    return false;
  }

  /**
   * Verify license via API
   */
  private async verifyViaAPI(
    request: LicenseVerificationRequest
  ): Promise<LicenseVerificationResult> {
    logger.info('Verifying via API', { credentialId: request.credentialId });

    // Handle NPI verification
    if (request.licenseType === 'NPI_NUMBER') {
      return this.verifyNPI(request);
    }

    // Handle state license verification
    if (request.state) {
      return this.verifyStateLicense(request);
    }

    throw new Error('Cannot verify license via API');
  }

  /**
   * Verify NPI through NPPES
   */
  private async verifyNPI(request: LicenseVerificationRequest): Promise<LicenseVerificationResult> {
    logger.info('Verifying NPI', { npi: request.licenseNumber });

    // In real implementation, call NPPES API
    // https://npiregistry.cms.hhs.gov/api/

    // Simulated response
    return {
      credentialId: request.credentialId,
      verified: true,
      status: 'VERIFIED',
      verificationDate: new Date(),
      verificationMethod: 'API',
      licenseDetails: {
        status: 'ACTIVE',
        disciplinaryActions: [],
      },
      sourceUrl: `https://npiregistry.cms.hhs.gov/registry/provider/${request.licenseNumber}`,
    };
  }

  /**
   * Verify state license through state board API
   */
  private async verifyStateLicense(
    request: LicenseVerificationRequest
  ): Promise<LicenseVerificationResult> {
    logger.info('Verifying state license', {
      state: request.state,
      licenseNumber: request.licenseNumber,
    });

    // In real implementation, call state board API
    // Simulated response
    return {
      credentialId: request.credentialId,
      verified: true,
      status: 'VERIFIED',
      verificationDate: new Date(),
      verificationMethod: 'API',
      licenseDetails: {
        status: 'ACTIVE',
        issueDate: new Date('2020-01-01'),
        expirationDate: new Date('2026-01-01'),
        disciplinaryActions: [],
        scopeOfPractice: 'Full practice authority',
      },
      sourceUrl: STATE_BOARD_ENDPOINTS[request.state!],
    };
  }

  /**
   * Manual verification fallback
   */
  private async verifyManually(
    request: LicenseVerificationRequest
  ): Promise<LicenseVerificationResult> {
    logger.info('Queuing manual verification', {
      credentialId: request.credentialId,
    });

    // In real implementation:
    // 1. Queue verification task for staff
    // 2. Staff visits state board website
    // 3. Staff enters verification result

    return {
      credentialId: request.credentialId,
      verified: false,
      status: 'IN_PROGRESS',
      verificationDate: new Date(),
      verificationMethod: 'MANUAL',
      licenseDetails: {
        status: 'ACTIVE',
        disciplinaryActions: [],
      },
    };
  }

  /**
   * Query NPDB for practitioner reports
   */
  async queryNPDB(
    npi: string,
    lastName: string,
    firstName: string,
    dateOfBirth: Date
  ): Promise<NPDBQueryResult> {
    logger.info('Querying NPDB', { npi });

    // In real implementation, query NPDB
    // Requires NPDB account and authorization

    // Simulated clean result
    return {
      hasReports: false,
      reportCount: 0,
      reports: [],
    };
  }

  /**
   * Re-verify all credentials for a user
   */
  async reVerifyUserCredentials(userId: string): Promise<{
    total: number;
    verified: number;
    failed: number;
    results: LicenseVerificationResult[];
  }> {
    logger.info('Re-verifying user credentials', { userId });

    // In real implementation:
    // 1. Get all user credentials
    // 2. Re-verify each one
    // 3. Update status

    return {
      total: 0,
      verified: 0,
      failed: 0,
      results: [],
    };
  }

  /**
   * Check for disciplinary actions
   */
  async checkDisciplinaryActions(
    licenseNumber: string,
    state: string
  ): Promise<DisciplinaryAction[]> {
    logger.info('Checking disciplinary actions', { licenseNumber, state });

    // In real implementation, query state board
    return [];
  }

  /**
   * Schedule periodic re-verification
   */
  async scheduleReVerification(credentialId: string, intervalDays: number = 90): Promise<void> {
    logger.info('Scheduling re-verification', { credentialId, intervalDays });

    // In real implementation, create scheduled job
  }
}

export const licenseVerificationService = new LicenseVerificationService();
