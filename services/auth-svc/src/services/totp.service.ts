/**
 * @module @skillancer/auth-svc/services/totp
 * TOTP (Time-based One-Time Password) service for MFA
 */

import crypto from 'crypto';

import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

import { getConfig } from '../config/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface TotpSetupResult {
  /** Base32 encoded secret (raw, before encryption) */
  secret: string;
  /** OTPAuth URL for authenticator apps */
  otpauthUrl: string;
  /** QR code as data URL */
  qrCodeDataUrl: string;
  /** Manual entry key (formatted for easy reading) */
  manualEntryKey: string;
}

export interface TotpVerifyResult {
  valid: boolean;
  delta?: number;
}

// =============================================================================
// ENCRYPTION HELPERS
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get encryption key from config (must be 32 bytes for AES-256)
 */
function getEncryptionKey(): Buffer {
  const config = getConfig();
  const secret = config.mfa?.encryptionKey ?? config.jwt.secret;

  // Derive a consistent 32-byte key from the secret
  return crypto.scryptSync(secret, 'skillancer-totp-encryption', 32);
}

/**
 * Encrypt a string value
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (all hex encoded)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encryptedValue: string): string {
  const key = getEncryptionKey();

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted value format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// =============================================================================
// TOTP SERVICE
// =============================================================================

/**
 * TOTP Service for generating and verifying time-based one-time passwords
 *
 * Uses otplib which implements RFC 6238 (TOTP) and RFC 4226 (HOTP)
 *
 * @example
 * ```typescript
 * const totpService = new TotpService();
 *
 * // Generate setup data for new MFA enrollment
 * const setup = await totpService.generateSetup('user@example.com', 'user-123');
 *
 * // Verify code entered by user
 * const isValid = totpService.verifyCode(setup.secret, '123456');
 * ```
 */
export class TotpService {
  private readonly issuer: string;
  private readonly window: number;

  constructor() {
    const config = getConfig();
    this.issuer = config.mfa?.issuer ?? 'Skillancer';
    this.window = config.mfa?.totpWindow ?? 1; // Allow 1 step before/after (30 seconds each)

    // Configure otplib
    authenticator.options = {
      window: this.window,
      step: 30, // 30 second intervals (standard)
      digits: 6, // 6-digit codes (standard)
    };
  }

  // ===========================================================================
  // SETUP
  // ===========================================================================

  /**
   * Generate TOTP setup data for a new MFA enrollment
   *
   * @param userEmail - User's email for the authenticator label
   * @param userId - User ID for additional entropy
   * @returns Setup data including secret, QR code, and manual entry key
   */
  async generateSetup(userEmail: string, _userId: string): Promise<TotpSetupResult> {
    // Generate a new random secret
    const secret = authenticator.generateSecret(20); // 160 bits

    // Create OTPAuth URL
    const otpauthUrl = authenticator.keyuri(userEmail, this.issuer, secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 256,
      margin: 2,
    });

    // Format secret for manual entry (groups of 4 characters)
    const manualEntryKey = this.formatSecretForDisplay(secret);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
      manualEntryKey,
    };
  }

  /**
   * Format secret for easier manual entry
   */
  private formatSecretForDisplay(secret: string): string {
    // Split into groups of 4 characters
    return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
  }

  // ===========================================================================
  // VERIFICATION
  // ===========================================================================

  /**
   * Verify a TOTP code
   *
   * @param secret - The user's TOTP secret (raw, not encrypted)
   * @param code - The 6-digit code to verify
   * @returns True if the code is valid
   */
  verifyCode(secret: string, code: string): boolean {
    try {
      // Normalize code (remove spaces, ensure 6 digits)
      const normalizedCode = code.replace(/\s/g, '').padStart(6, '0');

      return authenticator.verify({
        token: normalizedCode,
        secret,
      });
    } catch {
      return false;
    }
  }

  /**
   * Verify a TOTP code with extended time window and return delta
   *
   * @param secret - The user's TOTP secret
   * @param code - The 6-digit code to verify
   * @param window - Optional custom window size
   * @returns Verification result with delta (which time step the code matched)
   */
  verifyCodeWithWindow(secret: string, code: string, window?: number): TotpVerifyResult {
    try {
      const normalizedCode = code.replace(/\s/g, '').padStart(6, '0');
      const effectiveWindow = window ?? this.window;

      // Check current and adjacent time steps
      const delta = authenticator.checkDelta(normalizedCode, secret);

      if (delta === null) {
        return { valid: false };
      }

      // Check if delta is within our window
      if (Math.abs(delta) <= effectiveWindow) {
        return { valid: true, delta };
      }

      return { valid: false };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Generate a current TOTP code (for testing purposes only)
   *
   * @param secret - The TOTP secret
   * @returns The current 6-digit code
   */
  generateCurrentCode(secret: string): string {
    return authenticator.generate(secret);
  }

  // ===========================================================================
  // ENCRYPTION
  // ===========================================================================

  /**
   * Encrypt a TOTP secret for storage
   *
   * @param secret - The raw TOTP secret
   * @returns Encrypted secret string
   */
  encryptSecret(secret: string): string {
    return encrypt(secret);
  }

  /**
   * Decrypt a stored TOTP secret
   *
   * @param encryptedSecret - The encrypted TOTP secret
   * @returns Decrypted raw secret
   */
  decryptSecret(encryptedSecret: string): string {
    return decrypt(encryptedSecret);
  }

  // ===========================================================================
  // VALIDATION
  // ===========================================================================

  /**
   * Validate that a code looks like a valid TOTP code
   */
  isValidCodeFormat(code: string): boolean {
    const normalized = code.replace(/\s/g, '');
    return /^\d{6}$/.test(normalized);
  }

  /**
   * Get remaining seconds until next code
   */
  getRemainingSeconds(): number {
    return 30 - (Math.floor(Date.now() / 1000) % 30);
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let totpServiceInstance: TotpService | null = null;

/**
 * Get TOTP service instance
 */
export function getTotpService(): TotpService {
  if (!totpServiceInstance) {
    totpServiceInstance = new TotpService();
  }
  return totpServiceInstance;
}

/**
 * Reset TOTP service (for testing)
 */
export function resetTotpService(): void {
  totpServiceInstance = null;
}
