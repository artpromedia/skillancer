/**
 * @module @skillancer/auth-svc/services/encryption
 * AES-256-GCM Encryption Service for sensitive data (refresh tokens)
 */

import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

/**
 * Encryption service for sensitive data
 *
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionService {
  private readonly masterKey: Buffer;

  constructor(masterKey: string) {
    if (!masterKey || masterKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }
    // Use SHA-256 to derive a consistent 32-byte key
    this.masterKey = crypto.createHash('sha256').update(masterKey).digest();
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * Returns a string in format: iv:authTag:encryptedData (all base64 encoded)
   */
  encrypt(plaintext: string): string {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine IV, auth tag, and encrypted data
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt data encrypted with the encrypt method
   */
  decrypt(encryptedData: string): string {
    // Split the combined string
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const ivBase64 = parts[0] as string;
    const authTagBase64 = parts[1] as string;
    const encrypted = parts[2] as string;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash data using HMAC-SHA256 (one-way, for comparison)
   */
  hash(data: string): string {
    return crypto.createHmac('sha256', this.masterKey).update(data).digest('hex');
  }

  /**
   * Check if a plaintext matches a hash
   */
  verifyHash(plaintext: string, hash: string): boolean {
    const computed = this.hash(plaintext);
    // Use timing-safe comparison
    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
    } catch {
      return false;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Initialize encryption service
 */
export function initializeEncryptionService(masterKey: string): EncryptionService {
  encryptionServiceInstance = new EncryptionService(masterKey);
  return encryptionServiceInstance;
}

/**
 * Get encryption service singleton instance
 * Requires ENCRYPTION_KEY environment variable
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    const encryptionKey = process.env['ENCRYPTION_KEY'];
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable must be set');
    }

    encryptionServiceInstance = new EncryptionService(encryptionKey);
  }
  return encryptionServiceInstance;
}

/**
 * Reset encryption service (for testing)
 */
export function resetEncryptionService(): void {
  encryptionServiceInstance = null;
}
