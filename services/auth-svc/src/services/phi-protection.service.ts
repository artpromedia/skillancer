/**
 * @module @skillancer/auth-svc/services/phi-protection
 * PHI Data Protection Service - Encryption, Tokenization, and Masking
 *
 * Uses Node.js native crypto (AES-256-GCM) instead of AWS KMS for:
 * - Zero cloud vendor lock-in
 * - Full HIPAA compliance with AES-256-GCM
 * - Lower latency (no network calls for encryption)
 * - Cost savings (no KMS API charges)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash, pbkdf2Sync } from 'node:crypto';

import {
  prisma,
  PhiFieldTypeEnum,
  type PhiFieldType as PhiFieldTypeType,
  type Prisma,
} from '@skillancer/database';
import { createLogger } from '@skillancer/logger';

import type {
  EncryptedData,
  EncryptPhiParams,
  DecryptPhiParams,
  TokenizePhiParams,
  SecureDeletePhiParams,
} from '../types/hipaa.types.js';

const logger = createLogger({ serviceName: 'phi-protection' });

// Alias enum for runtime usage
const PhiFieldType = PhiFieldTypeEnum;

// =============================================================================
// ENCRYPTION CONFIGURATION
// =============================================================================

// Algorithm: AES-256-GCM (HIPAA compliant, provides authenticity + confidentiality)
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits (GCM standard)
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32; // 256 bits
const PBKDF2_ITERATIONS = 100000; // NIST recommendation

/**
 * Get master encryption key from environment
 * Must be 64 hex characters (32 bytes)
 */
function getMasterKey(): Buffer {
  const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterKeyHex) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable not set');
  }

  if (masterKeyHex.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(masterKeyHex, 'hex');
}

/**
 * Derive tenant-specific encryption key from master key
 * Uses PBKDF2 with tenant ID as salt for key separation
 */
function deriveTenantKey(tenantId: string, salt: Buffer): Buffer {
  const masterKey = getMasterKey();

  // Use tenant ID in salt to ensure different keys per tenant
  const tenantSalt = Buffer.concat([salt, Buffer.from(tenantId, 'utf8')]);

  return pbkdf2Sync(masterKey, tenantSalt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

// =============================================================================
// ENCRYPTION SERVICE
// =============================================================================

/**
 * Encrypt PHI data using AES-256-GCM with tenant-specific derived keys
 *
 * HIPAA Compliance:
 * - AES-256-GCM provides confidentiality and authenticity
 * - Random IV per encryption (never reused)
 * - Tenant key separation via PBKDF2
 * - Secure key derivation with 100,000 iterations
 */
export async function encryptPhi(params: EncryptPhiParams): Promise<EncryptedData> {
  const { data, tenantId, context } = params;

  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);

    // Derive tenant-specific encryption key
    const key = deriveTenantKey(tenantId, salt);

    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);

    // Add additional authenticated data (AAD) for context binding
    if (context) {
      const aad = Buffer.from(JSON.stringify(context), 'utf8');
      cipher.setAAD(aad);
    }

    // Encrypt data
    const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Clear sensitive data from memory
    key.fill(0);

    logger.debug(
      {
        tenantId,
        dataLength: dataBuffer.length,
        saltLength: salt.length,
        ivLength: iv.length,
      },
      'PHI data encrypted'
    );

    return {
      encryptedData: encrypted.toString('base64'),
      encryptedKey: salt.toString('base64'), // Store salt (not sensitive)
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: ALGORITHM,
      keyId: `tenant:${tenantId}`, // Logical key ID
    };
  } catch (error) {
    logger.error({ error, tenantId }, 'PHI encryption failed');
    throw new Error('Failed to encrypt PHI data');
  }
}

/**
 * Decrypt PHI data using tenant-specific derived key
 */
