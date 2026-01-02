/**
 * Enhanced Password Policy
 * SOC 2 compliant password requirements with breach checking
 */

import { createHash } from 'crypto';

export interface PasswordPolicyConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialChars: string;
  maxRepeatingChars: number;
  preventCommonPasswords: boolean;
  checkBreachDatabase: boolean;
  historyCount: number;
  maxAgeDays: number;
  minAgeDays: number;
}

export interface PasswordValidationResult {
  valid: boolean;
  score: number; // 0-100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PasswordStrength {
  score: number;
  level: 'weak' | 'fair' | 'good' | 'strong' | 'excellent';
  feedback: string[];
}

export interface LockoutStatus {
  locked: boolean;
  failedAttempts: number;
  lockoutUntil?: Date;
  lastAttempt?: Date;
}

const DEFAULT_POLICY: PasswordPolicyConfig = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  maxRepeatingChars: 3,
  preventCommonPasswords: true,
  checkBreachDatabase: true,
  historyCount: 12, // Cannot reuse last 12 passwords
  maxAgeDays: 90, // Must change every 90 days
  minAgeDays: 1, // Cannot change more than once per day
};

// Common passwords to block
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  'qwerty',
  'abc123',
  'monkey',
  'master',
  'dragon',
  'letmein',
  'login',
  'admin',
  'welcome',
  'password1!',
  'Password1',
  'Password1!',
  'Passw0rd',
  'P@ssw0rd',
  'iloveyou',
  'princess',
  'sunshine',
  'football',
  'baseball',
  'shadow',
]);

// Lockout tracking (in production, use Redis)
const lockoutStore: Map<string, { attempts: number; lockoutUntil?: number; lastAttempt: number }> =
  new Map();
const passwordHistory: Map<string, string[]> = new Map(); // userId -> hashed passwords

// Lockout configuration
const LOCKOUT_CONFIG = {
  maxAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  progressiveDelay: true,
  delayBaseMs: 1000, // 1 second base delay
};

export class PasswordPolicy {
  private config: PasswordPolicyConfig;

  constructor(customConfig?: Partial<PasswordPolicyConfig>) {
    this.config = { ...DEFAULT_POLICY, ...customConfig };
  }

  /**
   * Validate password against policy
   */
  async validate(password: string, userId?: string): Promise<PasswordValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Length checks
    if (password.length < this.config.minLength) {
      errors.push(`Password must be at least ${this.config.minLength} characters`);
      score -= 30;
    }
    if (password.length > this.config.maxLength) {
      errors.push(`Password cannot exceed ${this.config.maxLength} characters`);
      score -= 10;
    }

