/**
 * @module @skillancer/auth-svc/services/mfa-recovery
 * MFA Recovery service for account recovery when MFA is lost
 */

import crypto from 'crypto';

import { CacheService } from '@skillancer/cache';
import { prisma } from '@skillancer/database';

import { getConfig } from '../config/index.js';
import { NotFoundError, ValidationError } from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface RecoveryRequest {
  id: string;
  userId: string;
  email: string;
  method: 'email' | 'admin';
  status: 'pending' | 'verified' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  verifiedAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface RecoveryRequestResult {
  requestId: string;
  method: 'email' | 'admin';
  hint: string;
  expiresAt: Date;
  message: string;
}

export interface RecoveryVerificationResult {
  success: boolean;
  requestId: string;
  message: string;
  nextStep?: 'reset_mfa' | 'admin_review';
}

// =============================================================================
// CACHE KEYS
// =============================================================================

const CacheKeys = {
  recoveryRequest: (requestId: string) => `mfa_recovery:request:${requestId}`,
  recoveryByUser: (userId: string) => `mfa_recovery:user:${userId}`,
  recoveryCode: (requestId: string) => `mfa_recovery:code:${requestId}`,
  recoveryAttempts: (requestId: string) => `mfa_recovery:attempts:${requestId}`,
};

// =============================================================================
// CONSTANTS
// =============================================================================

const RECOVERY_CODE_LENGTH = 8;
const RECOVERY_CODE_EXPIRY = 15 * 60; // 15 minutes
const RECOVERY_REQUEST_EXPIRY = 24 * 60 * 60; // 24 hours
const MAX_VERIFICATION_ATTEMPTS = 5;
const RECOVERY_COOLDOWN = 60 * 60; // 1 hour between requests

// =============================================================================
// MFA RECOVERY SERVICE
// =============================================================================

/**
 * MFA Recovery Service
 *
 * Handles account recovery when MFA access is lost:
 * - Recovery email verification flow
 * - Admin-assisted recovery for high-security accounts
 * - Rate limiting and security controls
 */
export class MfaRecoveryService {
  private redis: Redis;
  private cache: CacheService;
  private config: ReturnType<typeof getConfig>;

  constructor(redis: Redis) {
    this.redis = redis;
    this.cache = new CacheService(redis, 'mfa_recovery');
    this.config = getConfig();
  }

  // ---------------------------------------------------------------------------
  // RECOVERY REQUEST
  // ---------------------------------------------------------------------------

  /**
   * Initiate MFA recovery process
   */
  async initiateRecovery(
    userId: string,
    options: { preferAdmin?: boolean } = {}
  ): Promise<RecoveryRequestResult> {
    // Check for recent recovery requests (cooldown)
    const existingRequest = await this.redis.get(CacheKeys.recoveryByUser(userId));
    if (existingRequest) {
      const ttl = await this.redis.ttl(CacheKeys.recoveryByUser(userId));
      throw new ValidationError(
        `Please wait ${Math.ceil(ttl / 60)} minutes before requesting another recovery`
      );
    }

    // Get user and MFA settings
    const [user, mfaSettings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true },
      }),
      prisma.userMfa.findUnique({
        where: { userId },
        select: {
          recoveryEmail: true,
          recoveryEmailVerified: true,
        },
      }),
    ]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Determine recovery method
    let method: 'email' | 'admin' = 'admin';
    let targetEmail = user.email;

    if (mfaSettings?.recoveryEmail && mfaSettings.recoveryEmailVerified && !options.preferAdmin) {
      method = 'email';
      targetEmail = mfaSettings.recoveryEmail;
    }

    // Generate request ID and code
    const requestId = crypto.randomUUID();
    const verificationCode = this.generateRecoveryCode();
    const expiresAt = new Date(Date.now() + RECOVERY_REQUEST_EXPIRY * 1000);

    // Store recovery request
    const request: RecoveryRequest = {
      id: requestId,
      userId,
      email: targetEmail,
      method,
      status: 'pending',
      createdAt: new Date(),
      expiresAt,
    };

    await this.redis.setex(
      CacheKeys.recoveryRequest(requestId),
      RECOVERY_REQUEST_EXPIRY,
      JSON.stringify(request)
    );

    // Store user -> request mapping (for cooldown)
    await this.redis.setex(CacheKeys.recoveryByUser(userId), RECOVERY_COOLDOWN, requestId);

    // Store verification code
    await this.redis.setex(
      CacheKeys.recoveryCode(requestId),
      RECOVERY_CODE_EXPIRY,
      verificationCode
    );

    // Send recovery email
    if (method === 'email') {
      this.sendRecoveryEmail(targetEmail, verificationCode, user.email);
    }

    return {
      requestId,
      method,
      hint:
        method === 'email'
          ? this.maskEmail(targetEmail)
          : 'Contact support for admin-assisted recovery',
      expiresAt,
      message:
        method === 'email'
          ? 'A verification code has been sent to your recovery email'
          : 'Your recovery request has been submitted for admin review',
    };
  }

  /**
   * Verify recovery code (email method)
   */
  async verifyRecoveryCode(requestId: string, code: string): Promise<RecoveryVerificationResult> {
    // Get request
    const requestData = await this.redis.get(CacheKeys.recoveryRequest(requestId));
    if (!requestData) {
      throw new NotFoundError('Recovery request not found or expired');
    }

    const request = JSON.parse(requestData) as RecoveryRequest;

    if (request.status !== 'pending') {
      throw new ValidationError(`Recovery request already ${request.status}`);
    }

    if (request.method !== 'email') {
      throw new ValidationError('This recovery request requires admin verification');
    }

    // Check attempts
    const attempts = parseInt((await this.redis.get(CacheKeys.recoveryAttempts(requestId))) || '0');
    if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
      await this.expireRequest(requestId);
      throw new ValidationError('Maximum verification attempts exceeded');
    }

    // Get stored code
    const storedCode = await this.redis.get(CacheKeys.recoveryCode(requestId));
    if (!storedCode) {
      throw new ValidationError('Verification code expired. Please request a new recovery.');
    }

    // Verify code
    if (code.toUpperCase() !== storedCode.toUpperCase()) {
      await this.redis.incr(CacheKeys.recoveryAttempts(requestId));
      throw new ValidationError('Invalid verification code');
    }

    // Mark request as verified
    request.status = 'verified';
    request.verifiedAt = new Date();

    await this.redis.setex(
      CacheKeys.recoveryRequest(requestId),
      RECOVERY_REQUEST_EXPIRY,
      JSON.stringify(request)
    );

    // Clean up code
    await this.redis.del(CacheKeys.recoveryCode(requestId));
    await this.redis.del(CacheKeys.recoveryAttempts(requestId));

    return {
      success: true,
      requestId,
      message: 'Recovery verified. You can now reset your MFA.',
      nextStep: 'reset_mfa',
    };
  }

  /**
   * Complete MFA recovery by resetting MFA
   */
  async completeRecovery(requestId: string): Promise<{ success: boolean; message: string }> {
    // Get request
    const requestData = await this.redis.get(CacheKeys.recoveryRequest(requestId));
    if (!requestData) {
      throw new NotFoundError('Recovery request not found or expired');
    }

    const request = JSON.parse(requestData) as RecoveryRequest;

    if (request.status !== 'verified' && request.status !== 'approved') {
      throw new ValidationError(
        request.status === 'pending'
          ? 'Recovery request not yet verified'
          : `Recovery request already ${request.status}`
      );
    }

    // Reset MFA for user
    await this.resetUserMfa(request.userId);

    // Mark request as completed
    request.status = 'approved';
    request.resolvedAt = new Date();

    await this.redis.setex(
      CacheKeys.recoveryRequest(requestId),
      3600, // Keep for 1 hour for audit
      JSON.stringify(request)
    );

    // Clean up user mapping
    await this.redis.del(CacheKeys.recoveryByUser(request.userId));

    // Log recovery event
    await this.logRecoveryEvent(request.userId, 'mfa_reset_via_recovery', requestId);

    return {
      success: true,
      message: 'MFA has been reset. Please set up MFA again.',
    };
  }

  /**
   * Resend recovery code
   */
  async resendRecoveryCode(requestId: string): Promise<{ success: boolean; expiresAt: Date }> {
    // Get request
    const requestData = await this.redis.get(CacheKeys.recoveryRequest(requestId));
    if (!requestData) {
      throw new NotFoundError('Recovery request not found or expired');
    }

    const request = JSON.parse(requestData) as RecoveryRequest;

    if (request.status !== 'pending') {
      throw new ValidationError(`Recovery request already ${request.status}`);
    }

    if (request.method !== 'email') {
      throw new ValidationError('Cannot resend code for admin-assisted recovery');
    }

    // Check rate limit for resend
    const lastResendKey = `mfa_recovery:resend:${requestId}`;
    const lastResend = await this.redis.get(lastResendKey);
    if (lastResend) {
      throw new ValidationError('Please wait before requesting another code');
    }

    // Generate new code
    const verificationCode = this.generateRecoveryCode();
    const expiresAt = new Date(Date.now() + RECOVERY_CODE_EXPIRY * 1000);

    // Store new code
    await this.redis.setex(
      CacheKeys.recoveryCode(requestId),
      RECOVERY_CODE_EXPIRY,
      verificationCode
    );

    // Rate limit resend (60 seconds)
    await this.redis.setex(lastResendKey, 60, '1');

    // Get user email for resend
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { email: true },
    });

    // Send email
    this.sendRecoveryEmail(request.email, verificationCode, user?.email);

    return { success: true, expiresAt };
  }

  // ---------------------------------------------------------------------------
  // RECOVERY EMAIL MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Set up a recovery email address
   */
  async setupRecoveryEmail(
    userId: string,
    recoveryEmail: string
  ): Promise<{ verificationSent: boolean }> {
    // Validate email is different from primary
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (recoveryEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new ValidationError('Recovery email must be different from your primary email');
    }

    // Update MFA settings
    await prisma.userMfa.update({
      where: { userId },
      data: {
        recoveryEmail,
        recoveryEmailVerified: false,
      },
    });

    // Send verification email
    const verificationCode = this.generateRecoveryCode();
    await this.redis.setex(
      `mfa_recovery:email_verify:${userId}`,
      RECOVERY_CODE_EXPIRY,
      `${recoveryEmail}:${verificationCode}`
    );

    this.sendRecoveryEmailVerification(recoveryEmail, verificationCode);

    return { verificationSent: true };
  }

  /**
   * Verify recovery email
   */
  async verifyRecoveryEmail(userId: string, code: string): Promise<{ verified: boolean }> {
    const storedData = await this.redis.get(`mfa_recovery:email_verify:${userId}`);
    if (!storedData) {
      throw new ValidationError('Verification code expired. Please set up recovery email again.');
    }

    const parts = storedData.split(':');
    const storedEmail = parts[0];
    const storedCode = parts[1];

    if (!storedEmail || !storedCode) {
      throw new ValidationError('Invalid verification data. Please set up recovery email again.');
    }

    if (code.toUpperCase() !== storedCode.toUpperCase()) {
      throw new ValidationError('Invalid verification code');
    }

    // Mark as verified
    await prisma.userMfa.update({
      where: { userId },
      data: {
        recoveryEmail: storedEmail,
        recoveryEmailVerified: true,
      },
    });

    // Clean up
    await this.redis.del(`mfa_recovery:email_verify:${userId}`);

    return { verified: true };
  }

  /**
   * Remove recovery email
   */
  async removeRecoveryEmail(userId: string): Promise<void> {
    await prisma.userMfa.update({
      where: { userId },
      data: {
        recoveryEmail: null,
        recoveryEmailVerified: false,
      },
    });
  }

  /**
   * Get recovery email status
   */
  async getRecoveryEmailStatus(userId: string): Promise<{
    hasRecoveryEmail: boolean;
    recoveryEmailHint: string | null;
    verified: boolean;
  }> {
    const mfaSettings = await prisma.userMfa.findUnique({
      where: { userId },
      select: {
        recoveryEmail: true,
        recoveryEmailVerified: true,
      },
    });

    return {
      hasRecoveryEmail: !!mfaSettings?.recoveryEmail,
      recoveryEmailHint: mfaSettings?.recoveryEmail
        ? this.maskEmail(mfaSettings.recoveryEmail)
        : null,
      verified: mfaSettings?.recoveryEmailVerified ?? false,
    };
  }

  // ---------------------------------------------------------------------------
  // ADMIN FUNCTIONS
  // ---------------------------------------------------------------------------

  /**
   * Get pending recovery requests (admin)
   */
  getPendingRecoveryRequests(): RecoveryRequest[] {
    // In production, you'd query from a database
    // For now, return empty - admin would need to search by user
    return [];
  }

  /**
   * Approve admin-assisted recovery
   */
  async approveRecovery(requestId: string, adminId: string): Promise<{ success: boolean }> {
    const requestData = await this.redis.get(CacheKeys.recoveryRequest(requestId));
    if (!requestData) {
      throw new NotFoundError('Recovery request not found or expired');
    }

    const request = JSON.parse(requestData) as RecoveryRequest;

    if (request.status !== 'pending' || request.method !== 'admin') {
      throw new ValidationError('This request cannot be approved');
    }

    request.status = 'approved';
    request.resolvedAt = new Date();
    request.resolvedBy = adminId;

    await this.redis.setex(
      CacheKeys.recoveryRequest(requestId),
      RECOVERY_REQUEST_EXPIRY,
      JSON.stringify(request)
    );

    return { success: true };
  }

  /**
   * Reject admin-assisted recovery
   */
  async rejectRecovery(requestId: string, adminId: string): Promise<{ success: boolean }> {
    const requestData = await this.redis.get(CacheKeys.recoveryRequest(requestId));
    if (!requestData) {
      throw new NotFoundError('Recovery request not found or expired');
    }

    const request = JSON.parse(requestData) as RecoveryRequest;

    if (request.status !== 'pending') {
      throw new ValidationError('This request cannot be rejected');
    }

    request.status = 'rejected';
    request.resolvedAt = new Date();
    request.resolvedBy = adminId;

    await this.redis.setex(
      CacheKeys.recoveryRequest(requestId),
      RECOVERY_REQUEST_EXPIRY,
      JSON.stringify(request)
    );

    // Clean up user mapping
    await this.redis.del(CacheKeys.recoveryByUser(request.userId));

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Generate a recovery verification code
   */
  private generateRecoveryCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
      code += chars[crypto.randomInt(chars.length)];
    }
    return code;
  }

  /**
   * Send recovery email
   *
   * Note: In production, integrate with notification service or email provider
   */
  private sendRecoveryEmail(
    recoveryEmail: string,
    code: string,
    primaryEmail: string | undefined
  ): void {
    const expiryMinutes = Math.floor(RECOVERY_CODE_EXPIRY / 60);

    // TODO: Integrate with notification service for production
    // For now, log the email details for development
    console.log(`[MFA Recovery] Sending recovery email to ${recoveryEmail}`);
    console.log(`[MFA Recovery] Code: ${code}, Expires in: ${expiryMinutes} minutes`);
    console.log(`[MFA Recovery] Primary email: ${primaryEmail || 'N/A'}`);

    // In production, use the notification service:
    // const { notificationClient } = await import('@skillancer/service-client');
    // await notificationClient.sendNotification({
    //   userId: 'system',
    //   type: 'system',
    //   channels: ['email'],
    //   priority: 'high',
    //   data: { to: recoveryEmail, templateId: 'mfa-recovery', code, expiryMinutes },
    // });
  }

  /**
   * Send recovery email verification
   *
   * Note: In production, integrate with notification service or email provider
   */
  private sendRecoveryEmailVerification(email: string, code: string): void {
    const expiryMinutes = Math.floor(RECOVERY_CODE_EXPIRY / 60);

    // TODO: Integrate with notification service for production
    console.log(`[MFA Recovery] Sending verification email to ${email}`);
    console.log(`[MFA Recovery] Code: ${code}, Expires in: ${expiryMinutes} minutes`);

    // In production, use the notification service
  }

  /**
   * Reset user MFA settings
   */
  private async resetUserMfa(userId: string): Promise<void> {
    await prisma.userMfa.update({
      where: { userId },
      data: {
        enabled: false,
        // Keep primaryMethod as is (has a default value)
        totpSecret: null,
        totpVerifiedAt: null,
        phoneNumber: null,
        phoneVerifiedAt: null,
        recoveryCodes: [],
        recoveryCodesGeneratedAt: null,
        recoveryCodesUsedCount: 0,
        // Keep recovery email settings
      },
    });

    // Revoke all trusted devices
    await prisma.trustedDevice.updateMany({
      where: { userId, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: 'MFA recovery',
      },
    });
  }

  /**
   * Expire a recovery request
   */
  private async expireRequest(requestId: string): Promise<void> {
    const requestData = await this.redis.get(CacheKeys.recoveryRequest(requestId));
    if (requestData) {
      const request = JSON.parse(requestData) as RecoveryRequest;
      request.status = 'expired';

      await this.redis.setex(CacheKeys.recoveryRequest(requestId), 3600, JSON.stringify(request));

      await this.redis.del(CacheKeys.recoveryByUser(request.userId));
    }
  }

  /**
   * Log recovery event for audit
   */
  private async logRecoveryEvent(userId: string, event: string, requestId: string): Promise<void> {
    // Log to audit table if it exists
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action: event,
          entityType: 'mfa_recovery',
          entityId: requestId,
          metadata: { requestId },
        },
      });
    } catch {
      // AuditLog table might not exist yet
      console.log(`[MFA Recovery] ${event} for user ${userId}, request ${requestId}`);
    }
  }

  /**
   * Mask email for display
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***';
    const maskedLocal = local[0] + '***';
    return `${maskedLocal}@${domain}`;
  }
}

// =============================================================================
// MODULE-LEVEL INSTANCE MANAGEMENT
// =============================================================================

let mfaRecoveryServiceInstance: MfaRecoveryService | null = null;

/**
 * Initialize the MfaRecoveryService
 */
export function initializeMfaRecoveryService(redis: Redis): MfaRecoveryService {
  mfaRecoveryServiceInstance = new MfaRecoveryService(redis);
  return mfaRecoveryServiceInstance;
}

/**
 * Get the MfaRecoveryService instance
 */
export function getMfaRecoveryService(): MfaRecoveryService {
  if (!mfaRecoveryServiceInstance) {
    throw new Error('MfaRecoveryService not initialized. Call initializeMfaRecoveryService first.');
  }
  return mfaRecoveryServiceInstance;
}

/**
 * Reset the MfaRecoveryService instance (for testing)
 */
export function resetMfaRecoveryService(): void {
  mfaRecoveryServiceInstance = null;
}

export default MfaRecoveryService;
