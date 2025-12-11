/**
 * @module @skillancer/auth-svc/services/step-up-auth
 * Step-up authentication service for sensitive operations
 */

import crypto from 'crypto';

import { CacheService } from '@skillancer/cache';
import { MfaMethod } from '@skillancer/database';

import { getMfaService } from './mfa.service.js';
import { getConfig } from '../config/index.js';
import {
  StepUpAuthRequiredError,
  MfaNotEnabledError,
  InvalidMfaCodeError,
} from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Operations requiring step-up authentication
 */
export type SensitiveOperation =
  | 'change_password'
  | 'change_email'
  | 'disable_mfa'
  | 'regenerate_recovery_codes'
  | 'delete_account'
  | 'change_billing'
  | 'api_key_create'
  | 'export_data'
  | 'trust_device'
  | 'revoke_all_devices'
  | 'setup_recovery_email'
  | 'remove_recovery_email';

/**
 * Step-up authentication state
 */
export interface StepUpAuthState {
  userId: string;
  operation: SensitiveOperation;
  grantedAt: Date;
  expiresAt: Date;
  method: MfaMethod;
}

/**
 * Step-up verification result
 */
export interface StepUpVerificationResult {
  token: string;
  expiresAt: Date;
  operation: SensitiveOperation;
}

// =============================================================================
// CACHE KEYS
// =============================================================================

const CacheKeys = {
  stepUpAuth: (userId: string, operation: SensitiveOperation) => `stepup:${operation}:${userId}`,
  stepUpChallenge: (userId: string) => `stepup:challenge:${userId}`,
};

// =============================================================================
// STEP-UP AUTH SERVICE
// =============================================================================

/**
 * Step-up Authentication Service
 *
 * Handles elevated authentication for sensitive operations.
 * Requires re-verification via MFA or password for operations like:
 * - Password change
 * - Email change
 * - Disabling MFA
 * - Account deletion
 * - Billing changes
 *
 * @example
 * ```typescript
 * const stepUpService = new StepUpAuthService(redis);
 *
 * // Check if step-up is required
 * if (!await stepUpService.hasValidStepUp(userId, 'change_password')) {
 *   throw new StepUpAuthRequiredError('change_password');
 * }
 *
 * // Initiate step-up authentication
 * const challenge = await stepUpService.initiateStepUp(userId, 'change_password');
 *
 * // Verify step-up with MFA code
 * const token = await stepUpService.verifyStepUp(userId, 'change_password', code, MfaMethod.TOTP);
 *
 * // Use token to perform sensitive operation
 * await stepUpService.validateStepUpToken(userId, 'change_password', token);
 * ```
 */
export class StepUpAuthService {
  private readonly config = getConfig();
  private readonly cache: CacheService;

  constructor(redis: Redis) {
    this.cache = new CacheService(redis, 'stepup');
  }

  /**
   * Check if user has a valid step-up authentication for an operation
   *
   * @param userId - User ID
   * @param operation - Sensitive operation
   * @returns True if valid step-up exists
   */
  async hasValidStepUp(userId: string, operation: SensitiveOperation): Promise<boolean> {
    const state = await this.cache.get<StepUpAuthState>(CacheKeys.stepUpAuth(userId, operation));

    if (!state) {
      return false;
    }

    return state.expiresAt > new Date();
  }

  /**
   * Require step-up authentication for an operation
   *
   * @param userId - User ID
   * @param operation - Sensitive operation
   * @throws StepUpAuthRequiredError if no valid step-up exists
   */
  async requireStepUp(userId: string, operation: SensitiveOperation): Promise<void> {
    const hasValid = await this.hasValidStepUp(userId, operation);
    if (!hasValid) {
      throw new StepUpAuthRequiredError(operation);
    }
  }

  /**
   * Initiate step-up authentication challenge
   *
   * @param userId - User ID
   * @param operation - Sensitive operation
   * @returns Challenge ID and available methods
   */
  async initiateStepUp(
    userId: string,
    operation: SensitiveOperation
  ): Promise<{
    challengeId: string;
    availableMethods: MfaMethod[];
    expiresAt: Date;
  }> {
    const mfaService = getMfaService();

    // Check if user has MFA enabled
    const mfaStatus = await mfaService.getMfaStatus(userId);

    if (!mfaStatus.enabled) {
      // If no MFA, require password re-verification instead
      // For now, we'll throw an error - could be enhanced to support password-only step-up
      throw new MfaNotEnabledError('MFA required for step-up authentication');
    }

    // Get available methods
    const methods = await mfaService.getAvailableMethods(userId);
    const availableMethods: MfaMethod[] = [];

    if (methods.totp) availableMethods.push(MfaMethod.TOTP);
    if (methods.sms) availableMethods.push(MfaMethod.SMS);
    if (methods.email) availableMethods.push(MfaMethod.EMAIL);
    // Recovery codes not allowed for step-up auth

    const challengeId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.config.mfa.challengeTtl);

