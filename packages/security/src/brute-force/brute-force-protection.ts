/**
 * Brute Force Protection Service
 *
 * Provides advanced brute force attack mitigation including:
 * - Progressive lockout with exponential backoff
 * - Account lockout after multiple failures
 * - IP-based and account-based tracking
 * - Distributed rate limiting via Redis
 * - CAPTCHA triggering
 * - User notification on suspicious activity
 */

import type { Redis } from 'ioredis';

// ==================== Types ====================

export interface BruteForceConfig {
  /** Max failed attempts before soft lockout */
  softLockoutThreshold: number;
  /** Max failed attempts before hard lockout */
  hardLockoutThreshold: number;
  /** Max failed attempts before permanent lock (requires admin unlock) */
  permanentLockThreshold: number;
  /** Initial lockout duration in seconds */
  initialLockoutDuration: number;
  /** Maximum lockout duration in seconds */
  maxLockoutDuration: number;
  /** Lockout multiplier for exponential backoff */
  lockoutMultiplier: number;
  /** Window in seconds for counting attempts */
  attemptWindow: number;
  /** Threshold for requiring CAPTCHA */
  captchaThreshold: number;
  /** Whether to notify user on suspicious activity */
  notifyOnSuspicious: boolean;
}

export interface LoginAttemptResult {
  allowed: boolean;
  reason?: 'locked' | 'rate_limited' | 'permanent_lock';
  lockoutRemaining?: number;
  requiresCaptcha: boolean;
  attemptCount: number;
  lockoutLevel: 'none' | 'soft' | 'hard' | 'permanent';
  unlockTime?: Date;
}

export interface LockoutInfo {
  identifier: string;
  type: 'email' | 'ip' | 'user_id';
  attemptCount: number;
  lockoutLevel: 'none' | 'soft' | 'hard' | 'permanent';
  lockoutStart?: Date;
  lockoutEnd?: Date;
  lastAttempt: Date;
  ipAddresses: string[];
}

export interface NotificationCallback {
  (
    userId: string,
    email: string,
    event: 'suspicious_activity' | 'account_locked' | 'login_from_new_device',
    details: Record<string, unknown>
  ): Promise<void>;
}

// ==================== Default Config ====================

const DEFAULT_CONFIG: BruteForceConfig = {
  softLockoutThreshold: 5,
  hardLockoutThreshold: 10,
  permanentLockThreshold: 20,
  initialLockoutDuration: 60, // 1 minute
  maxLockoutDuration: 3600, // 1 hour
  lockoutMultiplier: 2,
  attemptWindow: 900, // 15 minutes
  captchaThreshold: 3,
  notifyOnSuspicious: true,
};

// ==================== Brute Force Protection Service ====================

export class BruteForceProtection {
  private readonly redis: Redis;
  private readonly config: BruteForceConfig;
  private readonly keyPrefix = 'bruteforce:';
  private notificationCallback?: NotificationCallback;