export async function decryptPhi(params: DecryptPhiParams): Promise<Buffer> {
  const { encryptedData, tenantId, context } = params;

  try {
    // Extract salt from encryptedKey field
    const salt = Buffer.from(encryptedData.encryptedKey, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    const ciphertext = Buffer.from(encryptedData.encryptedData, 'base64');

    // Derive same tenant-specific key
    const key = deriveTenantKey(tenantId, salt);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Add AAD if context was used during encryption
    if (context) {
      const aad = Buffer.from(JSON.stringify(context), 'utf8');
      decipher.setAAD(aad);
    }

    // Decrypt data
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Clear sensitive data from memory
    key.fill(0);

    logger.debug({ tenantId, dataLength: decrypted.length }, 'PHI data decrypted');

    return decrypted;
  } catch (error) {
    logger.error({ error, tenantId }, 'PHI decryption failed');
    throw new Error('Failed to decrypt PHI data');
  }

  logger.debug({ tenantId }, 'PHI data decrypted');
  return decrypted;
}

/**
 * Create field-level encryption for specific PHI fields
 */
export async function encryptPhiFields<T extends Record<string, unknown>>(
  data: T,
  phiFields: string[],
  tenantId: string
): Promise<T & { __encrypted_fields: string[] }> {
  const result = { ...data, __encrypted_fields: [] as string[] };

  for (const field of phiFields) {
    const value = data[field];
    if (value !== undefined && value !== null) {
      const encrypted = await encryptPhi({
        data: JSON.stringify(value),
        tenantId,
        context: { field_name: field },
      });

      (result as Record<string, unknown>)[field] = encrypted;
      result.__encrypted_fields.push(field);
    }
  }

  return result;
}

/**
 * Decrypt field-level encrypted PHI fields
 */
export async function decryptPhiFields<T extends Record<string, unknown>>(
  data: T & { __encrypted_fields?: string[] },
  tenantId: string
): Promise<T> {
  if (!data.__encrypted_fields || data.__encrypted_fields.length === 0) {
    const { __encrypted_fields: _, ...rest } = data;
    return rest as T;
  }

  const result = { ...data };
  delete (result as Record<string, unknown>).__encrypted_fields;

  for (const field of data.__encrypted_fields) {
    const encryptedValue = data[field];
    if (encryptedValue) {
      const decrypted = await decryptPhi({
        encryptedData: encryptedValue as EncryptedData,
        tenantId,
        context: { field_name: field },
      });

      (result as Record<string, unknown>)[field] = JSON.parse(decrypted.toString('utf8'));
    }
  }

  return result as T;
}

// =============================================================================
// MASKING SERVICE
// =============================================================================

/**
 * Mask PHI for display purposes
 */
export function maskPhi(value: string, type: PhiFieldTypeType): string {
  if (!value) return '';

  switch (type) {
    case PhiFieldType.SSN:
      // Show last 4 digits: ***-**-1234
      return value.length >= 4 ? `***-**-${value.slice(-4)}` : '***-**-****';

    case PhiFieldType.DOB: {
      // Show year only: **/**/1990
      const parts = value.split(/[-/]/);
      return parts.length >= 3 ? `**/**/${parts[parts.length - 1]}` : '**/**/****';
    }

    case PhiFieldType.PHONE: {
      // Show last 4 digits: (***) ***-1234
      const digits = value.replace(/\D/g, '');
      return digits.length >= 4 ? `(***) ***-${digits.slice(-4)}` : '(***) ***-****';
    }

    case PhiFieldType.EMAIL: {
      // Show first letter and domain: j***@example.com
      const atIndex = value.indexOf('@');
      if (atIndex > 0) {
        const local = value.substring(0, atIndex);
        const domain = value.substring(atIndex + 1);
        return `${local[0]}***@${domain}`;
      }
      return '***@***.***';
    }

    case PhiFieldType.NAME: {
      // Show first letter and last name initial: J*** D.
      const nameParts = value.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        return `${nameParts[0]?.[0] ?? ''}*** ${nameParts[nameParts.length - 1]?.[0] ?? ''}.`;
      }
      return value.length > 0 ? `${value[0]}***` : '***';
    }

    case PhiFieldType.ADDRESS:
      // Show city/state only: ***, City, ST *****
      return '***, [City], [ST] *****';

    case PhiFieldType.MEDICAL_RECORD:
      // Show last 4 characters
      return value.length >= 4 ? `****${value.slice(-4)}` : '********';

    case PhiFieldType.INSURANCE_ID:
      // Show last 4 characters
      return value.length >= 4 ? `****${value.slice(-4)}` : '********';

    default:
      // Generic masking
      if (value.length > 4) {
        return `${value[0]}${'*'.repeat(value.length - 2)}${value.slice(-1)}`;
      }
      return '*'.repeat(value.length || 4);
  }
}

