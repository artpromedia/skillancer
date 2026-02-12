// @ts-nocheck
/**
 * Financial Security Service
 * Encryption, fraud detection, and security controls
 * Sprint M5: Freelancer Financial Services
 */

import crypto from 'crypto';

import { prisma } from '@skillancer/database';
import { logger } from '../lib/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface FraudSignal {
  type: FraudSignalType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  description: string;
  data?: Record<string, any>;
}

export type FraudSignalType =
  | 'velocity_check' // Too many transactions in short time
  | 'amount_anomaly' // Unusual transaction amount
  | 'location_anomaly' // Transaction from unexpected location
  | 'device_change' // Transaction from new device
  | 'time_anomaly' // Transaction at unusual time
  | 'merchant_risk' // High-risk merchant
  | 'pattern_match' // Known fraud pattern
  | 'account_takeover'; // Signs of account compromise

export interface FraudCheckResult {
  allowed: boolean;
  riskScore: number;
  signals: FraudSignal[];
  action: 'allow' | 'review' | 'block' | 'challenge';
  challengeType?: 'sms' | 'email' | 'push' | 'security_question';
}

export interface SecurityEvent {
  id: string;
  userId: string;
  type: SecurityEventType;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  ipAddress?: string;
  userAgent?: string;
  resolved: boolean;
  createdAt: Date;
}

export type SecurityEventType =
  | 'failed_auth'
  | 'card_details_viewed'
  | 'suspicious_login'
  | 'fraud_detected'
  | 'account_locked'
  | 'password_changed'
  | 'mfa_disabled'
  | 'account_takeover';

// ============================================================================
// ENCRYPTION CONFIG
// ============================================================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.FINANCIAL_ENCRYPTION_KEY!;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ============================================================================
// FRAUD THRESHOLDS
// ============================================================================

const FRAUD_THRESHOLDS = {
  velocityWindow: 60 * 1000, // 1 minute
  maxTransactionsPerMinute: 5,
  maxDailyTransactions: 50,
  amountDeviationThreshold: 3, // Standard deviations
  maxSingleTransaction: 5000,
  highRiskCategories: ['7995', '5816', '5966'], // Gambling, digital goods, direct marketing
  suspiciousTimeRange: { start: 0, end: 5 }, // Midnight to 5 AM
};

// ============================================================================
// SECURITY SERVICE
// ============================================================================

export class SecurityService {
  // ==========================================================================
  // ENCRYPTION
  // ==========================================================================

  /**
   * Encrypt sensitive data
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash sensitive data (one-way)
   */
  hash(data: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512').toString('hex');
    return `${actualSalt}:${hash}`;
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hashedData: string): boolean {
    const [salt, originalHash] = hashedData.split(':');
    const newHash = crypto.pbkdf2Sync(data, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(originalHash), Buffer.from(newHash));
  }

  /**
   * Generate secure token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // ==========================================================================
  // FRAUD DETECTION
  // ==========================================================================

  /**
   * Check transaction for fraud signals
   */
  async checkFraud(
    userId: string,
    transaction: {
      amount: number;
      merchantName: string;
      merchantCategoryCode: string;
      merchantCountry: string;
      cardId: string;
    },
    context: {
      ipAddress?: string;
      userAgent?: string;
      deviceId?: string;
    }
  ): Promise<FraudCheckResult> {
    const signals: FraudSignal[] = [];
    let totalScore = 0;

    // 1. Velocity check
    const velocitySignal = await this.checkVelocity(userId, transaction.cardId);
    if (velocitySignal) {
      signals.push(velocitySignal);
      totalScore += velocitySignal.score;
    }

    // 2. Amount anomaly
    const amountSignal = await this.checkAmountAnomaly(userId, transaction.amount);
    if (amountSignal) {
      signals.push(amountSignal);
      totalScore += amountSignal.score;
    }

    // 3. High-risk merchant
    const merchantSignal = this.checkMerchantRisk(transaction.merchantCategoryCode);
    if (merchantSignal) {
      signals.push(merchantSignal);
      totalScore += merchantSignal.score;
    }

    // 4. Time anomaly
    const timeSignal = this.checkTimeAnomaly();
    if (timeSignal) {
      signals.push(timeSignal);
      totalScore += timeSignal.score;
    }

    // 5. Location anomaly
    const locationSignal = await this.checkLocationAnomaly(userId, transaction.merchantCountry);
    if (locationSignal) {
      signals.push(locationSignal);
      totalScore += locationSignal.score;
    }

    // 6. Device change
    if (context.deviceId) {
      const deviceSignal = await this.checkDeviceChange(userId, context.deviceId);
      if (deviceSignal) {
        signals.push(deviceSignal);
        totalScore += deviceSignal.score;
      }
    }

    // Calculate normalized risk score (0-100)
    const riskScore = Math.min(100, totalScore);

    // Determine action
    let action: FraudCheckResult['action'];
    let allowed: boolean;
    let challengeType: FraudCheckResult['challengeType'];

    if (riskScore >= 80) {
      action = 'block';
      allowed = false;
    } else if (riskScore >= 60) {
      action = 'challenge';
      allowed = false;
      challengeType = 'push';
    } else if (riskScore >= 40) {
      action = 'review';
      allowed = true; // Allow but flag for review
    } else {
      action = 'allow';
      allowed = true;
    }

    // Log if high risk
    if (riskScore >= 40) {
      await this.logSecurityEvent(userId, 'fraud_detected', {
        riskScore,
        signals: signals.map((s) => s.type),
        action,
        transaction,
      });
    }

    return {
      allowed,
      riskScore,
      signals,
      action,
      challengeType,
    };
  }

