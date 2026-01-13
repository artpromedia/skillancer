/**
 * @module @skillancer/skillpod-svc/repositories/recording
 * Session Recording repository for database operations
 *
 * Note: This file contains type mismatches due to exactOptionalPropertyTypes.
 * Prisma uses `null` for optional fields while our interfaces use `undefined`.
 * This is acceptable as the values are equivalent at runtime.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PrismaClient } from '@/types/prisma-shim.js';
import type { Decimal, JsonValue } from '@prisma/client/runtime/library';

// =============================================================================
// TYPES
// =============================================================================

export type RecordingStatus =
  | 'RECORDING'
  | 'STOPPED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DELETED';

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type OcrStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export type MarkerType =
  | 'SESSION_START'
  | 'SESSION_END'
  | 'APPLICATION_OPEN'
  | 'APPLICATION_CLOSE'
  | 'FILE_ACCESS'
  | 'CLIPBOARD_ACTIVITY'
  | 'IDLE_START'
  | 'IDLE_END'
  | 'SECURITY_EVENT'
  | 'USER_ADDED'
  | 'ERROR';

export type RecordingAccessType = 'VIEW' | 'DOWNLOAD' | 'SHARE' | 'EXPORT' | 'DELETE';

export interface SessionRecording {
  id: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  status: RecordingStatus;
  storageLocation: string | null;
  storageBucket: string | null;
  storageKey: string | null;
  encryptionKeyId: string | null;
  format: string;
  codec: string;
  resolution: string | null;
  frameRate: number | null;
  durationSeconds: number | null;
  fileSizeBytes: bigint | null;
  startedAt: Date;
  endedAt: Date | null;
  processingStatus: ProcessingStatus;
  processedAt: Date | null;
  thumbnailUrl: string | null;
  ocrStatus: OcrStatus;
  ocrCompletedAt: Date | null;
  retentionPolicy: string | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
  viewCount: number;
  lastViewedAt: Date | null;
  lastViewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordingChunk {
  id: string;
  recordingId: string;
  chunkIndex: number;
  startOffset: number;
  durationSeconds: number;
  storageKey: string;
  fileSizeBytes: number;
  uploadedAt: Date;
  createdAt: Date;
}

export interface RecordingMarker {
  id: string;
  recordingId: string;
  markerType: MarkerType;
  timestamp: number;
  label: string | null;
  description: string | null;
  metadata: JsonValue;
  isAutoDetected: boolean;
  detectionSource: string | null;
  confidence: Decimal | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface RecordingOcrFrame {
  id: string;
  recordingId: string;
  timestamp: number;
  frameNumber: number;
  extractedText: string;
  textConfidence: Decimal;
  textRegions: JsonValue;
  elasticsearchId: string | null;
  indexedAt: Date | null;
  createdAt: Date;
}

export interface TextRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface RecordingAccessLog {
  id: string;
  recordingId: string;
  accessType: RecordingAccessType;
  accessedBy: string;
  ipAddress: string | null;
  userAgent: string | null;
  playbackStartTime: number | null;
  playbackEndTime: number | null;
  playbackDuration: number | null;
  accessReason: string | null;
  createdAt: Date;
}

export interface RecordingRetentionPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  retentionDays: number;
  complianceTags: string[];
  autoDeleteEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Input types
export interface CreateRecordingInput {
  sessionId: string;
  tenantId: string;
  userId: string;
  format?: string;
  codec?: string;
  resolution?: string;
  frameRate?: number;
  encryptionKeyId?: string;
  retentionPolicy?: string;
}

export interface UpdateRecordingInput {
  status?: RecordingStatus;
  storageLocation?: string;
  storageBucket?: string;
  storageKey?: string;
  encryptionKeyId?: string;
  durationSeconds?: number;
  fileSizeBytes?: bigint;
  endedAt?: Date;
  processingStatus?: ProcessingStatus;
  processedAt?: Date;
  thumbnailUrl?: string;
  ocrStatus?: OcrStatus;
  ocrCompletedAt?: Date;
  retentionPolicy?: string;
  expiresAt?: Date;
  deletedAt?: Date;
  viewCount?: number;
  lastViewedAt?: Date;
  lastViewedBy?: string;
}

export interface CreateChunkInput {
  recordingId: string;
  chunkIndex: number;
  startOffset: number;
  durationSeconds: number;
  storageKey: string;
  fileSizeBytes: number;
}

export interface CreateMarkerInput {
  recordingId: string;
  markerType: MarkerType;
  timestamp: number;
  label?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  isAutoDetected?: boolean;
  detectionSource?: string;
  confidence?: number;
  createdBy?: string;
}

export interface CreateOcrFrameInput {
  recordingId: string;
  timestamp: number;
  frameNumber: number;
  extractedText: string;
  textConfidence: number;
  textRegions?: TextRegion[];
  elasticsearchId?: string;
}

export interface CreateAccessLogInput {
  recordingId: string;
  accessType: RecordingAccessType;
  accessedBy: string;
  ipAddress?: string;
  userAgent?: string;
  playbackStartTime?: number;
  playbackEndTime?: number;
  playbackDuration?: number;
  accessReason?: string;
}

export interface CreateRetentionPolicyInput {
  tenantId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  retentionDays: number;
  complianceTags?: string[];
  autoDeleteEnabled?: boolean;
}

export interface RecordingListFilter {
  tenantId: string;
  sessionId?: string;
  userId?: string;
  status?: RecordingStatus;
  processingStatus?: ProcessingStatus;
  ocrStatus?: OcrStatus;
  startDate?: Date;
  endDate?: Date;
  expiringBefore?: Date;
}

export interface RecordingListOptions {
  page?: number;
  limit?: number;
  orderBy?: 'startedAt' | 'createdAt' | 'durationSeconds' | 'fileSizeBytes';
  orderDirection?: 'asc' | 'desc';
  includeChunks?: boolean;
  includeMarkers?: boolean;
}

export interface RecordingWithRelations extends SessionRecording {
  chunks?: RecordingChunk[];
  markers?: RecordingMarker[];
  ocrFrames?: RecordingOcrFrame[];
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface RecordingRepository {
  // Recordings
  create(input: CreateRecordingInput): Promise<SessionRecording>;
  findById(id: string): Promise<RecordingWithRelations | null>;
  findBySessionId(sessionId: string): Promise<SessionRecording[]>;
  findMany(
    filter: RecordingListFilter,
    options?: RecordingListOptions
  ): Promise<{
    recordings: RecordingWithRelations[];
    total: number;
  }>;
  update(id: string, input: UpdateRecordingInput): Promise<SessionRecording>;
  softDelete(id: string): Promise<void>;
  getExpiredRecordings(before: Date): Promise<SessionRecording[]>;

  // Chunks
  createChunk(input: CreateChunkInput): Promise<RecordingChunk>;
  getChunks(recordingId: string): Promise<RecordingChunk[]>;
  getChunkByIndex(recordingId: string, index: number): Promise<RecordingChunk | null>;

  // Markers
  createMarker(input: CreateMarkerInput): Promise<RecordingMarker>;
  getMarkers(recordingId: string): Promise<RecordingMarker[]>;
  getMarkersByType(recordingId: string, type: MarkerType): Promise<RecordingMarker[]>;
  deleteMarker(id: string): Promise<void>;

  // OCR Frames
  createOcrFrame(input: CreateOcrFrameInput): Promise<RecordingOcrFrame>;
  createOcrFramesBatch(inputs: CreateOcrFrameInput[]): Promise<number>;
  getOcrFrames(recordingId: string): Promise<RecordingOcrFrame[]>;
  getOcrFrameByTimestamp(recordingId: string, timestamp: number): Promise<RecordingOcrFrame | null>;
  searchOcrText(tenantId: string, query: string, limit?: number): Promise<RecordingOcrFrame[]>;

  // Access Logs
  createAccessLog(input: CreateAccessLogInput): Promise<RecordingAccessLog>;
  getAccessLogs(recordingId: string): Promise<RecordingAccessLog[]>;
  getUserAccessHistory(userId: string, limit?: number): Promise<RecordingAccessLog[]>;

  // Retention Policies
  createRetentionPolicy(input: CreateRetentionPolicyInput): Promise<RecordingRetentionPolicy>;
  getRetentionPolicies(tenantId: string): Promise<RecordingRetentionPolicy[]>;
  getDefaultRetentionPolicy(tenantId: string): Promise<RecordingRetentionPolicy | null>;
  updateRetentionPolicy(
    id: string,
    input: Partial<CreateRetentionPolicyInput>
  ): Promise<RecordingRetentionPolicy>;
  deleteRetentionPolicy(id: string): Promise<void>;

  // Stats
  countByTenant(tenantId: string): Promise<number>;
  getTotalStorageByTenant(tenantId: string): Promise<bigint>;
  getRecordingStats(tenantId: string): Promise<{
    total: number;
    recording: number;
    completed: number;
    failed: number;
    totalDuration: number;
    totalSize: bigint;
  }>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createRecordingRepository(prisma: PrismaClient): RecordingRepository {
  // =========================================================================
  // RECORDINGS
  // =========================================================================

  async function create(input: CreateRecordingInput): Promise<SessionRecording> {
    return prisma.sessionRecording.create({
      data: {
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        userId: input.userId,
        format: input.format ?? 'webm',
        codec: input.codec ?? 'vp9',
        resolution: input.resolution,
        frameRate: input.frameRate,
        encryptionKeyId: input.encryptionKeyId,
        retentionPolicy: input.retentionPolicy,
        startedAt: new Date(),
        status: 'RECORDING',
        processingStatus: 'PENDING',
        ocrStatus: 'PENDING',
      },
    });
  }

  async function findById(id: string): Promise<RecordingWithRelations | null> {
    return prisma.sessionRecording.findUnique({
      where: { id },
      include: {
        chunks: { orderBy: { chunkIndex: 'asc' } },
        markers: { orderBy: { timestamp: 'asc' } },
        ocrFrames: { orderBy: { timestamp: 'asc' } },
      },
    });
  }

  async function findBySessionId(sessionId: string): Promise<SessionRecording[]> {
    return prisma.sessionRecording.findMany({
      where: { sessionId, deletedAt: null },
      orderBy: { startedAt: 'desc' },
    });
  }

  async function findMany(
    filter: RecordingListFilter,
    options: RecordingListOptions = {}
  ): Promise<{
    recordings: RecordingWithRelations[];
    total: number;
  }> {
    const { page = 1, limit = 20, orderBy = 'startedAt', orderDirection = 'desc' } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenantId: filter.tenantId,
      deletedAt: null,
    };

    if (filter.sessionId) where.sessionId = filter.sessionId;
    if (filter.userId) where.userId = filter.userId;
    if (filter.status) where.status = filter.status;
    if (filter.processingStatus) where.processingStatus = filter.processingStatus;
    if (filter.ocrStatus) where.ocrStatus = filter.ocrStatus;
    if (filter.startDate || filter.endDate) {
      where.startedAt = {};
      if (filter.startDate) (where.startedAt as Record<string, unknown>).gte = filter.startDate;
      if (filter.endDate) (where.startedAt as Record<string, unknown>).lte = filter.endDate;
    }
    if (filter.expiringBefore) {
      where.expiresAt = { lte: filter.expiringBefore };
    }

    const include: Record<string, unknown> = {};
    if (options.includeChunks) include.chunks = { orderBy: { chunkIndex: 'asc' } };
    if (options.includeMarkers) include.markers = { orderBy: { timestamp: 'asc' } };

    const [recordings, total] = await Promise.all([
      prisma.sessionRecording.findMany({
        where,
        include: Object.keys(include).length > 0 ? include : undefined,
        orderBy: { [orderBy]: orderDirection },
        skip,
        take: limit,
      }),
      prisma.sessionRecording.count({ where }),
    ]);

    return { recordings, total };
  }

  async function update(id: string, input: UpdateRecordingInput): Promise<SessionRecording> {
    return prisma.sessionRecording.update({
      where: { id },
      data: input,
    });
  }

  async function softDelete(id: string): Promise<void> {
    await prisma.sessionRecording.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
  }

  async function getExpiredRecordings(before: Date): Promise<SessionRecording[]> {
    return prisma.sessionRecording.findMany({
      where: {
        expiresAt: { lte: before },
        deletedAt: null,
        status: { not: 'DELETED' },
      },
    });
  }

  // =========================================================================
  // CHUNKS
  // =========================================================================

  async function createChunk(input: CreateChunkInput): Promise<RecordingChunk> {
    return prisma.recordingChunk.create({
      data: {
        recordingId: input.recordingId,
        chunkIndex: input.chunkIndex,
        startOffset: input.startOffset,
        durationSeconds: input.durationSeconds,
        storageKey: input.storageKey,
        fileSizeBytes: input.fileSizeBytes,
        uploadedAt: new Date(),
      },
    });
  }

  async function getChunks(recordingId: string): Promise<RecordingChunk[]> {
    return prisma.recordingChunk.findMany({
      where: { recordingId },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  async function getChunkByIndex(
    recordingId: string,
    index: number
  ): Promise<RecordingChunk | null> {
    return prisma.recordingChunk.findUnique({
      where: {
        recordingId_chunkIndex: { recordingId, chunkIndex: index },
      },
    });
  }

  // =========================================================================
  // MARKERS
  // =========================================================================

  async function createMarker(input: CreateMarkerInput): Promise<RecordingMarker> {
    return prisma.recordingMarker.create({
      data: {
        recordingId: input.recordingId,
        markerType: input.markerType,
        timestamp: input.timestamp,
        label: input.label,
        description: input.description,
        metadata: input.metadata as object,
        isAutoDetected: input.isAutoDetected ?? false,
        detectionSource: input.detectionSource,
        confidence: input.confidence,
        createdBy: input.createdBy,
      },
    });
  }

  async function getMarkers(recordingId: string): Promise<RecordingMarker[]> {
    return prisma.recordingMarker.findMany({
      where: { recordingId },
      orderBy: { timestamp: 'asc' },
    });
  }

  async function getMarkersByType(
    recordingId: string,
    type: MarkerType
  ): Promise<RecordingMarker[]> {
    return prisma.recordingMarker.findMany({
      where: { recordingId, markerType: type },
      orderBy: { timestamp: 'asc' },
    });
  }

  async function deleteMarker(id: string): Promise<void> {
    await prisma.recordingMarker.delete({ where: { id } });
  }

  // =========================================================================
  // OCR FRAMES
  // =========================================================================

  async function createOcrFrame(input: CreateOcrFrameInput): Promise<RecordingOcrFrame> {
    return prisma.recordingOcrFrame.create({
      data: {
        recordingId: input.recordingId,
        timestamp: input.timestamp,
        frameNumber: input.frameNumber,
        extractedText: input.extractedText,
        textConfidence: input.textConfidence,
        textRegions: input.textRegions as object,
        elasticsearchId: input.elasticsearchId,
        indexedAt: input.elasticsearchId ? new Date() : null,
      },
    });
  }

  async function createOcrFramesBatch(inputs: CreateOcrFrameInput[]): Promise<number> {
    const result = await prisma.recordingOcrFrame.createMany({
      data: inputs.map((input) => ({
        recordingId: input.recordingId,
        timestamp: input.timestamp,
        frameNumber: input.frameNumber,
        extractedText: input.extractedText,
        textConfidence: input.textConfidence,
        textRegions: input.textRegions as object,
        elasticsearchId: input.elasticsearchId,
        indexedAt: input.elasticsearchId ? new Date() : null,
      })),
    });
    return result.count;
  }

  async function getOcrFrames(recordingId: string): Promise<RecordingOcrFrame[]> {
    return prisma.recordingOcrFrame.findMany({
      where: { recordingId },
      orderBy: { timestamp: 'asc' },
    });
  }

  async function getOcrFrameByTimestamp(
    recordingId: string,
    timestamp: number
  ): Promise<RecordingOcrFrame | null> {
    return prisma.recordingOcrFrame.findFirst({
      where: { recordingId, timestamp },
    });
  }

  async function searchOcrText(
    tenantId: string,
    query: string,
    limit = 100
  ): Promise<RecordingOcrFrame[]> {
    // Basic text search - in production, use Elasticsearch
    return prisma.recordingOcrFrame.findMany({
      where: {
        recording: { tenantId, deletedAt: null },
        extractedText: { contains: query, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // =========================================================================
  // ACCESS LOGS
  // =========================================================================

  async function createAccessLog(input: CreateAccessLogInput): Promise<RecordingAccessLog> {
    // Also update the recording's view tracking
    if (input.accessType === 'VIEW') {
      await prisma.sessionRecording.update({
        where: { id: input.recordingId },
        data: {
          viewCount: { increment: 1 },
          lastViewedAt: new Date(),
          lastViewedBy: input.accessedBy,
        },
      });
    }

    return prisma.recordingAccessLog.create({
      data: {
        recordingId: input.recordingId,
        accessType: input.accessType,
        accessedBy: input.accessedBy,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        playbackStartTime: input.playbackStartTime,
        playbackEndTime: input.playbackEndTime,
        playbackDuration: input.playbackDuration,
        accessReason: input.accessReason,
      },
    });
  }

  async function getAccessLogs(recordingId: string): Promise<RecordingAccessLog[]> {
    return prisma.recordingAccessLog.findMany({
      where: { recordingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function getUserAccessHistory(userId: string, limit = 100): Promise<RecordingAccessLog[]> {
    return prisma.recordingAccessLog.findMany({
      where: { accessedBy: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // =========================================================================
  // RETENTION POLICIES
  // =========================================================================

  async function createRetentionPolicy(
    input: CreateRetentionPolicyInput
  ): Promise<RecordingRetentionPolicy> {
    // If this is set as default, unset other defaults
    if (input.isDefault) {
      await prisma.recordingRetentionPolicy.updateMany({
        where: { tenantId: input.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.recordingRetentionPolicy.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,
        retentionDays: input.retentionDays,
        complianceTags: input.complianceTags ?? [],
        autoDeleteEnabled: input.autoDeleteEnabled ?? true,
      },
    });
  }

  async function getRetentionPolicies(tenantId: string): Promise<RecordingRetentionPolicy[]> {
    return prisma.recordingRetentionPolicy.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async function getDefaultRetentionPolicy(
    tenantId: string
  ): Promise<RecordingRetentionPolicy | null> {
    return prisma.recordingRetentionPolicy.findFirst({
      where: { tenantId, isDefault: true },
    });
  }

  async function updateRetentionPolicy(
    id: string,
    input: Partial<CreateRetentionPolicyInput>
  ): Promise<RecordingRetentionPolicy> {
    const policy = await prisma.recordingRetentionPolicy.findUnique({ where: { id } });
    if (!policy) throw new Error('Retention policy not found');

    // If setting as default, unset other defaults
    if (input.isDefault) {
      await prisma.recordingRetentionPolicy.updateMany({
        where: { tenantId: policy.tenantId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.recordingRetentionPolicy.update({
      where: { id },
      data: input,
    });
  }

  async function deleteRetentionPolicy(id: string): Promise<void> {
    await prisma.recordingRetentionPolicy.delete({ where: { id } });
  }

  // =========================================================================
  // STATS
  // =========================================================================

  async function countByTenant(tenantId: string): Promise<number> {
    return prisma.sessionRecording.count({
      where: { tenantId, deletedAt: null },
    });
  }

  async function getTotalStorageByTenant(tenantId: string): Promise<bigint> {
    const result = await prisma.sessionRecording.aggregate({
      where: { tenantId, deletedAt: null },
      _sum: { fileSizeBytes: true },
    });
    return result._sum.fileSizeBytes ?? BigInt(0);
  }

  async function getRecordingStats(tenantId: string): Promise<{
    total: number;
    recording: number;
    completed: number;
    failed: number;
    totalDuration: number;
    totalSize: bigint;
  }> {
    const [total, recording, completed, failed, aggregations] = await Promise.all([
      prisma.sessionRecording.count({ where: { tenantId, deletedAt: null } }),
      prisma.sessionRecording.count({ where: { tenantId, status: 'RECORDING', deletedAt: null } }),
      prisma.sessionRecording.count({ where: { tenantId, status: 'COMPLETED', deletedAt: null } }),
      prisma.sessionRecording.count({ where: { tenantId, status: 'FAILED', deletedAt: null } }),
      prisma.sessionRecording.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { durationSeconds: true, fileSizeBytes: true },
      }),
    ]);

    return {
      total,
      recording,
      completed,
      failed,
      totalDuration: aggregations._sum.durationSeconds ?? 0,
      totalSize: aggregations._sum.fileSizeBytes ?? BigInt(0),
    };
  }

  // Return repository interface
  return {
    create,
    findById,
    findBySessionId,
    findMany,
    update,
    softDelete,
    getExpiredRecordings,
    createChunk,
    getChunks,
    getChunkByIndex,
    createMarker,
    getMarkers,
    getMarkersByType,
    deleteMarker,
    createOcrFrame,
    createOcrFramesBatch,
    getOcrFrames,
    getOcrFrameByTimestamp,
    searchOcrText,
    createAccessLog,
    getAccessLogs,
    getUserAccessHistory,
    createRetentionPolicy,
    getRetentionPolicies,
    getDefaultRetentionPolicy,
    updateRetentionPolicy,
    deleteRetentionPolicy,
    countByTenant,
    getTotalStorageByTenant,
    getRecordingStats,
  };
}
