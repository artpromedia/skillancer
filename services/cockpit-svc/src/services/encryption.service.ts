/**
 * @module @skillancer/cockpit-svc/services/encryption
 * AES-256-GCM Encryption Service for sensitive data
 */

import * as crypto from 'crypto';

import type { Logger } from '@skillancer/logger';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000;

export interface EncryptionConfig {
  masterKey: string;
}

export class EncryptionService {
  private readonly masterKey: Buffer;

  constructor(
    private readonly config: EncryptionConfig,
    private readonly logger: Logger
  ) {
    // Derive a key from the master key using PBKDF2
    // The master key should be at least 32 characters for security
    if (!config.masterKey || config.masterKey.length < 32) {
      throw new Error('Master encryption key must be at least 32 characters');
    }
    this.masterKey = Buffer.from(config.masterKey, 'utf-8').subarray(0, KEY_LENGTH);
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * Returns a string in format: iv:authTag:encryptedData (all base64 encoded)
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
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
      const combined = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;

      return combined;
    } catch (error) {
      this.logger.error({ error }, 'Encryption failed');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data encrypted with the encrypt method
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      // Split the combined string
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivBase64, authTagBase64, encrypted] = parts;

      const iv = Buffer.from(ivBase64!, 'base64');
      const authTag = Buffer.from(authTagBase64!, 'base64');

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted!, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error({ error }, 'Decryption failed');
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt data with a derived key (for per-user encryption)
   * Uses PBKDF2 to derive a key from the master key + user-specific salt
   */
  async encryptWithDerivedKey(plaintext: string, salt: string): Promise<string> {
    try {
      // Derive a key using PBKDF2
      const derivedKey = await this.deriveKey(salt);

      // Generate random IV
      const iv = crypto.randomBytes(IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine IV, auth tag, and encrypted data
      return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      this.logger.error({ error }, 'Encryption with derived key failed');
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data encrypted with a derived key
   */
  async decryptWithDerivedKey(encryptedData: string, salt: string): Promise<string> {
    try {
      // Derive the same key
      const derivedKey = await this.deriveKey(salt);

      // Split the combined string
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivBase64, authTagBase64, encrypted] = parts;

      const iv = Buffer.from(ivBase64!, 'base64');
      const authTag = Buffer.from(authTagBase64!, 'base64');

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv, {
        authTagLength: AUTH_TAG_LENGTH,
      });
      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted!, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error({ error }, 'Decryption with derived key failed');
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Derive a key from the master key using PBKDF2
   */
  private async deriveKey(salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        this.masterKey,
        salt,
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha512',
        (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey);
          }
        }
      );
    });
  }

  /**
   * Generate a random salt for key derivation
   */
  generateSalt(): string {
    return crypto.randomBytes(SALT_LENGTH).toString('base64');
  }

  /**
   * Hash sensitive data (one-way, for comparison)
   */
  hash(data: string): string {
    return crypto.createHmac('sha256', this.masterKey).update(data).digest('hex');
  }

  /**
   * Generate a secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a webhook secret
   */
  generateWebhookSecret(): string {
    return `whsec_${crypto.randomBytes(24).toString('base64url')}`;
  }

  /**
   * Verify HMAC signature (for webhooks)
   */
  verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // Use timing-safe comparison
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  /**
   * Verify Stripe-style signature (v1=...)
   */
  verifyStripeSignature(
    payload: string,
    signatureHeader: string,
    secret: string,
    tolerance: number = 300 // 5 minutes
  ): boolean {
    try {
      const elements = signatureHeader.split(',');
      const timestampElement = elements.find((e) => e.startsWith('t='));
      const signatureElement = elements.find((e) => e.startsWith('v1='));

      if (!timestampElement || !signatureElement) {
        return false;
      }

      const timestamp = Number.parseInt(timestampElement.split('=')[1]!, 10);
      const signature = signatureElement.split('=')[1]!;

      // Check timestamp tolerance
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > tolerance) {
        return false;
      }

      // Compute expected signature
      const signedPayload = `${timestamp}.${payload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }
}

/**
 * Factory function to create encryption service
 */
export function createEncryptionService(logger: Logger): EncryptionService {
  const masterKey = process.env['ENCRYPTION_MASTER_KEY'];
  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
  }

  return new EncryptionService({ masterKey }, logger);
}
