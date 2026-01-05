/**
 * Data Protection Service
 *
 * Provides encryption, anonymization, consent management,
 * data subject requests, and retention policy handling.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

import {
  DataClassification,
  type ConsentRecord,
  type ConsentType,
  consentRequirements,
  type DataSubjectRequest,
  type RetentionPolicy,
} from '../audit/audit-schema';

import type { AuditService } from '../audit/audit-service';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

// ==================== Types ====================

export interface EncryptionConfig {
  algorithm: string;
  keyId: string;
  key: Buffer;
  ivLength: number;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  authTag: string;
  keyId: string;
}

export interface AnonymizationConfig {
  method: 'hash' | 'mask' | 'generalize' | 'suppress' | 'noise';
  options?: Record<string, any>;
}

export interface Logger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

// ==================== Data Protection Service ====================

export class DataProtectionService {
  private encryptionKeys: Map<string, EncryptionConfig> = new Map();
  private prisma: PrismaClient;
  private redis: Redis;
  private dataQueue: Queue;
  private auditService: AuditService;
  private logger: Logger;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    dataQueue: Queue,
    auditService: AuditService,
    logger: Logger
  ) {
    this.prisma = prisma;
    this.redis = redis;
    this.dataQueue = dataQueue;
    this.auditService = auditService;
    this.logger = logger;
    this.initializeEncryptionKeys();
  }

  private initializeEncryptionKeys(): void {
    // In production, these would come from Vault or KMS
    const masterKey = process.env.ENCRYPTION_MASTER_KEY;
    if (!masterKey) {
      this.logger.warn('Encryption master key not configured, using placeholder');
      // Use a placeholder for development
      const placeholderKey = randomBytes(32);
      this.encryptionKeys.set('default', {
        algorithm: 'aes-256-gcm',
        keyId: 'default',
        key: placeholderKey,
        ivLength: 16,
      });
      this.encryptionKeys.set('pii', {
        algorithm: 'aes-256-gcm',
        keyId: 'pii',
        key: placeholderKey,
        ivLength: 16,
      });
      return;
    }

    this.encryptionKeys.set('default', {
      algorithm: 'aes-256-gcm',
      keyId: 'default',
      key: Buffer.from(masterKey, 'hex'),
      ivLength: 16,
    });

    // PII-specific key
    const piiKey = process.env.ENCRYPTION_PII_KEY || masterKey;
    this.encryptionKeys.set('pii', {
      algorithm: 'aes-256-gcm',
      keyId: 'pii',
      key: Buffer.from(piiKey, 'hex'),
      ivLength: 16,
    });
  }

  // ==================== Encryption ====================

  encrypt(data: string, keyId: string = 'default'): EncryptedData {
    const config = this.encryptionKeys.get(keyId);
    if (!config) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    const iv = randomBytes(config.ivLength);
    const cipher = createCipheriv(config.algorithm, config.key, iv) as any;

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
      keyId,
    };
  }

  decrypt(encryptedData: EncryptedData): string {
    const config = this.encryptionKeys.get(encryptedData.keyId);
    if (!config) {
      throw new Error(`Encryption key not found: ${encryptedData.keyId}`);
    }

    const decipher = createDecipheriv(
      config.algorithm,
      config.key,
      Buffer.from(encryptedData.iv, 'hex')
    ) as any;

    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  encryptField<T extends Record<string, any>>(
    data: T,
    fields: (keyof T)[],
    keyId: string = 'pii'
  ): T {
    const result = { ...data };

    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        const encrypted = this.encrypt(String(result[field]), keyId);
        (result as any)[field] = JSON.stringify(encrypted);
      }
    }

    return result;
  }

  decryptField<T extends Record<string, any>>(data: T, fields: (keyof T)[]): T {
    const result = { ...data };

    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        try {
          const encryptedData = JSON.parse(String(result[field]));
          if (encryptedData.encrypted && encryptedData.iv && encryptedData.authTag) {
            (result as any)[field] = this.decrypt(encryptedData);
          }
        } catch {
          // Field might not be encrypted, leave as-is
        }
      }
    }

    return result;
  }

  // ==================== Anonymization ====================

  anonymize(
    data: string,
    method: AnonymizationConfig['method'],
    options?: AnonymizationConfig['options']
  ): string {
    switch (method) {
      case 'hash':
        return this.hashAnonymize(data, options?.salt);

      case 'mask':
        return this.maskAnonymize(data, options?.visibleChars, options?.maskChar);

      case 'generalize':
        return this.generalizeAnonymize(data, options?.level);

      case 'suppress':
        return options?.replacement || '[REMOVED]';

      case 'noise':
        return this.noiseAnonymize(data, options?.variance);

      default:
        throw new Error(`Unknown anonymization method: ${method}`);
    }
  }

  private hashAnonymize(data: string, salt?: string): string {
    const hash = createHash('sha256');
    hash.update(data);
    if (salt) hash.update(salt);
    return hash.digest('hex').substring(0, 16);
  }

  private maskAnonymize(data: string, visibleChars: number = 4, maskChar: string = '*'): string {
    if (data.length <= visibleChars) {
      return maskChar.repeat(data.length);
    }

    const visible = data.slice(-visibleChars);
    const masked = maskChar.repeat(data.length - visibleChars);
    return masked + visible;
  }

  private generalizeAnonymize(data: string, level: number = 1): string {
    // For email: john.doe@example.com -> j***@example.com -> ***@***.com
    if (data.includes('@')) {
      const [local, domain] = data.split('@');
      if (level === 1) {
        return `${local[0]}***@${domain}`;
      } else {
        const domainParts = domain.split('.');
        return `***@***.${domainParts[domainParts.length - 1]}`;
      }
    }

    // For numbers: 12345 -> 12000 -> 10000
    if (/^\d+$/.test(data)) {
      const num = Number.parseInt(data);
      const magnitude = Math.pow(10, level);
      return String(Math.floor(num / magnitude) * magnitude);
    }

    // Default: truncate
    const keepLength = Math.max(1, Math.floor(data.length / (level + 1)));
    return data.substring(0, keepLength) + '***';
  }

  private noiseAnonymize(data: string, variance: number = 0.1): string {
    if (/^\d+(\.\d+)?$/.test(data)) {
      const num = parseFloat(data);
      const noise = (Math.random() - 0.5) * 2 * variance * num;
      return String(Math.round(num + noise));
    }
    return data;
  }

  async anonymizeRecord<T extends Record<string, any>>(
    data: T,
    fieldConfigs: Record<keyof T, AnonymizationConfig>
  ): Promise<T> {
    const result = { ...data };

    for (const [field, config] of Object.entries(fieldConfigs)) {
      if (result[field as keyof T] !== undefined) {
        (result as any)[field] = this.anonymize(
          String(result[field as keyof T]),
          config.method,
          config.options
        );
      }
    }

    return result;
  }

  // ==================== Consent Management ====================

  async recordConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    source: ConsentRecord['source'],
    ipAddress: string,
    userAgent: string
  ): Promise<ConsentRecord> {
    const record: ConsentRecord = {
      id: `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      consentType,
      purpose: consentRequirements[consentType].description,
      granted,
      grantedAt: granted ? new Date() : undefined,
      withdrawnAt: !granted ? new Date() : undefined,
      source,
      version: '1.0',
      ipAddress,
      userAgent,
    };

    await (this.prisma as any).consentRecord.create({
      data: {
        id: record.id,
        userId: record.userId,
        consentType: record.consentType,
        purpose: record.purpose,
        granted: record.granted,
        grantedAt: record.grantedAt,
        withdrawnAt: record.withdrawnAt,
        source: record.source,
        version: record.version,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
      },
    });

    // Audit log
    await this.auditService.logComplianceEvent(
      granted ? 'consent_granted' : 'consent_withdrawn',
      {
        type: 'user',
        id: userId,
        ipAddress,
        userAgent,
      },
      {
        target: { type: 'consent', id: consentType },
        regulations: ['GDPR', 'CCPA'],
        metadata: { consentType, granted, source },
      }
    );

    // Clear consent cache
    await this.redis.del(`consent:${userId}`);

    return record;
  }

  async getConsents(userId: string): Promise<Record<ConsentType, boolean>> {
    // Check cache first
    const cached = await this.redis.get(`consent:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get latest consent for each type
    const consents = await (this.prisma as any).consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      distinct: ['consentType'],
    });

    const result: Record<string, boolean> = {};

    // Set defaults
    for (const [type, config] of Object.entries(consentRequirements)) {
      result[type] = config.defaultValue;
    }

    // Override with actual consents
    for (const consent of consents) {
      result[consent.consentType] = consent.granted;
    }

    // Cache for 1 hour
    await this.redis.setex(`consent:${userId}`, 3600, JSON.stringify(result));

    return result as Record<ConsentType, boolean>;
  }

  async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    const consents = await this.getConsents(userId);
    return consents[consentType] ?? consentRequirements[consentType].defaultValue;
  }

  async withdrawAllConsents(userId: string, ipAddress: string, userAgent: string): Promise<void> {
    const consents = await this.getConsents(userId);

    for (const [type, granted] of Object.entries(consents)) {
      if (granted && !consentRequirements[type as ConsentType].required) {
        await this.recordConsent(
          userId,
          type as ConsentType,
          false,
          'settings',
          ipAddress,
          userAgent
        );
      }
    }
  }

  async getConsentHistory(userId: string): Promise<ConsentRecord[]> {
    const records = await (this.prisma as any).consentRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return records;
  }

  // ==================== Data Subject Requests ====================

  async createDataSubjectRequest(
    userId: string,
    type: DataSubjectRequest['type'],
    requestDetails?: string,
    ipAddress?: string
  ): Promise<DataSubjectRequest> {
    const request: DataSubjectRequest = {
      id: `dsr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      status: 'pending',
      submittedAt: new Date(),
      requestDetails,
    };

    await (this.prisma as any).dataSubjectRequest.create({
      data: {
        id: request.id,
        userId: request.userId,
        type: request.type,
        status: request.status,
        submittedAt: request.submittedAt,
        requestDetails: request.requestDetails,
      },
    });

    // Queue for processing
    await this.dataQueue.add('data-subject-request', {
      requestId: request.id,
      userId,
      type,
    });

    // Audit log
    await this.auditService.logComplianceEvent(
      'data_subject_request',
      {
        type: 'user',
        id: userId,
        ipAddress: ipAddress || 'unknown',
      },
      {
        target: { type: 'data_subject_request', id: request.id },
        regulations: ['GDPR', 'CCPA'],
        metadata: { requestType: type },
      }
    );

    return request;
  }

  async getDataSubjectRequest(requestId: string): Promise<DataSubjectRequest | null> {
    const request = await (this.prisma as any).dataSubjectRequest.findUnique({
      where: { id: requestId },
    });

    return request;
  }

  async listDataSubjectRequests(filters?: {
    userId?: string;
    type?: DataSubjectRequest['type'];
    status?: DataSubjectRequest['status'];
    page?: number;
    limit?: number;
  }): Promise<{ requests: DataSubjectRequest[]; total: number }> {
    const where: any = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

    const [requests, total] = await Promise.all([
      (this.prisma as any).dataSubjectRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip: ((filters?.page || 1) - 1) * (filters?.limit || 20),
        take: filters?.limit || 20,
      }),
      (this.prisma as any).dataSubjectRequest.count({ where }),
    ]);

    return { requests, total };
  }

  async processAccessRequest(requestId: string, adminUserId: string): Promise<any> {
    const request = await (this.prisma as any).dataSubjectRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Request not found');
    if (request.type !== 'access') throw new Error('Not an access request');

    // Update status
    await (this.prisma as any).dataSubjectRequest.update({
      where: { id: requestId },
      data: { status: 'processing' },
    });

    // Gather all user data
    const userData = await this.gatherUserData(request.userId);

    // Complete request
    await (this.prisma as any).dataSubjectRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        processedBy: adminUserId,
      },
    });

    await this.auditService.logComplianceEvent(
      'data_export_request',
      {
        type: 'admin',
        id: adminUserId,
        ipAddress: 'system',
      },
      {
        target: { type: 'user', id: request.userId },
        regulations: ['GDPR'],
        metadata: { requestId },
      }
    );

    return userData;
  }

  async processDeletionRequest(requestId: string, adminUserId: string): Promise<void> {
    const request = await (this.prisma as any).dataSubjectRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new Error('Request not found');
    if (request.type !== 'deletion') throw new Error('Not a deletion request');

    // Update status
    await (this.prisma as any).dataSubjectRequest.update({
      where: { id: requestId },
      data: { status: 'processing' },
    });

    // Delete or anonymize user data
    await this.deleteUserData(request.userId);

    // Complete request
    await (this.prisma as any).dataSubjectRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        processedBy: adminUserId,
      },
    });

    await this.auditService.logComplianceEvent(
      'data_deletion_request',
      {
        type: 'admin',
        id: adminUserId,
        ipAddress: 'system',
      },
      {
        target: { type: 'user', id: request.userId },
        regulations: ['GDPR', 'CCPA'],
        metadata: { requestId },
      }
    );
  }

  private async gatherUserData(userId: string): Promise<any> {
    // Collect all user data from various tables
    const prisma = this.prisma as any;

    const [user, profile, consents] = await Promise.all([
      prisma.user?.findUnique({ where: { id: userId } }).catch(() => null),
      prisma.profile?.findUnique({ where: { userId } }).catch(() => null),
      prisma.consentRecord?.findMany({ where: { userId } }).catch(() => []),
    ]);

    // Decrypt sensitive fields
    const decryptedProfile = profile ? this.decryptField(profile, ['phone', 'address']) : null;

    return {
      exportDate: new Date().toISOString(),
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
          }
        : null,
      profile: decryptedProfile,
      consents,
      // Additional data would be gathered from other tables
    };
  }

  private async deleteUserData(userId: string): Promise<void> {
    const prisma = this.prisma as any;

    await prisma.$transaction(async (tx: any) => {
      // Anonymize user record
      if (tx.user) {
        await tx.user
          .update({
            where: { id: userId },
            data: {
              email: `deleted_${userId}@deleted.local`,
              name: 'Deleted User',
              passwordHash: '',
              status: 'deleted',
              deletedAt: new Date(),
            },
          })
          .catch(() => {});
      }

      // Delete profile
      if (tx.profile) {
        await tx.profile.deleteMany({ where: { userId } }).catch(() => {});
      }

      // Delete sessions
      if (tx.session) {
        await tx.session.deleteMany({ where: { userId } }).catch(() => {});
      }

      // Delete consents
      if (tx.consentRecord) {
        await tx.consentRecord.deleteMany({ where: { userId } }).catch(() => {});
      }
    });

    // Clear caches
    await this.redis.del(`user:${userId}`);
    await this.redis.del(`consent:${userId}`);

    // Delete all keys matching pattern
    const keys = await this.redis.keys(`session:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ==================== Data Retention ====================

  async getRetentionPolicies(): Promise<RetentionPolicy[]> {
    const policies = await (this.prisma as any).retentionPolicy.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return policies;
  }

  async createRetentionPolicy(policy: Omit<RetentionPolicy, 'id'>): Promise<RetentionPolicy> {
    const newPolicy = await (this.prisma as any).retentionPolicy.create({
      data: {
        id: `retention-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...policy,
      },
    });

    return newPolicy;
  }

  async updateRetentionPolicy(
    policyId: string,
    updates: Partial<Omit<RetentionPolicy, 'id'>>
  ): Promise<RetentionPolicy> {
    const policy = await (this.prisma as any).retentionPolicy.update({
      where: { id: policyId },
      data: updates,
    });

    return policy;
  }

  async runRetentionPolicy(
    policyId: string
  ): Promise<{ processed: number; deleted: number; anonymized: number }> {
    const policy = await (this.prisma as any).retentionPolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) throw new Error('Policy not found');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    let processed = 0;
    let deleted = 0;
    let anonymized = 0;

    const prisma = this.prisma as any;

    // Execute based on policy data type
    switch (policy.dataType) {
      case 'audit_logs':
        if (policy.action === 'delete') {
          const result = await prisma.securityAuditLog
            .deleteMany({
              where: { timestamp: { lt: cutoffDate } },
            })
            .catch(() => ({ count: 0 }));
          deleted = result.count;
        }
        break;

      case 'sessions':
        const sessionResult = await prisma.session
          ?.deleteMany({
            where: { expiresAt: { lt: cutoffDate } },
          })
          .catch(() => ({ count: 0 }));
        deleted = sessionResult?.count || 0;
        break;

      case 'inactive_users':
        // Anonymize instead of delete
        if (policy.action === 'anonymize') {
          const users = await prisma.user
            ?.findMany({
              where: {
                lastActiveAt: { lt: cutoffDate },
                status: 'active',
              },
            })
            .catch(() => []);

          for (const user of users || []) {
            await this.deleteUserData(user.id);
            anonymized++;
          }
        }
        break;
    }

    processed = deleted + anonymized;

    // Update policy
    await (this.prisma as any).retentionPolicy.update({
      where: { id: policyId },
      data: {
        lastRunAt: new Date(),
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Next day
      },
    });

    // Audit log
    await this.auditService.logComplianceEvent(
      'data_retention_applied',
      {
        type: 'system',
        ipAddress: 'system',
      },
      {
        target: { type: 'retention_policy', id: policyId, name: policy.name },
        regulations: ['GDPR'],
        metadata: { processed, deleted, anonymized, cutoffDate },
      }
    );

    return { processed, deleted, anonymized };
  }

  async scheduleRetentionJobs(): Promise<void> {
    const policies = await this.getRetentionPolicies();

    for (const policy of policies) {
      if (!policy.nextRunAt || policy.nextRunAt <= new Date()) {
        await this.dataQueue.add(
          'retention-policy',
          { policyId: policy.id },
          {
            delay: 0,
            attempts: 3,
            backoff: { type: 'exponential', delay: 60000 },
          }
        );
      }
    }
  }

  // ==================== Data Classification ====================

  classifyData(data: Record<string, any>): DataClassification {
    const criticalFields = ['ssn', 'taxId', 'bankAccount', 'cardNumber', 'cvv'];
    const confidentialFields = ['email', 'phone', 'address', 'dob', 'salary'];
    const internalFields = ['userId', 'createdAt', 'updatedAt', 'status'];

    const keys = Object.keys(data).map((k) => k.toLowerCase());

    if (criticalFields.some((f) => keys.some((k) => k.includes(f)))) {
      return DataClassification.RESTRICTED;
    }

    if (confidentialFields.some((f) => keys.some((k) => k.includes(f)))) {
      return DataClassification.CONFIDENTIAL;
    }

    if (internalFields.some((f) => keys.some((k) => k.includes(f)))) {
      return DataClassification.INTERNAL;
    }

    return DataClassification.PUBLIC;
  }

  // ==================== Secure Hash ====================

  secureHash(data: string, salt?: string): string {
    const hash = createHash('sha256');
    hash.update(data);
    if (salt) hash.update(salt);
    return hash.digest('hex');
  }

  generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }
}

export default DataProtectionService;