  constructor(redis: Redis, config: Partial<BruteForceConfig> = {}) {
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set notification callback for alerting users
   */
  setNotificationCallback(callback: NotificationCallback): void {
    this.notificationCallback = callback;
  }

  /**
   * Check if login attempt is allowed
   */
  async checkAttempt(
    identifier: string,
    type: 'email' | 'ip' | 'user_id' = 'email'
  ): Promise<LoginAttemptResult> {
    const key = this.getKey(identifier, type);

    // Check permanent lock first
    const permanentLock = await this.redis.get(`${key}:permanent`);
    if (permanentLock) {
      return {
        allowed: false,
        reason: 'permanent_lock',
        requiresCaptcha: false,
        attemptCount: this.config.permanentLockThreshold,
        lockoutLevel: 'permanent',
      };
    }

    // Check current lockout
    const lockoutKey = `${key}:lockout`;
    const lockoutTTL = await this.redis.ttl(lockoutKey);
    const lockoutData = await this.redis.get(lockoutKey);

    if (lockoutTTL > 0 && lockoutData) {
      const { level, endTime } = JSON.parse(lockoutData);
      return {
        allowed: false,
        reason: 'locked',
        lockoutRemaining: lockoutTTL,
        requiresCaptcha: false,
        attemptCount: await this.getAttemptCount(key),
        lockoutLevel: level,
        unlockTime: new Date(endTime),
      };
    }

    // Get current attempt count
    const attemptCount = await this.getAttemptCount(key);

    return {
      allowed: true,
      requiresCaptcha: attemptCount >= this.config.captchaThreshold,
      attemptCount,
      lockoutLevel: this.getLockoutLevel(attemptCount),
    };
  }

  /**
   * Record a failed login attempt
   */
  async recordFailedAttempt(
    identifier: string,
    type: 'email' | 'ip' | 'user_id' = 'email',
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      userId?: string;
      email?: string;
    }
  ): Promise<LoginAttemptResult> {
    const key = this.getKey(identifier, type);

    // Increment attempt counter
    const attemptCount = await this.redis.incr(`${key}:attempts`);
    if (attemptCount === 1) {
      await this.redis.expire(`${key}:attempts`, this.config.attemptWindow);
    }

    // Track IP addresses used
    if (metadata?.ipAddress) {
      await this.redis.sadd(`${key}:ips`, metadata.ipAddress);
      await this.redis.expire(`${key}:ips`, this.config.attemptWindow * 2);
    }

    // Store last attempt timestamp
    await this.redis.set(`${key}:last`, Date.now().toString());

    // Check thresholds and apply lockout
    const lockoutLevel = this.getLockoutLevel(attemptCount);

    if (lockoutLevel === 'permanent') {
      // Set permanent lock
      await this.redis.set(`${key}:permanent`, JSON.stringify({
        lockedAt: new Date().toISOString(),
        attemptCount,
        reason: 'exceeded_permanent_threshold',
      }));

      // Notify user
      if (this.config.notifyOnSuspicious && metadata?.userId && metadata?.email) {
        await this.notifyUser(metadata.userId, metadata.email, 'account_locked', {
          reason: 'Too many failed login attempts',
          ipAddresses: await this.redis.smembers(`${key}:ips`),
        });
      }

      return {
        allowed: false,
        reason: 'permanent_lock',
        requiresCaptcha: false,
        attemptCount,
        lockoutLevel: 'permanent',
      };
    }

    if (lockoutLevel !== 'none') {
      // Calculate lockout duration with exponential backoff
      const lockoutDuration = this.calculateLockoutDuration(attemptCount);
      const endTime = Date.now() + lockoutDuration * 1000;

      await this.redis.setex(
        `${key}:lockout`,
        lockoutDuration,
        JSON.stringify({ level: lockoutLevel, endTime })
      );

      // Notify on first hard lockout
      if (
        lockoutLevel === 'hard' &&
        attemptCount === this.config.hardLockoutThreshold &&
        this.config.notifyOnSuspicious &&
        metadata?.userId &&
        metadata?.email
      ) {
        await this.notifyUser(metadata.userId, metadata.email, 'suspicious_activity', {
          type: 'multiple_failed_logins',
          attemptCount,
          ipAddresses: await this.redis.smembers(`${key}:ips`),
        });
      }

      return {
        allowed: false,
        reason: 'locked',
        lockoutRemaining: lockoutDuration,
        requiresCaptcha: false,
        attemptCount,
        lockoutLevel,
        unlockTime: new Date(endTime),
      };
    }

    return {
      allowed: true,
      requiresCaptcha: attemptCount >= this.config.captchaThreshold,
      attemptCount,
      lockoutLevel,
    };
  }

  /**
   * Record a successful login (clears failed attempts)
   */
  async recordSuccessfulLogin(
    identifier: string,
    type: 'email' | 'ip' | 'user_id' = 'email'
  ): Promise<void> {
    const key = this.getKey(identifier, type);

    // Clear all brute force tracking
    await this.redis.del(
      `${key}:attempts`,
      `${key}:lockout`,
      `${key}:ips`,
      `${key}:last`
    );
  }

  /**
   * Manually unlock an account
   */
  async unlockAccount(
    identifier: string,
    type: 'email' | 'ip' | 'user_id' = 'email',
    adminId?: string
  ): Promise<void> {
    const key = this.getKey(identifier, type);

    await this.redis.del(
      `${key}:attempts`,
      `${key}:lockout`,
      `${key}:permanent`,
      `${key}:ips`,
      `${key}:last`
    );

    // Log admin action
    if (adminId) {
      await this.redis.lpush(
        'bruteforce:admin_actions',
        JSON.stringify({
          action: 'unlock',
          identifier,
          type,
          adminId,
          timestamp: new Date().toISOString(),
        })
      );
      await this.redis.ltrim('bruteforce:admin_actions', 0, 999);
    }
  }

  /**
   * Get lockout information for an identifier
   */
  async getLockoutInfo(
    identifier: string,
    type: 'email' | 'ip' | 'user_id' = 'email'
  ): Promise<LockoutInfo> {
    const key = this.getKey(identifier, type);

    const [attemptCount, lockoutData, permanentLock, ipAddresses, lastAttempt] = await Promise.all([
      this.getAttemptCount(key),
      this.redis.get(`${key}:lockout`),
      this.redis.get(`${key}:permanent`),
      this.redis.smembers(`${key}:ips`),
      this.redis.get(`${key}:last`),
    ]);

    let lockoutLevel: LockoutInfo['lockoutLevel'] = 'none';
    let lockoutStart: Date | undefined;
    let lockoutEnd: Date | undefined;

    if (permanentLock) {
      const { lockedAt } = JSON.parse(permanentLock);
      lockoutLevel = 'permanent';
      lockoutStart = new Date(lockedAt);
    } else if (lockoutData) {
      const { level, endTime } = JSON.parse(lockoutData);
      lockoutLevel = level;
      lockoutEnd = new Date(endTime);
    }

    return {
      identifier,
      type,
      attemptCount,
      lockoutLevel,
      lockoutStart,
      lockoutEnd,
      lastAttempt: lastAttempt ? new Date(parseInt(lastAttempt)) : new Date(),
      ipAddresses,
    };
  }