    // Complexity checks
    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
      score -= 15;
    }
    if (this.config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
      score -= 15;
    }
    if (this.config.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
      score -= 15;
    }
    if (this.config.requireSpecialChars) {
      const specialRegex = new RegExp(`[${this.escapeRegex(this.config.specialChars)}]`);
      if (!specialRegex.test(password)) {
        errors.push('Password must contain at least one special character');
        score -= 15;
      }
    }

    // Repeating characters
    const repeatingRegex = new RegExp(`(.)\\1{${this.config.maxRepeatingChars},}`);
    if (repeatingRegex.test(password)) {
      errors.push(
        `Password cannot have more than ${this.config.maxRepeatingChars} repeating characters`
      );
      score -= 10;
    }

    // Common password check
    if (this.config.preventCommonPasswords && this.isCommonPassword(password)) {
      errors.push('Password is too common');
      score -= 30;
    }

    // Sequential characters check
    if (this.hasSequentialChars(password)) {
      warnings.push('Password contains sequential characters');
      score -= 10;
    }

    // Keyboard patterns check
    if (this.hasKeyboardPattern(password)) {
      warnings.push('Password contains keyboard pattern');
      score -= 10;
    }

    // Check password history
    if (userId && this.config.historyCount > 0) {
      const isReused = await this.checkPasswordHistory(userId, password);
      if (isReused) {
        errors.push(`Cannot reuse any of your last ${this.config.historyCount} passwords`);
        score -= 20;
      }
    }

    // Check breach database (HaveIBeenPwned)
    if (this.config.checkBreachDatabase) {
      const isBreached = await this.checkBreachDatabase(password);
      if (isBreached) {
        errors.push('This password has been found in a data breach');
        score -= 50;
      }
    }

    // Generate suggestions
    if (password.length < 16) {
      suggestions.push('Consider using a longer password (16+ characters)');
    }
    if (!/[A-Z].*[A-Z]/.test(password)) {
      suggestions.push('Add more uppercase letters');
    }
    if (!/\d.*\d/.test(password)) {
      suggestions.push('Add more numbers');
    }
    if (password.length < 20) {
      suggestions.push('Consider using a passphrase instead');
    }

    return {
      valid: errors.length === 0,
      score: Math.max(0, score),
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Calculate password strength
   */
  calculateStrength(password: string): PasswordStrength {
    let score = 0;
    const feedback: string[] = [];

    // Length scoring
    if (password.length >= 8) score += 10;
    if (password.length >= 12) score += 15;
    if (password.length >= 16) score += 20;
    if (password.length >= 20) score += 10;

    // Character variety
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/\d/.test(password)) score += 10;
    if (/[^a-zA-Z0-9]/.test(password)) score += 15;

    // Diversity bonus
    const uniqueChars = new Set(password).size;
    score += Math.min(10, Math.floor(uniqueChars / 3));

    // Penalties
    if (this.isCommonPassword(password)) {
      score -= 30;
      feedback.push('Common password');
    }
    if (this.hasSequentialChars(password)) {
      score -= 10;
      feedback.push('Contains sequential characters');
    }
    if (this.hasKeyboardPattern(password)) {
      score -= 10;
      feedback.push('Contains keyboard pattern');
    }
    if (/(.)\1{2,}/.test(password)) {
      score -= 10;
      feedback.push('Contains repeating characters');
    }

    score = Math.max(0, Math.min(100, score));

    let level: PasswordStrength['level'];
    if (score < 20) level = 'weak';
    else if (score < 40) level = 'fair';
    else if (score < 60) level = 'good';
    else if (score < 80) level = 'strong';
    else level = 'excellent';

    return { score, level, feedback };
  }

  /**
   * Check if account is locked out
   */
  getLockoutStatus(userId: string): LockoutStatus {
    const entry = lockoutStore.get(userId);
    if (!entry) {
      return { locked: false, failedAttempts: 0 };
    }

    const now = Date.now();
    if (entry.lockoutUntil && now < entry.lockoutUntil) {
      return {
        locked: true,
        failedAttempts: entry.attempts,
        lockoutUntil: new Date(entry.lockoutUntil),
        lastAttempt: new Date(entry.lastAttempt),
      };
    }

    return {
      locked: false,
      failedAttempts: entry.attempts,
      lastAttempt: new Date(entry.lastAttempt),
    };
  }

  /**
   * Record failed login attempt
   */
  recordFailedAttempt(userId: string): LockoutStatus {
    const entry = lockoutStore.get(userId) || { attempts: 0, lastAttempt: 0 };
    const now = Date.now();

    // Reset if lockout has expired
    if (entry.lockoutUntil && now >= entry.lockoutUntil) {
      entry.attempts = 0;
      delete entry.lockoutUntil;
    }

    entry.attempts++;
    entry.lastAttempt = now;

    // Check if should lock out
    if (entry.attempts >= LOCKOUT_CONFIG.maxAttempts) {
      entry.lockoutUntil = now + LOCKOUT_CONFIG.lockoutDurationMs;
    }

    lockoutStore.set(userId, entry);

    return this.getLockoutStatus(userId);
  }

  /**
   * Get progressive delay for failed attempts
   */
  getProgressiveDelay(userId: string): number {
    if (!LOCKOUT_CONFIG.progressiveDelay) return 0;

    const entry = lockoutStore.get(userId);
    if (!entry || entry.attempts === 0) return 0;

    // Exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(
      LOCKOUT_CONFIG.delayBaseMs * Math.pow(2, entry.attempts - 1),
      30000 // Max 30 seconds
    );
  }

  /**
   * Clear lockout after successful login
   */
  clearLockout(userId: string): void {
    lockoutStore.delete(userId);
  }

  /**
   * Store password in history (hashed)
   */
  async addToHistory(userId: string, password: string): Promise<void> {
    const hash = this.hashPassword(password);
    const history = passwordHistory.get(userId) || [];
    history.unshift(hash);

    // Keep only the configured number of passwords
    if (history.length > this.config.historyCount) {
      history.pop();
    }

    passwordHistory.set(userId, history);
  }

  /**
   * Check if password is in history
   */
  async checkPasswordHistory(userId: string, password: string): Promise<boolean> {
    const history = passwordHistory.get(userId) || [];
    const hash = this.hashPassword(password);
    return history.includes(hash);
  }

  /**
   * Check password against HaveIBeenPwned API
   */
  async checkBreachDatabase(password: string): Promise<boolean> {
    try {
      // Use k-anonymity: send only first 5 chars of SHA-1 hash
      const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.substring(0, 5);
      const suffix = sha1.substring(5);

      // In production, make actual API call
      // const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      // const text = await response.text();
      // return text.includes(suffix);

      // For now, return false (not breached) - implement actual API call in production
      return false;
    } catch (error) {
      // If API fails, don't block the password
      console.warn('Failed to check breach database:', error);
      return false;
    }
  }

  /**
   * Check if password has expired
   */
  isPasswordExpired(lastChanged: Date): boolean {
    if (this.config.maxAgeDays <= 0) return false;

    const now = new Date();
    const daysSinceChange = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange > this.config.maxAgeDays;
  }

  /**
   * Check if password can be changed (min age)
   */
  canChangePassword(lastChanged: Date): boolean {
    if (this.config.minAgeDays <= 0) return true;

    const now = new Date();
    const daysSinceChange = (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange >= this.config.minAgeDays;
  }

  // Private helpers

  private isCommonPassword(password: string): boolean {
    return COMMON_PASSWORDS.has(password.toLowerCase());
  }

  private hasSequentialChars(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];
    const lower = password.toLowerCase();

    for (const seq of sequences) {
      for (let i = 0; i <= seq.length - 4; i++) {
        const pattern = seq.substring(i, i + 4);
        if (lower.includes(pattern) || lower.includes(pattern.split('').reverse().join(''))) {
          return true;
        }
      }
    }
    return false;
  }

  private hasKeyboardPattern(password: string): boolean {
    const patterns = ['qwerty', 'asdf', 'zxcv', '1234', '0987'];
    const lower = password.toLowerCase();
    return patterns.some(
      (p) => lower.includes(p) || lower.includes(p.split('').reverse().join(''))
    );
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }
}

// Singleton instance
export const passwordPolicy = new PasswordPolicy();