    // Store challenge
    await this.cache.set(
      CacheKeys.stepUpChallenge(userId),
      {
        challengeId,
        operation,
        createdAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
      { ttl: this.config.mfa.challengeTtl / 1000 }
    );

    return {
      challengeId,
      availableMethods,
      expiresAt,
    };
  }

  /**
   * Verify step-up authentication with MFA code
   *
   * @param userId - User ID
   * @param operation - Sensitive operation
   * @param code - MFA code
   * @param method - MFA method used
   * @returns Step-up verification result with token
   */
  async verifyStepUp(
    userId: string,
    operation: SensitiveOperation,
    code: string,
    method: MfaMethod
  ): Promise<StepUpVerificationResult> {
    const mfaService = getMfaService();

    // Get the pending challenge
    const challenge = await this.cache.get<{
      challengeId: string;
      operation: SensitiveOperation;
    }>(CacheKeys.stepUpChallenge(userId));

    if (!challenge || challenge.operation !== operation) {
      throw new StepUpAuthRequiredError(operation);
    }

    // Create MFA challenge and verify it
    const pendingSession = await mfaService.createPendingSession(userId, {
      userAgent: 'step-up',
      ip: '0.0.0.0',
    });

    const mfaChallenge = await mfaService.createChallenge(
      userId,
      pendingSession.pendingSessionId,
      method
    );

    const verified = await mfaService.verifyChallenge(mfaChallenge.challengeId, code);

    if (!verified) {
      throw new InvalidMfaCodeError();
    }

    // Generate step-up token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.config.mfa.stepUpAuthTtl);

    // Store step-up state
    const state: StepUpAuthState = {
      userId,
      operation,
      grantedAt: new Date(),
      expiresAt,
      method,
    };

    await this.cache.set(CacheKeys.stepUpAuth(userId, operation), state, {
      ttl: this.config.mfa.stepUpAuthTtl / 1000,
    });

    // Clear the challenge
    await this.cache.delete(CacheKeys.stepUpChallenge(userId));
    await mfaService.deletePendingSession(pendingSession.pendingSessionId);

    return {
      token,
      expiresAt,
      operation,
    };
  }

  /**
   * Validate step-up token
   *
   * @param userId - User ID
   * @param operation - Sensitive operation
   * @param token - Step-up token (optional, can also validate by cache)
   * @throws StepUpAuthRequiredError if invalid
   */
  async validateStepUpToken(
    userId: string,
    operation: SensitiveOperation,
    _token?: string
  ): Promise<void> {
    const hasValid = await this.hasValidStepUp(userId, operation);
    if (!hasValid) {
      throw new StepUpAuthRequiredError(operation);
    }
  }

  /**
   * Invalidate step-up authentication for an operation
   *
   * @param userId - User ID
   * @param operation - Sensitive operation (or 'all' for all operations)
   */
  async invalidateStepUp(userId: string, operation: SensitiveOperation | 'all'): Promise<void> {
    if (operation === 'all') {
      // Invalidate all sensitive operations
      const operations: SensitiveOperation[] = [
        'change_password',
        'change_email',
        'disable_mfa',
        'regenerate_recovery_codes',
        'delete_account',
        'change_billing',
        'api_key_create',
        'export_data',
      ];

      await Promise.all(
        operations.map(async (op) => this.cache.delete(CacheKeys.stepUpAuth(userId, op)))
      );
    } else {
      await this.cache.delete(CacheKeys.stepUpAuth(userId, operation));
    }
  }

  /**
   * Get remaining time for a step-up authentication
   *
   * @param userId - User ID
   * @param operation - Sensitive operation
   * @returns Remaining time in seconds, or 0 if expired/not found
   */
  async getStepUpRemainingTime(userId: string, operation: SensitiveOperation): Promise<number> {
    const state = await this.cache.get<StepUpAuthState>(CacheKeys.stepUpAuth(userId, operation));

    if (!state) {
      return 0;
    }

    const remaining = new Date(state.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let stepUpServiceInstance: StepUpAuthService | null = null;

/**
 * Initialize step-up auth service
 */
export function initializeStepUpService(redis: Redis): StepUpAuthService {
  stepUpServiceInstance = new StepUpAuthService(redis);
  return stepUpServiceInstance;
}

/**
 * Get step-up auth service instance
 */
export function getStepUpService(): StepUpAuthService {
  if (!stepUpServiceInstance) {
    throw new Error('Step-up auth service not initialized. Call initializeStepUpService first.');
  }
  return stepUpServiceInstance;
}

/**
 * Reset step-up auth service (for testing)
 */
export function resetStepUpService(): void {
  stepUpServiceInstance = null;
}
