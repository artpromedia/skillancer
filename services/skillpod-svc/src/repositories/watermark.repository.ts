/**
 * @module @skillancer/skillpod-svc/repositories/watermark
 * Watermark repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PrismaClient } from '@prisma/client';
import type { Decimal, JsonValue } from '@prisma/client/runtime/library';

// =============================================================================
// TYPES
// =============================================================================

export type DetectionSourceType =
  | 'UPLOADED_IMAGE'
  | 'WEB_CRAWL'
  | 'MANUAL_REPORT'
  | 'AUTOMATED_SCAN'
  | 'THIRD_PARTY';

export type InvestigationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'CONFIRMED_LEAK'
  | 'FALSE_POSITIVE'
  | 'INCONCLUSIVE'
  | 'RESOLVED';

export type WatermarkPattern = 'TILED' | 'CORNER' | 'CENTER' | 'BORDER';
export type WatermarkMethod = 'LSB' | 'DCT' | 'DWT';
export type WatermarkStrength = 'LOW' | 'MEDIUM' | 'HIGH';
export type WatermarkContentType =
  | 'USER_EMAIL'
  | 'SESSION_ID'
  | 'TIMESTAMP'
  | 'CUSTOM_TEXT'
  | 'IP_ADDRESS';
export type WatermarkEncodeField =
  | 'USER_ID'
  | 'SESSION_ID'
  | 'TENANT_ID'
  | 'TIMESTAMP'
  | 'SEQUENCE';

export interface VisibleWatermarkConfig {
  pattern: WatermarkPattern;
  content: WatermarkContentType[];
  customText?: string;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  backgroundColor?: string;
  rotation: number;
  spacing: number;
  margin: number;
  includeCompanyLogo: boolean;
  logoUrl?: string;
}

export interface InvisibleWatermarkConfig {
  method: WatermarkMethod;
  strength: WatermarkStrength;
  redundancy: number;
  encodeFields: WatermarkEncodeField[];
}

export interface WatermarkConfiguration {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  visibleEnabled: boolean;
  visibleConfig: JsonValue;
  invisibleEnabled: boolean;
  invisibleConfig: JsonValue;
  applyToScreenShare: boolean;
  applyToRecordings: boolean;
  applyToExports: boolean;
  excludedApplications: string[];
  excludedUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WatermarkPayload {
  userId: string;
  userEmail: string;
  sessionId: string;
  tenantId: string;
  podId: string;
  timestamp: number;
  sequenceNumber: number;
  ipAddress?: string;
}

export interface WatermarkInstance {
  id: string;
  configurationId: string;
  sessionId: string;
  payload: JsonValue;
  visibleHash: string | null;
  invisibleKey: string;
  generatedAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface WatermarkDetection {
  id: string;
  sourceType: DetectionSourceType;
  sourceUrl: string | null;
  sourceDescription: string | null;
  watermarkInstanceId: string | null;
  detectedPayload: JsonValue;
  confidence: Decimal;
  detectionMethod: string;
  extractedUserId: string | null;
  extractedSessionId: string | null;
  extractedTimestamp: Date | null;
  imageHash: string | null;
  imageDimensions: string | null;
  manipulationDetected: boolean;
  manipulationTypes: string[];
  investigationStatus: InvestigationStatus;
  investigatedBy: string | null;
  investigationNotes: string | null;
  reportedBy: string | null;
  reportedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Input types
export interface CreateConfigurationInput {
  tenantId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  visibleEnabled?: boolean;
  visibleConfig: VisibleWatermarkConfig;
  invisibleEnabled?: boolean;
  invisibleConfig: InvisibleWatermarkConfig;
  applyToScreenShare?: boolean;
  applyToRecordings?: boolean;
  applyToExports?: boolean;
  excludedApplications?: string[];
  excludedUrls?: string[];
}

export interface UpdateConfigurationInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
  visibleEnabled?: boolean;
  visibleConfig?: VisibleWatermarkConfig;
  invisibleEnabled?: boolean;
  invisibleConfig?: InvisibleWatermarkConfig;
  applyToScreenShare?: boolean;
  applyToRecordings?: boolean;
  applyToExports?: boolean;
  excludedApplications?: string[];
  excludedUrls?: string[];
}

export interface CreateInstanceInput {
  configurationId: string;
  sessionId: string;
  payload: WatermarkPayload;
  visibleHash?: string;
  invisibleKey: string;
  generatedAt: Date;
  expiresAt?: Date;
  isActive?: boolean;
}

export interface CreateDetectionInput {
  sourceType: DetectionSourceType;
  sourceUrl?: string;
  sourceDescription?: string;
  watermarkInstanceId?: string;
  detectedPayload?: WatermarkPayload;
  confidence: number;
  detectionMethod: string;
  extractedUserId?: string;
  extractedSessionId?: string;
  extractedTimestamp?: Date;
  imageHash?: string;
  imageDimensions?: string;
  manipulationDetected?: boolean;
  manipulationTypes?: string[];
  investigationStatus?: InvestigationStatus;
  reportedBy?: string;
  reportedAt?: Date;
}

export interface UpdateDetectionInput {
  investigationStatus?: InvestigationStatus;
  investigatedBy?: string;
  investigationNotes?: string;
}

export interface ConfigurationListFilter {
  tenantId: string;
  isDefault?: boolean;
  visibleEnabled?: boolean;
  invisibleEnabled?: boolean;
}

export interface DetectionListFilter {
  tenantId?: string;
  watermarkInstanceId?: string;
  extractedUserId?: string;
  extractedSessionId?: string;
  investigationStatus?: InvestigationStatus;
  sourceType?: DetectionSourceType;
  startDate?: Date;
  endDate?: Date;
}

export interface DetectionListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'createdAt' | 'confidence' | 'investigationStatus';
  orderDirection?: 'asc' | 'desc';
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface WatermarkRepository {
  // Configurations
  createConfiguration(input: CreateConfigurationInput): Promise<WatermarkConfiguration>;
  findConfigurationById(id: string): Promise<WatermarkConfiguration | null>;
  findConfigurationsByTenant(tenantId: string): Promise<WatermarkConfiguration[]>;
  findDefaultConfiguration(tenantId: string): Promise<WatermarkConfiguration | null>;
  updateConfiguration(id: string, input: UpdateConfigurationInput): Promise<WatermarkConfiguration>;
  deleteConfiguration(id: string): Promise<void>;

  // Instances
  createInstance(input: CreateInstanceInput): Promise<WatermarkInstance>;
  findInstanceById(id: string): Promise<WatermarkInstance | null>;
  findInstanceBySession(sessionId: string): Promise<WatermarkInstance | null>;
  findInstanceByPayload(payload: WatermarkPayload): Promise<WatermarkInstance | null>;
  findInstanceByInvisibleKey(key: string): Promise<WatermarkInstance | null>;
  deactivateInstance(id: string): Promise<void>;
  getActiveInstancesForTenant(tenantId: string): Promise<WatermarkInstance[]>;

  // Detections
  createDetection(input: CreateDetectionInput): Promise<WatermarkDetection>;
  findDetectionById(id: string): Promise<WatermarkDetection | null>;
  findDetections(
    filter: DetectionListFilter,
    options?: DetectionListOptions
  ): Promise<{ detections: WatermarkDetection[]; total: number }>;
  updateDetection(id: string, input: UpdateDetectionInput): Promise<WatermarkDetection>;

  // Stats
  getDetectionStats(tenantId: string): Promise<{
    total: number;
    confirmed: number;
    pending: number;
    falsePositives: number;
  }>;

  // Encryption keys
  getTenantEncryptionKey(tenantId: string): Promise<string | null>;
  getAllTenantEncryptionKeys(): Promise<string[]>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createWatermarkRepository(prisma: PrismaClient): WatermarkRepository {
  // =========================================================================
  // CONFIGURATIONS
  // =========================================================================

  async function createConfiguration(
    input: CreateConfigurationInput
  ): Promise<WatermarkConfiguration> {
    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.watermarkConfiguration.updateMany({
        where: { tenantId: input.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.watermarkConfiguration.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,
        visibleEnabled: input.visibleEnabled ?? true,
        visibleConfig: input.visibleConfig as object,
        invisibleEnabled: input.invisibleEnabled ?? true,
        invisibleConfig: input.invisibleConfig as object,
        applyToScreenShare: input.applyToScreenShare ?? true,
        applyToRecordings: input.applyToRecordings ?? true,
        applyToExports: input.applyToExports ?? true,
        excludedApplications: input.excludedApplications ?? [],
        excludedUrls: input.excludedUrls ?? [],
      },
    });
  }

  async function findConfigurationById(id: string): Promise<WatermarkConfiguration | null> {
    return prisma.watermarkConfiguration.findUnique({
      where: { id },
    });
  }

  async function findConfigurationsByTenant(tenantId: string): Promise<WatermarkConfiguration[]> {
    return prisma.watermarkConfiguration.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async function findDefaultConfiguration(
    tenantId: string
  ): Promise<WatermarkConfiguration | null> {
    return prisma.watermarkConfiguration.findFirst({
      where: { tenantId, isDefault: true },
    });
  }

  async function updateConfiguration(
    id: string,
    input: UpdateConfigurationInput
  ): Promise<WatermarkConfiguration> {
    const existing = await prisma.watermarkConfiguration.findUnique({ where: { id } });
    if (!existing) throw new Error('Configuration not found');

    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.watermarkConfiguration.updateMany({
        where: { tenantId: existing.tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.isDefault !== undefined) data.isDefault = input.isDefault;
    if (input.visibleEnabled !== undefined) data.visibleEnabled = input.visibleEnabled;
    if (input.visibleConfig !== undefined) data.visibleConfig = input.visibleConfig as object;
    if (input.invisibleEnabled !== undefined) data.invisibleEnabled = input.invisibleEnabled;
    if (input.invisibleConfig !== undefined) data.invisibleConfig = input.invisibleConfig as object;
    if (input.applyToScreenShare !== undefined) data.applyToScreenShare = input.applyToScreenShare;
    if (input.applyToRecordings !== undefined) data.applyToRecordings = input.applyToRecordings;
    if (input.applyToExports !== undefined) data.applyToExports = input.applyToExports;
    if (input.excludedApplications !== undefined)
      data.excludedApplications = input.excludedApplications;
    if (input.excludedUrls !== undefined) data.excludedUrls = input.excludedUrls;

    return prisma.watermarkConfiguration.update({
      where: { id },
      data,
    });
  }

  async function deleteConfiguration(id: string): Promise<void> {
    await prisma.watermarkConfiguration.delete({ where: { id } });
  }

  // =========================================================================
  // INSTANCES
  // =========================================================================

  async function createInstance(input: CreateInstanceInput): Promise<WatermarkInstance> {
    return prisma.watermarkInstance.create({
      data: {
        configurationId: input.configurationId,
        sessionId: input.sessionId,
        payload: input.payload as object,
        visibleHash: input.visibleHash,
        invisibleKey: input.invisibleKey,
        generatedAt: input.generatedAt,
        expiresAt: input.expiresAt,
        isActive: input.isActive ?? true,
      },
    });
  }

  async function findInstanceById(id: string): Promise<WatermarkInstance | null> {
    return prisma.watermarkInstance.findUnique({
      where: { id },
    });
  }

  async function findInstanceBySession(sessionId: string): Promise<WatermarkInstance | null> {
    return prisma.watermarkInstance.findFirst({
      where: { sessionId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function findInstanceByPayload(
    payload: WatermarkPayload
  ): Promise<WatermarkInstance | null> {
    // Find by session ID and timestamp
    const instances = await prisma.watermarkInstance.findMany({
      where: { sessionId: payload.sessionId },
    });

    for (const instance of instances) {
      const instancePayload = instance.payload as unknown as WatermarkPayload;
      if (
        instancePayload.userId === payload.userId &&
        instancePayload.timestamp === payload.timestamp &&
        instancePayload.sequenceNumber === payload.sequenceNumber
      ) {
        return instance;
      }
    }

    return null;
  }

  async function findInstanceByInvisibleKey(key: string): Promise<WatermarkInstance | null> {
    return prisma.watermarkInstance.findFirst({
      where: { invisibleKey: key },
    });
  }

  async function deactivateInstance(id: string): Promise<void> {
    await prisma.watermarkInstance.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async function getActiveInstancesForTenant(tenantId: string): Promise<WatermarkInstance[]> {
    return prisma.watermarkInstance.findMany({
      where: {
        isActive: true,
        configuration: { tenantId },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // =========================================================================
  // DETECTIONS
  // =========================================================================

  async function createDetection(input: CreateDetectionInput): Promise<WatermarkDetection> {
    return prisma.watermarkDetection.create({
      data: {
        sourceType: input.sourceType,
        sourceUrl: input.sourceUrl,
        sourceDescription: input.sourceDescription,
        watermarkInstanceId: input.watermarkInstanceId,
        detectedPayload: input.detectedPayload as object,
        confidence: input.confidence,
        detectionMethod: input.detectionMethod,
        extractedUserId: input.extractedUserId,
        extractedSessionId: input.extractedSessionId,
        extractedTimestamp: input.extractedTimestamp,
        imageHash: input.imageHash,
        imageDimensions: input.imageDimensions,
        manipulationDetected: input.manipulationDetected ?? false,
        manipulationTypes: input.manipulationTypes ?? [],
        investigationStatus: input.investigationStatus ?? 'PENDING',
        reportedBy: input.reportedBy,
        reportedAt: input.reportedAt,
      },
    });
  }

  async function findDetectionById(id: string): Promise<WatermarkDetection | null> {
    return prisma.watermarkDetection.findUnique({
      where: { id },
    });
  }

  async function findDetections(
    filter: DetectionListFilter,
    options: DetectionListOptions = {}
  ): Promise<{ detections: WatermarkDetection[]; total: number }> {
    const { page = 1, limit = 20, orderBy = 'createdAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filter.watermarkInstanceId) where.watermarkInstanceId = filter.watermarkInstanceId;
    if (filter.extractedUserId) where.extractedUserId = filter.extractedUserId;
    if (filter.extractedSessionId) where.extractedSessionId = filter.extractedSessionId;
    if (filter.investigationStatus) where.investigationStatus = filter.investigationStatus;
    if (filter.sourceType) where.sourceType = filter.sourceType;
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) (where.createdAt as Record<string, unknown>).gte = filter.startDate;
      if (filter.endDate) (where.createdAt as Record<string, unknown>).lte = filter.endDate;
    }

    // Filter by tenant through watermark instance
    if (filter.tenantId) {
      where.watermarkInstance = {
        configuration: { tenantId: filter.tenantId },
      };
    }

    const [detections, total] = await Promise.all([
      prisma.watermarkDetection.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        skip,
        take: limit,
      }),
      prisma.watermarkDetection.count({ where }),
    ]);

    return { detections, total };
  }

  async function updateDetection(
    id: string,
    input: UpdateDetectionInput
  ): Promise<WatermarkDetection> {
    return prisma.watermarkDetection.update({
      where: { id },
      data: input,
    });
  }

  // =========================================================================
  // STATS
  // =========================================================================

  async function getDetectionStats(tenantId: string): Promise<{
    total: number;
    confirmed: number;
    pending: number;
    falsePositives: number;
  }> {
    const whereBase = {
      watermarkInstance: {
        configuration: { tenantId },
      },
    };

    const [total, confirmed, pending, falsePositives] = await Promise.all([
      prisma.watermarkDetection.count({ where: whereBase }),
      prisma.watermarkDetection.count({
        where: { ...whereBase, investigationStatus: 'CONFIRMED_LEAK' },
      }),
      prisma.watermarkDetection.count({
        where: { ...whereBase, investigationStatus: 'PENDING' },
      }),
      prisma.watermarkDetection.count({
        where: { ...whereBase, investigationStatus: 'FALSE_POSITIVE' },
      }),
    ]);

    return { total, confirmed, pending, falsePositives };
  }

  // =========================================================================
  // ENCRYPTION KEYS
  // =========================================================================

  async function getTenantEncryptionKey(tenantId: string): Promise<string | null> {
    // SECURITY: WATERMARK_MASTER_KEY is required - no fallback allowed
    const crypto = await import('crypto');
    const masterKey = process.env.WATERMARK_MASTER_KEY;
    if (!masterKey) {
      throw new Error(
        'WATERMARK_MASTER_KEY environment variable is required. ' +
        'Please set a secure master key for watermark encryption.'
      );
    }
    if (masterKey.length < 32) {
      throw new Error(
        'WATERMARK_MASTER_KEY must be at least 32 characters long for secure encryption.'
      );
    }
    return crypto.createHash('sha256').update(`${tenantId}:${masterKey}`).digest('hex');
  }

  async function getAllTenantEncryptionKeys(): Promise<string[]> {
    // Get all tenants and generate their keys
    const tenants = await prisma.tenant.findMany({
      select: { id: true },
    });

    const keys: string[] = [];
    for (const tenant of tenants) {
      const key = await getTenantEncryptionKey(tenant.id);
      if (key) keys.push(key);
    }

    return keys;
  }

  // Return repository interface
  return {
    createConfiguration,
    findConfigurationById,
    findConfigurationsByTenant,
    findDefaultConfiguration,
    updateConfiguration,
    deleteConfiguration,
    createInstance,
    findInstanceById,
    findInstanceBySession,
    findInstanceByPayload,
    findInstanceByInvisibleKey,
    deactivateInstance,
    getActiveInstancesForTenant,
    createDetection,
    findDetectionById,
    findDetections,
    updateDetection,
    getDetectionStats,
    getTenantEncryptionKey,
    getAllTenantEncryptionKeys,
  };
}