  private async checkVelocity(userId: string, cardId: string): Promise<FraudSignal | null> {
    const recentCount = await prisma.cardTransaction.count({
      where: {
        userId,
        cardId,
        createdAt: { gte: new Date(Date.now() - FRAUD_THRESHOLDS.velocityWindow) },
      },
    });

    if (recentCount >= FRAUD_THRESHOLDS.maxTransactionsPerMinute) {
      return {
        type: 'velocity_check',
        severity: 'high',
        score: 40,
        description: `${recentCount} transactions in last minute`,
        data: { count: recentCount },
      };
    }

    return null;
  }

  private async checkAmountAnomaly(userId: string, amount: number): Promise<FraudSignal | null> {
    // Get user's average transaction amount
    const stats = await prisma.cardTransaction.aggregate({
      where: { userId, status: 'captured' },
      _avg: { amount: true },
      _stddev: { amount: true },
    });

    const avg = stats._avg.amount || 100;
    const stddev = stats._stddev?.amount || 50;

    const deviations = Math.abs(amount - avg) / (stddev || 1);

    if (deviations > FRAUD_THRESHOLDS.amountDeviationThreshold) {
      return {
        type: 'amount_anomaly',
        severity: 'medium',
        score: 25,
        description: `Amount ${deviations.toFixed(1)} standard deviations from average`,
        data: { amount, average: avg, deviations },
      };
    }

    if (amount > FRAUD_THRESHOLDS.maxSingleTransaction * 100) {
      return {
        type: 'amount_anomaly',
        severity: 'high',
        score: 35,
        description: `Large transaction: $${(amount / 100).toLocaleString()}`,
        data: { amount },
      };
    }

    return null;
  }

  private checkMerchantRisk(categoryCode: string): FraudSignal | null {
    if (FRAUD_THRESHOLDS.highRiskCategories.includes(categoryCode)) {
      return {
        type: 'merchant_risk',
        severity: 'medium',
        score: 20,
        description: 'High-risk merchant category',
        data: { categoryCode },
      };
    }
    return null;
  }

  private checkTimeAnomaly(): FraudSignal | null {
    const hour = new Date().getHours();
    const { start, end } = FRAUD_THRESHOLDS.suspiciousTimeRange;

    if (hour >= start && hour < end) {
      return {
        type: 'time_anomaly',
        severity: 'low',
        score: 10,
        description: `Transaction at unusual time (${hour}:00)`,
        data: { hour },
      };
    }
    return null;
  }

  private async checkLocationAnomaly(userId: string, country: string): Promise<FraudSignal | null> {
    // Get user's usual countries
    const recentCountries = await prisma.cardTransaction.findMany({
      where: { userId, status: 'captured' },
      select: { merchantCountry: true },
      distinct: ['merchantCountry'],
      take: 10,
    });

    const usualCountries = recentCountries.map((c) => c.merchantCountry);

    if (usualCountries.length > 0 && !usualCountries.includes(country)) {
      return {
        type: 'location_anomaly',
        severity: 'medium',
        score: 25,
        description: `First transaction in ${country}`,
        data: { country, usualCountries },
      };
    }
    return null;
  }

  private async checkDeviceChange(userId: string, deviceId: string): Promise<FraudSignal | null> {
    // Check if this is a new device
    const knownDevice = await prisma.userDevice.findFirst({
      where: { userId, deviceId, trusted: true },
    });

    if (!knownDevice) {
      return {
        type: 'device_change',
        severity: 'medium',
        score: 20,
        description: 'Transaction from unknown device',
        data: { deviceId },
      };
    }
    return null;
  }

  // ==========================================================================
  // SECURITY EVENTS
  // ==========================================================================

