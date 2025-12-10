/**
 * @module @skillancer/auth-svc/services/mfa
 * Multi-Factor Authentication service
 */

import crypto from 'crypto';

import { CacheService } from '@skillancer/cache';
import { prisma, type UserMfa, MfaMethod } from '@skillancer/database';
import bcrypt from 'bcrypt';

import { getTotpService, type TotpSetupResult } from './totp.service.js';
import { getConfig } from '../config/index.js';
import {
  MfaNotEnabledError,
  MfaAlreadyEnabledError,
  InvalidMfaCodeError,
  MfaSetupIncompleteError,
  MfaChallengeExpiredError,
  MfaMaxAttemptsExceededError,
} from '../errors/index.js';

import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface MfaStatus {
  enabled: boolean;
  primaryMethod: MfaMethod | null;
  totpConfigured: boolean;
  smsConfigured: boolean;
  emailConfigured: boolean;
  hasRecoveryCodes: boolean;
  recoveryCodesRemaining: number;
}

export interface MfaSetupInitResult extends TotpSetupResult {
  /** Temporary setup ID to track this setup attempt */
  setupId: string;
}

export interface MfaChallengeResult {
  challengeId: string;
  method: MfaMethod;
  expiresAt: Date;
  /** Hint for SMS/email (e.g., "***1234" or "t***@example.com") */
  hint?: string;
}

export interface AvailableMfaMethods {
  totp: boolean;
  sms: boolean;
  email: boolean;
  recoveryCode: boolean;
}

export { MfaMethod };

// =============================================================================
// CACHE KEYS
// =============================================================================

const CacheKeys = {
  totpSetup: (userId: string) => `mfa:totp_setup:${userId}`,
  smsSetup: (userId: string) => `mfa:sms_setup:${userId}`,
  pendingSession: (sessionId: string) => `mfa:pending_session:${sessionId}`,
  mfaAttempts: (userId: string, type: string) => `mfa:attempts:${type}:${userId}`,
};

// =============================================================================
// SMS SERVICE INTERFACE
// =============================================================================

export interface SmsService {
  sendCode(phoneNumber: string, code: string): Promise<void>;
}

// Mock SMS service for development
class MockSmsService implements SmsService {
  async sendCode(phoneNumber: string, code: string): Promise<void> {
    console.log(`[MOCK SMS] Sending code ${code} to ${phoneNumber}`);
    return Promise.resolve();
  }
}

// =============================================================================
// MFA SERVICE
// =============================================================================

/**
 * Multi-Factor Authentication Service
 *
 * Handles:
 * - TOTP setup and verification
 * - SMS code setup and verification
 * - Email code generation and verification
 * - Recovery code generation and usage
 * - MFA challenges during login
 * - Tenant MFA policy enforcement
 *
 * @example
 * ```typescript
 * const mfaService = new MfaService(redis);
 *
 * // Setup TOTP
 * const setup = await mfaService.initiateTotpSetup(userId);
 * // User scans QR code and enters code
 * await mfaService.verifyTotpSetup(userId, code);
 *
 * // During login
 * const challenge = await mfaService.createChallenge(userId, sessionId, MfaMethod.TOTP);
 * const isValid = await mfaService.verifyChallenge(challenge.id, code);
 * ```
 */
export class MfaService {
  private readonly config = getConfig();
  private readonly totpService = getTotpService();
  private readonly cache: CacheService;
  private readonly smsService: SmsService;

  constructor(redis: Redis, smsService?: SmsService) {
    this.cache = new CacheService(redis, 'mfa');
    this.smsService = smsService ?? new MockSmsService();
  }

  // ===========================================================================
  // TOTP SETUP
  // ===========================================================================

