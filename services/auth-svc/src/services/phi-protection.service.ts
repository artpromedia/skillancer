/**
 * @module @skillancer/auth-svc/services/phi-protection
 * PHI Data Protection Service - Encryption, Tokenization, and Masking
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

import {
  KMSClient,
  GenerateDataKeyCommand,
  DecryptCommand,
  ScheduleKeyDeletionCommand,
} from '@aws-sdk/client-kms';
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
// KMS CLIENT
// =============================================================================

let kmsClient: KMSClient | null = null;

function getKmsClient(): KMSClient {
  kmsClient ??= new KMSClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
  });
  return kmsClient;
}

// =============================================================================
// ENCRYPTION SERVICE
// =============================================================================

/**
 * Encrypt PHI data using envelope encryption with AWS KMS
 */
export async function encryptPhi(params: EncryptPhiParams): Promise<EncryptedData> {
  const { data, tenantId, context } = params;

  // Get tenant's KMS key
  const keyId = await getTenantKeyId(tenantId);

  if (!keyId) {
    throw new Error('Tenant encryption key not configured');
  }

  // Generate data encryption key (DEK) from KMS
  const kms = getKmsClient();
  const generateKeyCommand = new GenerateDataKeyCommand({
    KeyId: keyId,
    KeySpec: 'AES_256',
    EncryptionContext: {
      tenant_id: tenantId,
      purpose: 'phi_encryption',
      ...context,
    },
  });

  const keyResponse = await kms.send(generateKeyCommand);

  if (!keyResponse.Plaintext || !keyResponse.CiphertextBlob) {
    throw new Error('Failed to generate data encryption key');
  }

  const plainTextKey = Buffer.from(keyResponse.Plaintext);
  const encryptedKey = Buffer.from(keyResponse.CiphertextBlob);

  // Encrypt data with DEK
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', plainTextKey, iv);

  const dataBuffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  const encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Clear plaintext key from memory
  plainTextKey.fill(0);

  logger.debug({ tenantId, dataLength: dataBuffer.length }, 'PHI data encrypted');

  return {
    encryptedData: encrypted.toString('base64'),
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    algorithm: 'aes-256-gcm',
    keyId,
  };
}

/**
 * Decrypt PHI data
 */
export async function decryptPhi(params: DecryptPhiParams): Promise<Buffer> {
  const { encryptedData, tenantId, context } = params;

  // Decrypt the DEK using KMS
  const kms = getKmsClient();
  const decryptCommand = new DecryptCommand({
    CiphertextBlob: Buffer.from(encryptedData.encryptedKey, 'base64'),
    KeyId: encryptedData.keyId,
    EncryptionContext: {
      tenant_id: tenantId,
      purpose: 'phi_encryption',
      ...context,
    },
  });

  const decryptResponse = await kms.send(decryptCommand);

  if (!decryptResponse.Plaintext) {
    throw new Error('Failed to decrypt data encryption key');
  }

  const plainTextKey = Buffer.from(decryptResponse.Plaintext);

  // Decrypt data with DEK
  const decipher = createDecipheriv(
    'aes-256-gcm',
    plainTextKey,
    Buffer.from(encryptedData.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData.encryptedData, 'base64')),
    decipher.final(),
  ]);

  // Clear plaintext key from memory
  plainTextKey.fill(0);

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

  // Schedule KMS key for deletion (with waiting period)
  const keyId = await getTenantKeyId(tenantId);
  if (keyId) {
    await scheduleKeyDeletion(tenantId, keyId);
  }
}

// =============================================================================
// KEY MANAGEMENT
// =============================================================================

/**
 * Create a new encryption key for a tenant
 */
export async function createTenantKey(tenantId: string): Promise<string> {
  // In production, this would create a KMS key
  // For development, generate a mock key ID
  const keyId = `arn:aws:kms:us-east-1:123456789:key/${crypto.randomUUID()}`;

  await prisma.hipaaCompliance.update({
    where: { tenantId },
    data: { encryptionKeyId: keyId },
  });

  logger.info({ tenantId, keyId }, 'Tenant encryption key created');

  return keyId;
}

/**
 * Schedule key deletion (with 7-30 day waiting period per KMS requirements)
 */
async function scheduleKeyDeletion(tenantId: string, keyId: string): Promise<void> {
  try {
    const kms = getKmsClient();
    const command = new ScheduleKeyDeletionCommand({
      KeyId: keyId,
      PendingWindowInDays: 7, // Minimum is 7 days
    });

    await kms.send(command);
    logger.info({ tenantId, keyId }, 'KMS key scheduled for deletion');
  } catch (error) {
    logger.warn({ tenantId, keyId, error }, 'Failed to schedule KMS key deletion');
  }
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