  /**
   * Log security event
   */
  async logSecurityEvent(
    userId: string,
    type: SecurityEventType,
    data: {
      description?: string;
      ipAddress?: string;
      userAgent?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    const severity = this.getEventSeverity(type);

    await prisma.securityEvent.create({
      data: {
        userId,
        type,
        severity,
        description: data.description || this.getDefaultDescription(type),
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
        resolved: false,
      },
    });

    // Alert on critical events
    if (severity === 'critical') {
      logger.error('Critical security event', { userId, type, data });
      // TODO: Send immediate alert to security team
    }
  }

  private getEventSeverity(type: SecurityEventType): 'info' | 'warning' | 'critical' {
    switch (type) {
      case 'card_details_viewed':
      case 'password_changed':
        return 'info';
      case 'failed_auth':
      case 'suspicious_login':
      case 'mfa_disabled':
        return 'warning';
      case 'fraud_detected':
      case 'account_locked':
      case 'account_takeover':
        return 'critical';
      default:
        return 'info';
    }
  }

  private getDefaultDescription(type: SecurityEventType): string {
    const descriptions: Record<SecurityEventType, string> = {
      failed_auth: 'Failed authentication attempt',
      card_details_viewed: 'Card details were accessed',
      suspicious_login: 'Suspicious login detected',
      fraud_detected: 'Potential fraud detected',
      account_locked: 'Account was locked',
      password_changed: 'Password was changed',
      mfa_disabled: 'Multi-factor authentication was disabled',
    };
    return descriptions[type] || 'Security event occurred';
  }

  /**
   * Get security events for user
   */
  async getSecurityEvents(
    userId: string,
    options: { limit?: number; unresolved?: boolean } = {}
  ): Promise<SecurityEvent[]> {
    const events = await prisma.securityEvent.findMany({
      where: {
        userId,
        ...(options.unresolved ? { resolved: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 50,
    });

    return events.map((e) => ({
      id: e.id,
      userId: e.userId,
      type: e.type as SecurityEventType,
      severity: e.severity as 'info' | 'warning' | 'critical',
      description: e.description,
      ipAddress: e.ipAddress || undefined,
      userAgent: e.userAgent || undefined,
      resolved: e.resolved,
      createdAt: e.createdAt,
    }));
  }

  /**
   * Resolve security event
   */
  async resolveSecurityEvent(eventId: string, resolution: string): Promise<void> {
    await prisma.securityEvent.update({
      where: { id: eventId },
      data: {
        resolved: true,
        resolution,
        resolvedAt: new Date(),
      },
    });
  }

  // ==========================================================================
  // ACCOUNT SECURITY
  // ==========================================================================

  /**
   * Lock financial account due to security concerns
   */
  async lockAccount(userId: string, reason: string): Promise<void> {
    // Freeze all cards
    await prisma.issuedCard.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'frozen' },
    });

    // Disable instant payouts
    await prisma.treasuryAccount.updateMany({
      where: { userId },
      data: { features: { instantPayouts: false } },
    });

    // Log event
    await this.logSecurityEvent(userId, 'account_locked', {
      description: reason,
    });

    logger.warn('Financial account locked', { userId, reason });
  }

  /**
   * Unlock financial account
   */
  async unlockAccount(userId: string, approvedBy: string): Promise<void> {
    // Unfreeze cards that were frozen
    await prisma.issuedCard.updateMany({
      where: { userId, status: 'frozen' },
      data: { status: 'active' },
    });

    // Re-enable features based on KYC level
    // TODO: Check KYC level and set appropriate features

    logger.info('Financial account unlocked', { userId, approvedBy });
  }

  /**
   * Check if user requires re-authentication for sensitive action
   */
  async requiresReauth(userId: string, action: string): Promise<boolean> {
    // Check last authentication time
    const session = await prisma.userSession.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) return true;

    const sensitiveActions = ['card_details_view', 'large_payout', 'settings_change'];
    const reauthWindow = 5 * 60 * 1000; // 5 minutes

    if (sensitiveActions.includes(action)) {
      const lastAuth = session.lastAuthenticatedAt || session.createdAt;
      return Date.now() - lastAuth.getTime() > reauthWindow;
    }

    return false;
  }

  /**
   * Generate one-time security code
   */
  async generateSecurityCode(userId: string, purpose: string): Promise<string> {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.securityCode.create({
      data: {
        userId,
        code: this.hash(code),
        purpose,
        expiresAt,
        used: false,
      },
    });

    return code;
  }

  /**
   * Verify security code
   */
  async verifySecurityCode(userId: string, code: string, purpose: string): Promise<boolean> {
    const storedCodes = await prisma.securityCode.findMany({
      where: {
        userId,
        purpose,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    for (const stored of storedCodes) {
      if (this.verifyHash(code, stored.code)) {
        await prisma.securityCode.update({
          where: { id: stored.id },
          data: { used: true },
        });
        return true;
      }
    }

    return false;
  }
}

// Singleton instance
let securityServiceInstance: SecurityService | null = null;

export function getSecurityService(): SecurityService {
  if (!securityServiceInstance) {
    securityServiceInstance = new SecurityService();
  }
  return securityServiceInstance;
}