  /**
   * Initiate TOTP setup for a user
   *
   * @param userId - User ID
   * @returns Setup data including QR code and manual entry key
   * @throws MfaAlreadyEnabledError if TOTP is already configured
   */
  async initiateTotpSetup(userId: string): Promise<MfaSetupInitResult> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, mfa: true },
    });

    // Check if TOTP is already verified
    if (user.mfa?.totpVerified) {
      throw new MfaAlreadyEnabledError('TOTP is already configured');
    }

    // Generate TOTP setup
    const setup = await this.totpService.generateSetup(user.email, userId);
    const setupId = crypto.randomUUID();

    // Store encrypted secret temporarily
    const encryptedSecret = this.totpService.encryptSecret(setup.secret);
    await this.cache.set(
      CacheKeys.totpSetup(userId),
      { setupId, encryptedSecret },
      { ttl: this.config.mfa.challengeTtl / 1000 } // Convert to seconds
    );

    return {
      ...setup,
      setupId,
    };
  }

  /**
   * Verify TOTP setup with a code
   *
   * @param userId - User ID
   * @param code - TOTP code to verify
   * @throws InvalidMfaCodeError if code is invalid
   * @throws MfaSetupIncompleteError if setup not initiated
   */
  async verifyTotpSetup(userId: string, code: string): Promise<void> {
    // Get pending setup
    const setupData = await this.cache.get<{ setupId: string; encryptedSecret: string }>(
      CacheKeys.totpSetup(userId)
    );

    if (!setupData) {
      throw new MfaSetupIncompleteError('TOTP setup not initiated or expired');
    }

    // Decrypt and verify code
    const secret = this.totpService.decryptSecret(setupData.encryptedSecret);
    const isValid = this.totpService.verifyCode(secret, code);

    if (!isValid) {
      throw new InvalidMfaCodeError('Invalid TOTP code');
    }

    // Generate recovery codes
    const recoveryCodes = this.generateRecoveryCodes(userId);

    // Save MFA configuration
    await prisma.userMfa.upsert({
      where: { userId },
      create: {
        userId,
        enabled: true,
        primaryMethod: MfaMethod.TOTP,
        totpSecret: setupData.encryptedSecret,
        totpVerified: true,
        recoveryCodes: await this.hashRecoveryCodes(recoveryCodes),
        recoveryCodesGeneratedAt: new Date(),
      },
      update: {
        totpSecret: setupData.encryptedSecret,
        totpVerified: true,
        enabled: true,
        primaryMethod: MfaMethod.TOTP,
        recoveryCodes: await this.hashRecoveryCodes(recoveryCodes),
        recoveryCodesGeneratedAt: new Date(),
        recoveryCodesUsedCount: 0,
      },
    });

    // Clear setup cache
    await this.cache.delete(CacheKeys.totpSetup(userId));
  }

  // ===========================================================================
  // SMS SETUP
  // ===========================================================================

  /**
   * Initiate SMS MFA setup
   *
   * @param userId - User ID
   * @param phoneNumber - Phone number to verify
   */
  async initiateSmsSetup(userId: string, phoneNumber: string): Promise<void> {
    // Normalize phone number (basic validation)
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    // Generate verification code
    const code = this.generateNumericCode(this.config.mfa.smsCodeLength);
    const hashedCode = await bcrypt.hash(code, 10);

    // Store setup data
    await this.cache.set(
      CacheKeys.smsSetup(userId),
      { phoneNumber: normalizedPhone, hashedCode },
      { ttl: this.config.mfa.smsCodeTtl / 1000 }
    );

    // Send SMS
    await this.smsService.sendCode(normalizedPhone, code);
  }

  /**
   * Verify SMS setup code
   *
   * @param userId - User ID
   * @param code - SMS code to verify
   */
  async verifySmsSetup(userId: string, code: string): Promise<void> {
    const setupData = await this.cache.get<{ phoneNumber: string; hashedCode: string }>(
      CacheKeys.smsSetup(userId)
    );

    if (!setupData) {
      throw new MfaSetupIncompleteError('SMS setup not initiated or expired');
    }

    const isValid = await bcrypt.compare(code, setupData.hashedCode);
    if (!isValid) {
      throw new InvalidMfaCodeError('Invalid SMS code');
    }

    // Update MFA configuration
    await prisma.userMfa.upsert({
      where: { userId },
      create: {
        userId,
        phoneNumber: setupData.phoneNumber,
        phoneVerified: true,
      },
      update: {
        phoneNumber: setupData.phoneNumber,
        phoneVerified: true,
      },
    });

    // Clear setup cache
    await this.cache.delete(CacheKeys.smsSetup(userId));
  }

  // ===========================================================================
  // MFA CHALLENGES
  // ===========================================================================

  /**
   * Create an MFA challenge for login
   *
   * @param userId - User ID
   * @param sessionId - Pending session ID
   * @param method - MFA method to use
   * @returns Challenge details
   */
  async createChallenge(
    userId: string,
    sessionId: string,
    method: MfaMethod
  ): Promise<MfaChallengeResult> {
    const mfa = await this.getMfaConfig(userId);

    if (!mfa?.enabled) {
      throw new MfaNotEnabledError();
    }

    // Validate method is available
    const available = await this.getAvailableMethods(userId);
    if (!this.isMethodAvailable(method, available)) {
      throw new InvalidMfaCodeError(`MFA method ${method} is not available`);
    }

    const expiresAt = new Date(Date.now() + this.config.mfa.challengeTtl);
    let code: string | null = null;
    let hint: string | undefined;

    // Generate and send code for SMS/email methods
    if (method === MfaMethod.SMS) {
      code = this.generateNumericCode(this.config.mfa.smsCodeLength);
      await this.smsService.sendCode(mfa.phoneNumber, code);
      hint = this.maskPhoneNumber(mfa.phoneNumber);
    } else if (method === MfaMethod.EMAIL) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true },
      });
      code = this.generateNumericCode(this.config.mfa.emailCodeLength);
      // TODO: Send email via notification service
      console.log(`[EMAIL MFA] Code ${code} for ${user.email}`);
      hint = this.maskEmail(user.email);
    }

    // Create challenge record
    const challenge = await prisma.mfaChallenge.create({
      data: {
        userId,
        sessionId,
        method,
        code: code ? await bcrypt.hash(code, 10) : null,
        expiresAt,
      },
    });

    return {
      challengeId: challenge.id,
      method,
      expiresAt,
      hint,
    };
  }

  /**
   * Verify an MFA challenge
   *
   * @param challengeId - Challenge ID
   * @param code - Code to verify
   * @returns True if verified
   */
  async verifyChallenge(challengeId: string, code: string): Promise<boolean> {
    const challenge = await prisma.mfaChallenge.findUnique({
      where: { id: challengeId },
      include: {},
    });

    if (!challenge) {
      throw new MfaChallengeExpiredError();
    }

    if (challenge.verified) {
      return true; // Already verified
    }

    if (challenge.expiresAt < new Date()) {
      await prisma.mfaChallenge.delete({ where: { id: challengeId } });
      throw new MfaChallengeExpiredError();
    }

    // Check max attempts
    if (challenge.attempts >= this.config.rateLimit.mfa.totpMaxAttempts) {
      await prisma.mfaChallenge.delete({ where: { id: challengeId } });
      throw new MfaMaxAttemptsExceededError();
    }

    let isValid = false;

    switch (challenge.method) {
      case MfaMethod.TOTP:
        isValid = await this.verifyTotpCode(challenge.userId, code);
        break;
      case MfaMethod.SMS:
      case MfaMethod.EMAIL:
        isValid = challenge.code ? await bcrypt.compare(code, challenge.code) : false;
        break;
      case MfaMethod.RECOVERY_CODE:
        isValid = await this.verifyRecoveryCode(challenge.userId, code);
        break;
    }

    if (isValid) {
      await prisma.mfaChallenge.update({
        where: { id: challengeId },
        data: { verified: true },
      });
      return true;
    }

    // Increment attempts
    await prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: { attempts: { increment: 1 } },
    });

    throw new InvalidMfaCodeError();
  }

  /**
   * Verify TOTP code against user's secret
   */
  private async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const mfa = await this.getMfaConfig(userId);

    if (!mfa?.totpSecret || !mfa.totpVerified) {
      return false;
    }

    const secret = this.totpService.decryptSecret(mfa.totpSecret);
    return this.totpService.verifyCode(secret, code);
  }

  // ===========================================================================
  // RECOVERY CODES
  // ===========================================================================

  /**
   * Generate new recovery codes
   *
   * @param _userId - User ID (unused, for future audit logging)
   * @returns Array of recovery codes (plain text, only shown once)
   */
  generateRecoveryCodes(_userId: string): string[] {
    const codes: string[] = [];
    const count = this.config.mfa.recoveryCodeCount;

    for (let i = 0; i < count; i++) {
      // Format: XXXX-XXXX-XXXX (alphanumeric, uppercase)
      const code = this.generateRecoveryCode();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Regenerate recovery codes (requires re-authentication)
   *
   * @param userId - User ID
   * @returns New recovery codes
   */
  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const codes = this.generateRecoveryCodes(userId);
    const hashedCodes = await this.hashRecoveryCodes(codes);

    await prisma.userMfa.update({
      where: { userId },
      data: {
        recoveryCodes: hashedCodes,
        recoveryCodesGeneratedAt: new Date(),
        recoveryCodesUsedCount: 0,
      },
    });

    return codes;
  }

  /**
   * Verify a recovery code
   *
   * @param userId - User ID
   * @param code - Recovery code to verify
   * @returns True if valid
   */
  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    const mfa = await this.getMfaConfig(userId);

    if (!mfa?.recoveryCodes?.length) {
      return false;
    }

    const normalizedCode = code.toUpperCase().replace(/-/g, '');

    // Find matching code
    for (let i = 0; i < mfa.recoveryCodes.length; i++) {
      const hashedCode = mfa.recoveryCodes[i];
      if (!hashedCode) continue;

      // Check if this code matches and hasn't been used (marked with 'USED:' prefix)
      if (!hashedCode.startsWith('USED:')) {
        const isMatch = await bcrypt.compare(normalizedCode, hashedCode);
        if (isMatch) {
          // Mark code as used
          const updatedCodes = [...mfa.recoveryCodes];
          updatedCodes[i] = `USED:${hashedCode}`;

          await prisma.userMfa.update({
            where: { userId },
            data: {
              recoveryCodes: updatedCodes,
              recoveryCodesUsedCount: { increment: 1 },
            },
          });

          return true;
        }
      }
    }

    return false;
  }

  /**
   * Hash recovery codes for storage
   */
  private async hashRecoveryCodes(codes: string[]): Promise<string[]> {
    return Promise.all(
      codes.map(async (code) => {
        const normalized = code.toUpperCase().replace(/-/g, '');
        return bcrypt.hash(normalized, 10);
      })
    );
  }

  /**
   * Generate a single recovery code
   */
  private generateRecoveryCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omit easily confused chars
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars[crypto.randomInt(chars.length)];
    }
    // Format as XXXX-XXXX-XXXX
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
  }

  // ===========================================================================
  // MFA STATUS & MANAGEMENT
  // ===========================================================================

  /**
   * Get MFA status for a user
   */
  async getMfaStatus(userId: string): Promise<MfaStatus> {
    const mfa = await this.getMfaConfig(userId);

    if (!mfa) {
      return {
        enabled: false,
        primaryMethod: null,
        totpConfigured: false,
        smsConfigured: false,
        emailConfigured: true, // Always available via email
        hasRecoveryCodes: false,
        recoveryCodesRemaining: 0,
      };
    }

    const usedCount = mfa.recoveryCodesUsedCount ?? 0;
    const totalCodes = mfa.recoveryCodes?.length ?? 0;

    return {
      enabled: mfa.enabled,
      primaryMethod: mfa.primaryMethod,
      totpConfigured: mfa.totpVerified,
      smsConfigured: mfa.phoneVerified,
      emailConfigured: true,
      hasRecoveryCodes: totalCodes > 0,
      recoveryCodesRemaining: Math.max(0, totalCodes - usedCount),
    };
  }

  /**
   * Get available MFA methods for a user
   */
  async getAvailableMethods(userId: string): Promise<AvailableMfaMethods> {
    const mfa = await this.getMfaConfig(userId);

    const usedCount = mfa?.recoveryCodesUsedCount ?? 0;
    const totalCodes = mfa?.recoveryCodes?.length ?? 0;

    return {
      totp: mfa?.totpVerified ?? false,
      sms: mfa?.phoneVerified ?? false,
      email: true, // Always available
      recoveryCode: totalCodes - usedCount > 0,
    };
  }

  /**
   * Check if MFA is required for a user (based on user settings or tenant policy)
   */
  async isMfaRequired(userId: string): Promise<boolean> {
    const mfa = await this.getMfaConfig(userId);
    return mfa?.enabled ?? false;
  }

  /**
   * Check if tenant requires MFA
   */
  async isTenantMfaRequired(userId: string, tenantId: string): Promise<boolean> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const settings = tenant?.settings as { mfaRequired?: boolean } | null;
    return settings?.mfaRequired ?? false;
  }

  /**
   * Disable MFA for a user (requires re-authentication)
   */
  async disableMfa(userId: string): Promise<void> {
    await prisma.userMfa.update({
      where: { userId },
      data: {
        enabled: false,
        totpSecret: null,
        totpVerified: false,
        phoneNumber: null,
        phoneVerified: false,
        recoveryCodes: [],
        recoveryCodesGeneratedAt: null,
        recoveryCodesUsedCount: 0,
      },
    });
  }

  // ===========================================================================
  // PENDING SESSION MANAGEMENT
  // ===========================================================================

  /**
   * Create a pending session for MFA verification
   */
  async createPendingSession(
    userId: string,
    deviceInfo: { userAgent: string; ip: string }
  ): Promise<{ pendingSessionId: string; expiresAt: Date }> {
    const pendingSessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.config.mfa.challengeTtl);

    await this.cache.set(
      CacheKeys.pendingSession(pendingSessionId),
      { userId, deviceInfo, createdAt: new Date().toISOString() },
      { ttl: this.config.mfa.challengeTtl / 1000 }
    );

    return { pendingSessionId, expiresAt };
  }

  /**
   * Get pending session
   */
  async getPendingSession(
    pendingSessionId: string
  ): Promise<{ userId: string; deviceInfo: { userAgent: string; ip: string } } | null> {
    return this.cache.get(CacheKeys.pendingSession(pendingSessionId));
  }

  /**
   * Delete pending session
   */
  async deletePendingSession(pendingSessionId: string): Promise<void> {
    await this.cache.delete(CacheKeys.pendingSession(pendingSessionId));
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Get MFA configuration for a user
   */
  private async getMfaConfig(userId: string): Promise<UserMfa | null> {
    return prisma.userMfa.findUnique({
      where: { userId },
    });
  }

  /**
   * Check if a method is available
   */
  private isMethodAvailable(method: MfaMethod, available: AvailableMfaMethods): boolean {
    switch (method) {
      case MfaMethod.TOTP:
        return available.totp;
      case MfaMethod.SMS:
        return available.sms;
      case MfaMethod.EMAIL:
        return available.email;
      case MfaMethod.RECOVERY_CODE:
        return available.recoveryCode;
      default:
        return false;
    }
  }

  /**
   * Generate a numeric code
   */
  private generateNumericCode(length: number): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += crypto.randomInt(10).toString();
    }
    return code;
  }

  /**
   * Normalize phone number
   */
  private normalizePhoneNumber(phone: string): string {
    // Basic normalization - remove non-digit chars except leading +
    return phone.replace(/[^\d+]/g, '');
  }

  /**
   * Mask phone number for display
   */
  private maskPhoneNumber(phone: string): string {
    if (phone.length < 4) return '****';
    return '***' + phone.slice(-4);
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
// SINGLETON
// =============================================================================

let mfaServiceInstance: MfaService | null = null;

/**
 * Initialize MFA service
 */
export function initializeMfaService(redis: Redis, smsService?: SmsService): MfaService {
  mfaServiceInstance = new MfaService(redis, smsService);
  return mfaServiceInstance;
}

/**
 * Get MFA service instance
 */
export function getMfaService(): MfaService {
  if (!mfaServiceInstance) {
    throw new Error('MFA service not initialized. Call initializeMfaService first.');
  }
  return mfaServiceInstance;
}

/**
 * Reset MFA service (for testing)
 */
export function resetMfaService(): void {
  mfaServiceInstance = null;
}