/**
 * Mask multiple PHI fields in an object
 */
export function maskPhiFields<T extends Record<string, unknown>>(
  data: T,
  fieldTypes: Record<string, PhiFieldTypeType>
): T {
  const result = { ...data };

  for (const [field, type] of Object.entries(fieldTypes)) {
    const value = data[field];
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[field] = maskPhi(value, type);
    }
  }

  return result;
}

// =============================================================================
// TOKENIZATION SERVICE
// =============================================================================

/**
 * Tokenize PHI for safe storage
 */
export async function tokenizePhi(params: TokenizePhiParams): Promise<string> {
  const { value, type, tenantId, resourceType, resourceId } = params;

  // Hash the value for lookup
  const valueHash = hashValue(value, tenantId);

  // Check if already tokenized
  const existingToken = await prisma.phiToken.findFirst({
    where: {
      valueHash,
      tenantId,
    },
  });

  if (existingToken) {
    return existingToken.token;
  }

  // Generate new token
  const token = `PHI_${type}_${randomBytes(16).toString('hex')}`;

  // Encrypt and store the original value
  const encrypted = await encryptPhi({
    data: value,
    tenantId,
    context: { type, purpose: 'tokenization' },
  });

  await prisma.phiToken.create({
    data: {
      token,
      valueHash,
      encryptedValue: encrypted as unknown as Prisma.InputJsonValue,
      type,
      tenantId,
      resourceType: resourceType ?? null,
      resourceId: resourceId ?? null,
    },
  });

  logger.debug({ tenantId, type }, 'PHI value tokenized');

  return token;
}

/**
 * Detokenize PHI
 */
export async function detokenizePhi(token: string, tenantId: string): Promise<string | null> {
  const tokenRecord = await prisma.phiToken.findFirst({
    where: {
      token,
      tenantId,
    },
  });

  if (!tokenRecord) {
    return null;
  }

  const decrypted = await decryptPhi({
    encryptedData: tokenRecord.encryptedValue as unknown as EncryptedData,
    tenantId,
  });

  return decrypted.toString('utf8');
}

/**
 * Batch tokenize multiple PHI values
 */
export async function batchTokenizePhi(
  items: Array<{ value: string; type: PhiFieldTypeType }>,
  tenantId: string
): Promise<Map<string, string>> {
  const tokenMap = new Map<string, string>();

  for (const item of items) {
    const token = await tokenizePhi({
      value: item.value,
      type: item.type,
      tenantId,
    });
    tokenMap.set(item.value, token);
  }

  return tokenMap;
}

/**
 * Batch detokenize multiple tokens
 */
export async function batchDetokenizePhi(
  tokens: string[],
  tenantId: string
): Promise<Map<string, string | null>> {
  const valueMap = new Map<string, string | null>();

  for (const token of tokens) {
    const value = await detokenizePhi(token, tenantId);
    valueMap.set(token, value);
  }

  return valueMap;
}

// =============================================================================
// SECURE DELETION SERVICE
// =============================================================================

/**
 * Secure PHI deletion (crypto-shredding)
 */