  /**
   * Get all currently locked identifiers
   */
  async getLockedIdentifiers(): Promise<LockoutInfo[]> {
    const lockoutKeys = await this.redis.keys(`${this.keyPrefix}*:lockout`);
    const permanentKeys = await this.redis.keys(`${this.keyPrefix}*:permanent`);

    const allKeys = [...new Set([...lockoutKeys, ...permanentKeys])];
    const results: LockoutInfo[] = [];

    for (const key of allKeys) {
      // Parse identifier and type from key
      const match = key.match(/bruteforce:(\w+):([^:]+)/);
      if (match) {
        const type = match[1] as 'email' | 'ip' | 'user_id';
        const identifier = match[2];
        results.push(await this.getLockoutInfo(identifier, type));
      }
    }

    return results;
  }

  /**
   * Check if CAPTCHA is required for an identifier
   */
  async requiresCaptcha(
    identifier: string,
    type: 'email' | 'ip' | 'user_id' = 'email'
  ): Promise<boolean> {
    const key = this.getKey(identifier, type);
    const attemptCount = await this.getAttemptCount(key);
    return attemptCount >= this.config.captchaThreshold;
  }

  /**
   * Record CAPTCHA verification
   */
  async recordCaptchaVerification(
    identifier: string,
    type: 'email' | 'ip' | 'user_id' = 'email',
    success: boolean
  ): Promise<void> {
    const key = this.getKey(identifier, type);

    if (success) {
      // Reduce attempt count on successful CAPTCHA
      await this.redis.decr(`${key}:attempts`);
      const newCount = await this.getAttemptCount(key);
      if (newCount <= 0) {
        await this.redis.del(`${key}:attempts`);
      }
    } else {
      // Failed CAPTCHA counts as additional failed attempt
      await this.recordFailedAttempt(identifier, type);
    }
  }

  /**
   * Get brute force statistics
   */
  async getStats(): Promise<{
    totalLocked: number;
    softLocked: number;
    hardLocked: number;
    permanentLocked: number;
    activeChallenges: number;
  }> {
    const [lockoutKeys, permanentKeys, attemptKeys] = await Promise.all([
      this.redis.keys(`${this.keyPrefix}*:lockout`),
      this.redis.keys(`${this.keyPrefix}*:permanent`),
      this.redis.keys(`${this.keyPrefix}*:attempts`),
    ]);

    let softLocked = 0;
    let hardLocked = 0;

    for (const key of lockoutKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const { level } = JSON.parse(data);
        if (level === 'soft') softLocked++;
        if (level === 'hard') hardLocked++;
      }
    }

    // Count active challenges (accounts requiring CAPTCHA)
    let activeChallenges = 0;
    for (const key of attemptKeys) {
      const count = await this.redis.get(key);
      if (count && parseInt(count) >= this.config.captchaThreshold) {
        activeChallenges++;
      }
    }

    return {
      totalLocked: lockoutKeys.length + permanentKeys.length,
      softLocked,
      hardLocked,
      permanentLocked: permanentKeys.length,
      activeChallenges,
    };
  }

  // ==================== Private Helpers ====================

  private getKey(identifier: string, type: string): string {
    return `${this.keyPrefix}${type}:${identifier.toLowerCase()}`;
  }

  private async getAttemptCount(key: string): Promise<number> {
    const count = await this.redis.get(`${key}:attempts`);
    return count ? parseInt(count) : 0;
  }

  private getLockoutLevel(attemptCount: number): 'none' | 'soft' | 'hard' | 'permanent' {
    if (attemptCount >= this.config.permanentLockThreshold) return 'permanent';
    if (attemptCount >= this.config.hardLockoutThreshold) return 'hard';
    if (attemptCount >= this.config.softLockoutThreshold) return 'soft';
    return 'none';
  }

  private calculateLockoutDuration(attemptCount: number): number {
    // Exponential backoff based on attempt count
    const exponent = Math.max(0, attemptCount - this.config.softLockoutThreshold);
    const duration = this.config.initialLockoutDuration * Math.pow(this.config.lockoutMultiplier, exponent);
    return Math.min(duration, this.config.maxLockoutDuration);
  }

  private async notifyUser(
    userId: string,
    email: string,
    event: 'suspicious_activity' | 'account_locked' | 'login_from_new_device',
    details: Record<string, unknown>
  ): Promise<void> {
    if (this.notificationCallback) {
      try {
        await this.notificationCallback(userId, email, event, details);
      } catch (error) {
        console.error('Failed to send brute force notification:', error);
      }
    }
  }
}

// ==================== Factory Function ====================

let bruteForceInstance: BruteForceProtection | null = null;

/**
 * Initialize brute force protection
 */
export function initializeBruteForceProtection(
  redis: Redis,
  config?: Partial<BruteForceConfig>
): BruteForceProtection {
  bruteForceInstance = new BruteForceProtection(redis, config);
  return bruteForceInstance;
}

/**
 * Get brute force protection instance
 */
export function getBruteForceProtection(): BruteForceProtection | null {
  return bruteForceInstance;
}

/**
 * Reset brute force protection (for testing)
 */
export function resetBruteForceProtection(): void {
  bruteForceInstance = null;
}

export default BruteForceProtection;