export async function secureDeletePhi(params: SecureDeletePhiParams): Promise<void> {
  const { tenantId, resourceType, resourceId } = params;

  logger.info({ tenantId, resourceType, resourceId }, 'Starting secure PHI deletion');

  // Delete associated tokens
  const deletedTokens = await prisma.phiToken.deleteMany({
    where: {
      tenantId,
      resourceType,
      resourceId,
    },
  });

  logger.info(
    { tenantId, resourceType, resourceId, deletedTokens: deletedTokens.count },
    'PHI tokens deleted'
  );

  // Check if this is the last resource for tenant
  const remainingTokens = await prisma.phiToken.count({
    where: { tenantId },
  });

  if (remainingTokens === 0) {
    // Consider scheduling key deletion in production
    logger.info({ tenantId }, 'No remaining PHI tokens for tenant');
  }
}

/**
 * Secure delete all PHI for a tenant (for tenant deletion/GDPR)
 */
export async function secureDeleteAllTenantPhi(tenantId: string): Promise<void> {
  logger.info({ tenantId }, 'Starting secure deletion of all tenant PHI');

  // Delete all tokens
  const deletedTokens = await prisma.phiToken.deleteMany({
    where: { tenantId },
  });

  logger.info({ tenantId, deletedTokens: deletedTokens.count }, 'All tenant PHI tokens deleted');

  // Clear encryption key reference (not needed for Node crypto, but kept for audit trail)
  await prisma.hipaaCompliance.update({
    where: { tenantId },
    data: { encryptionKeyId: null },
  });

  logger.info({ tenantId }, 'Tenant encryption key reference cleared');
}

// =============================================================================
// KEY MANAGEMENT
// =============================================================================

/**
 * Create encryption key reference for a tenant
 * Note: With Node crypto, we don't create actual external keys,
 * but we track a logical key ID for audit purposes
 */
export async function createTenantKey(tenantId: string): Promise<string> {
  // Generate logical key ID for audit trail
  const keyId = `tenant:${tenantId}:v1:${randomBytes(16).toString('hex')}`;

  await prisma.hipaaCompliance.update({
    where: { tenantId },
    data: { encryptionKeyId: keyId },
  });

  logger.info({ tenantId, keyId }, 'Tenant encryption key reference created');

  return keyId;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getTenantKeyId(tenantId: string): Promise<string | null> {
  const compliance = await prisma.hipaaCompliance.findUnique({
    where: { tenantId },
    select: { encryptionKeyId: true },
  });

  return compliance?.encryptionKeyId ?? null;
}

function hashValue(value: string, tenantId: string): string {
  const salt = process.env.PHI_HASH_SALT ?? 'default-salt-change-in-production';
  return createHash('sha256')
    .update(value + salt + tenantId)
    .digest('hex');
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate PHI field format
 */
export function validatePhiField(value: string, type: PhiFieldTypeType): boolean {
  switch (type) {
    case PhiFieldType.SSN:
      // SSN format: XXX-XX-XXXX or XXXXXXXXX
      return /^\d{3}-?\d{2}-?\d{4}$/.test(value);

    case PhiFieldType.DOB: {
      // Date format: YYYY-MM-DD, MM/DD/YYYY, etc.
      const date = new Date(value);
      return !isNaN(date.getTime());
    }

    case PhiFieldType.PHONE: {
      // Phone format: various formats with 10+ digits
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10;
    }

    case PhiFieldType.EMAIL:
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    default:
      return value.length > 0;
  }
}

/**
 * Sanitize PHI value before storage
 */
export function sanitizePhiValue(value: string, type: PhiFieldTypeType): string {
  switch (type) {
    case PhiFieldType.SSN:
      // Remove non-digits and format
      return value.replace(/\D/g, '');

    case PhiFieldType.PHONE:
      // Remove non-digits
      return value.replace(/\D/g, '');

    case PhiFieldType.EMAIL:
      return value.toLowerCase().trim();

    case PhiFieldType.NAME:
      return value.trim();

    default:
      return value.trim();
  }
}
