/**
 * @module @skillancer/skillpod-svc/services/recording
 * Session Recording Service for comprehensive session capture and playback
 *
 * Features:
 * - Real-time session recording via Kasm integration
 * - Chunk-based upload for large recordings
 * - Video processing and merging with FFmpeg
 * - OCR text extraction for searchable recordings
 * - S3 storage with KMS encryption
 * - Retention policy management
 * - Access control and audit logging
 *
 * Note: Some type mismatches exist due to exactOptionalPropertyTypes (undefined vs null).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createRecordingRepository } from '../repositories/recording.repository.js';

import type { KasmWorkspacesService } from './kasm-workspaces.service.js';
import type {
  RecordingWithRelations,
  RecordingChunk,
  RecordingMarker,
  RecordingOcrFrame,
  RecordingAccessLog,
  RecordingRetentionPolicy,
  MarkerType,
  RecordingAccessType,
  RecordingListFilter,
  RecordingListOptions,
} from '../repositories/recording.repository.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export interface RecordingConfig {
  s3Bucket: string;
  s3Region: string;
  kmsKeyId: string;
  cloudfrontDomain?: string;
  ocrEnabled: boolean;
  ocrSampleIntervalSeconds: number;
  elasticsearchEnabled: boolean;
  elasticsearchUrl?: string;
  elasticsearchIndex?: string;
  defaultRetentionDays: number;
  maxChunkSizeBytes: number;
  thumbnailGenerationEnabled: boolean;
}

export interface StartRecordingParams {
  sessionId: string;
  tenantId: string;
  userId: string;
  kasmId: string;
  format?: string;
  codec?: string;
  resolution?: string;
  frameRate?: number;
  retentionPolicy?: string;
}

export interface StartRecordingResult {
  recordingId: string;
  kasmRecordingId: string;
  startedAt: Date;
}

export interface StopRecordingParams {
  recordingId: string;
  kasmRecordingId: string;
  kasmId: string;
}

export interface StopRecordingResult {
  recordingId: string;
  duration: number;
  fileSize: number;
  storageKey: string;
  processingQueued: boolean;
}

export interface ChunkUploadParams {
  recordingId: string;
  chunkIndex: number;
  startOffset: number;
  durationSeconds: number;
  data: Buffer;
  contentType?: string;
}

export interface ChunkUploadResult {
  chunkId: string;
  storageKey: string;
  fileSizeBytes: number;
}

export interface ProcessRecordingResult {
  recordingId: string;
  mergedStorageKey: string;
  totalDuration: number;
  totalSize: number;
  thumbnailUrl?: string;
}

export interface OcrProcessingResult {
  recordingId: string;
  framesProcessed: number;
  textExtracted: number;
  indexedInElasticsearch: boolean;
}

export interface PlaybackUrlResult {
  url: string;
  expiresAt: Date;
  recordingId: string;
  format: string;
}

export interface SearchRecordingsParams {
  tenantId: string;
  query: string;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  sessionId?: string;
  limit?: number;
}

export interface SearchResult {
  recordingId: string;
  sessionId: string;
  userId: string;
  timestamp: number;
  matchedText: string;
  confidence: number;
}

export interface AddMarkerParams {
  recordingId: string;
  markerType: MarkerType;
  timestamp: number;
  label?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface LogAccessParams {
  recordingId: string;
  accessType: RecordingAccessType;
  accessedBy: string;
  ipAddress?: string;
  userAgent?: string;
  playbackStartTime?: number;
  playbackEndTime?: number;
  accessReason?: string;
}

export interface CreateRetentionPolicyParams {
  tenantId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  retentionDays: number;
  complianceTags?: string[];
  autoDeleteEnabled?: boolean;
}

export interface RecordingStats {
  total: number;
  recording: number;
  completed: number;
  failed: number;
  totalDurationSeconds: number;
  totalStorageBytes: bigint;
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface RecordingService {
  // Recording lifecycle
  startRecording(params: StartRecordingParams): Promise<StartRecordingResult>;
  stopRecording(params: StopRecordingParams): Promise<StopRecordingResult>;
  pauseRecording(recordingId: string): Promise<void>;
  resumeRecording(recordingId: string): Promise<void>;

  // Chunk handling
  uploadChunk(params: ChunkUploadParams): Promise<ChunkUploadResult>;
  getChunks(recordingId: string): Promise<RecordingChunk[]>;

  // Processing
  processRecording(recordingId: string): Promise<ProcessRecordingResult>;
  performOcr(recordingId: string): Promise<OcrProcessingResult>;
  generateThumbnail(recordingId: string): Promise<string>;

  // Playback
  getPlaybackUrl(recordingId: string, userId: string): Promise<PlaybackUrlResult>;
  getRecording(recordingId: string): Promise<RecordingWithRelations | null>;
  listRecordings(
    filter: RecordingListFilter,
    options?: RecordingListOptions
  ): Promise<{ recordings: RecordingWithRelations[]; total: number }>;

  // Search
  searchRecordings(params: SearchRecordingsParams): Promise<SearchResult[]>;
  searchOcrText(tenantId: string, query: string, limit?: number): Promise<RecordingOcrFrame[]>;

  // Markers
  addMarker(params: AddMarkerParams): Promise<RecordingMarker>;
  getMarkers(recordingId: string): Promise<RecordingMarker[]>;
  deleteMarker(markerId: string): Promise<void>;

  // Access control
  logAccess(params: LogAccessParams): Promise<RecordingAccessLog>;
  getAccessLogs(recordingId: string): Promise<RecordingAccessLog[]>;
  getUserAccessHistory(userId: string, limit?: number): Promise<RecordingAccessLog[]>;

  // Retention
  createRetentionPolicy(params: CreateRetentionPolicyParams): Promise<RecordingRetentionPolicy>;
  getRetentionPolicies(tenantId: string): Promise<RecordingRetentionPolicy[]>;
  updateRetentionPolicy(
    id: string,
    params: Partial<CreateRetentionPolicyParams>
  ): Promise<RecordingRetentionPolicy>;
  deleteRetentionPolicy(id: string): Promise<void>;
  applyRetentionPolicy(recordingId: string, policyId: string): Promise<void>;

  // Cleanup
  deleteRecording(recordingId: string, deletedBy: string, reason?: string): Promise<void>;
  cleanupExpiredRecordings(): Promise<number>;

  // Stats
  getStats(tenantId: string): Promise<RecordingStats>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateStorageKey(recordingId: string, tenantId: string, filename: string): string {
  const date = new Date();
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `recordings/${tenantId}/${year}/${month}/${day}/${recordingId}/${filename}`;
}

function calculateExpirationDate(retentionDays: number): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);
  return expiresAt;
}

async function uploadToS3(
  bucket: string,
  key: string,
  data: Buffer,
  _contentType: string,
  _kmsKeyId: string
): Promise<{ size: number }> {
  // In production, use AWS SDK S3 client with SSE-KMS encryption
  // const s3 = new S3Client({ region });
  // const command = new PutObjectCommand({
  //   Bucket: bucket,
  //   Key: key,
  //   Body: data,
  //   ContentType: contentType,
  //   ServerSideEncryption: 'aws:kms',
  //   SSEKMSKeyId: kmsKeyId,
  // });
  // await s3.send(command);

  console.log(`[Recording] Uploaded to S3: s3://${bucket}/${key} (${data.length} bytes)`);

  // Simulate async operation
  await Promise.resolve();

  return { size: data.length };
}

function generateSignedUrl(
  bucket: string,
  key: string,
  expiresInSeconds: number,
  cloudfrontDomain?: string
): { url: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  // In production, generate CloudFront signed URL or S3 presigned URL
  let url: string;
  if (cloudfrontDomain) {
    // CloudFront signed URL for faster delivery
    url = `https://${cloudfrontDomain}/${key}?expires=${expiresAt.getTime()}`;
  } else {
    // S3 presigned URL
    url = `https://${bucket}.s3.amazonaws.com/${key}?expires=${expiresAt.getTime()}`;
  }

  console.log(`[Recording] Generated signed URL (expires: ${expiresAt.toISOString()})`);

  return { url, expiresAt };
}

async function deleteFromS3(bucket: string, key: string): Promise<void> {
  // In production, use AWS SDK S3 client
  // const s3 = new S3Client({ region });
  // const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  // await s3.send(command);

  console.log(`[Recording] Deleted from S3: s3://${bucket}/${key}`);
  await Promise.resolve();
}

async function mergeChunks(
  _chunks: RecordingChunk[],
  _bucket: string,
  _outputKey: string
): Promise<{ duration: number; size: number }> {
  // In production, use FFmpeg to merge video chunks
  // This could be done via Lambda, ECS task, or MediaConvert

  console.log(`[Recording] Merging ${_chunks.length} chunks into ${_outputKey}`);

  // Simulate async operation
  await Promise.resolve();

  // Calculate totals from chunks
  const duration = _chunks.reduce((sum, c) => sum + c.durationSeconds, 0);
  const size = _chunks.reduce((sum, c) => sum + c.fileSizeBytes, 0);

  return { duration, size };
}

async function extractTextFromFrame(
  _frameData: Buffer,
  _timestamp: number
): Promise<{ text: string; confidence: number; regions: unknown[] }> {
  // In production, use Tesseract.js or AWS Textract
  // const worker = await createWorker();
  // await worker.loadLanguage('eng');
  // await worker.initialize('eng');
  // const { data } = await worker.recognize(frameData);
  // await worker.terminate();

  console.log(`[Recording] OCR processing frame at ${_timestamp}s`);

  // Simulate async operation
  await Promise.resolve();

  return {
    text: '',
    confidence: 0,
    regions: [],
  };
}

async function indexInElasticsearch(
  _esUrl: string,
  _index: string,
  _document: Record<string, unknown>
): Promise<string | null> {
  // In production, use Elasticsearch client
  // const client = new Client({ node: esUrl });
  // const result = await client.index({
  //   index,
  //   document,
  // });
  // return result._id;

  console.log(`[Recording] Indexed in Elasticsearch`);

  // Simulate async operation
  await Promise.resolve();

  return `es-${Date.now()}`;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createRecordingService(
  prisma: PrismaClient,
  redis: Redis,
  kasmService: KasmWorkspacesService,
  config: RecordingConfig
): RecordingService {
  const repo = createRecordingRepository(prisma);

  // Cache keys
  const RECORDING_CACHE_PREFIX = 'recording:';
  const RECORDING_CACHE_TTL = 300; // 5 minutes

  // =========================================================================
  // RECORDING LIFECYCLE
  // =========================================================================

  async function startRecording(params: StartRecordingParams): Promise<StartRecordingResult> {
    // Start recording in Kasm
    const kasmRecordingId = await kasmService.startRecording(params.kasmId);

    // Get retention policy
    let expiresAt: Date | undefined;
    if (params.retentionPolicy) {
      // Use specified policy
      const policies = await repo.getRetentionPolicies(params.tenantId);
      const policy = policies.find((p) => p.name === params.retentionPolicy);
      if (policy) {
        expiresAt = calculateExpirationDate(policy.retentionDays);
      }
    } else {
      // Use default policy
      const defaultPolicy = await repo.getDefaultRetentionPolicy(params.tenantId);
      if (defaultPolicy) {
        expiresAt = calculateExpirationDate(defaultPolicy.retentionDays);
      } else {
        expiresAt = calculateExpirationDate(config.defaultRetentionDays);
      }
    }

    // Create recording record
    const recording = await repo.create({
      sessionId: params.sessionId,
      tenantId: params.tenantId,
      userId: params.userId,
      format: params.format,
      codec: params.codec,
      resolution: params.resolution,
      frameRate: params.frameRate,
      encryptionKeyId: config.kmsKeyId,
      retentionPolicy: params.retentionPolicy,
    });

    // Set expiration
    if (expiresAt) {
      await repo.update(recording.id, { expiresAt });
    }

    // Add session start marker
    await repo.createMarker({
      recordingId: recording.id,
      markerType: 'SESSION_START',
      timestamp: 0,
      label: 'Recording started',
      isAutoDetected: true,
      detectionSource: 'system',
    });

    // Cache recording state
    await redis.setex(
      `${RECORDING_CACHE_PREFIX}${recording.id}`,
      RECORDING_CACHE_TTL,
      JSON.stringify({ kasmRecordingId, status: 'RECORDING' })
    );

    console.log(`[Recording] Started recording ${recording.id} for session ${params.sessionId}`);

    return {
      recordingId: recording.id,
      kasmRecordingId,
      startedAt: recording.startedAt,
    };
  }

  async function stopRecording(params: StopRecordingParams): Promise<StopRecordingResult> {
    // Stop recording in Kasm
    const kasmResult = await kasmService.stopRecording(params.kasmId, params.kasmRecordingId);

    // Update recording status
    const now = new Date();
    const storageKey = generateStorageKey(
      params.recordingId,
      (await repo.findById(params.recordingId))?.tenantId ?? 'unknown',
      `recording.${config.s3Bucket}`
    );

    await repo.update(params.recordingId, {
      status: 'STOPPED',
      endedAt: now,
      durationSeconds: kasmResult.duration,
      fileSizeBytes: BigInt(kasmResult.fileSize),
      storageLocation: `s3://${config.s3Bucket}/${storageKey}`,
      storageBucket: config.s3Bucket,
      storageKey,
    });

    // Add session end marker
    await repo.createMarker({
      recordingId: params.recordingId,
      markerType: 'SESSION_END',
      timestamp: kasmResult.duration,
      label: 'Recording stopped',
      isAutoDetected: true,
      detectionSource: 'system',
    });

    // Clear cache
    await redis.del(`${RECORDING_CACHE_PREFIX}${params.recordingId}`);

    // Queue processing
    await redis.lpush('recording:processing:queue', params.recordingId);

    console.log(
      `[Recording] Stopped recording ${params.recordingId} (${kasmResult.duration}s, ${kasmResult.fileSize} bytes)`
    );

    return {
      recordingId: params.recordingId,
      duration: kasmResult.duration,
      fileSize: kasmResult.fileSize,
      storageKey,
      processingQueued: true,
    };
  }

  async function pauseRecording(recordingId: string): Promise<void> {
    const recording = await repo.findById(recordingId);
    if (!recording) throw new Error('Recording not found');
    if (recording.status !== 'RECORDING') {
      throw new Error('Recording is not in progress');
    }

    // In production, pause Kasm recording
    console.log(`[Recording] Paused recording ${recordingId}`);
  }

  async function resumeRecording(recordingId: string): Promise<void> {
    const recording = await repo.findById(recordingId);
    if (!recording) throw new Error('Recording not found');

    // In production, resume Kasm recording
    console.log(`[Recording] Resumed recording ${recordingId}`);
  }

  // =========================================================================
  // CHUNK HANDLING
  // =========================================================================

  async function uploadChunk(params: ChunkUploadParams): Promise<ChunkUploadResult> {
    const recording = await repo.findById(params.recordingId);
    if (!recording) throw new Error('Recording not found');

    // Validate chunk size
    if (params.data.length > config.maxChunkSizeBytes) {
      throw new Error(
        `Chunk size ${params.data.length} exceeds maximum ${config.maxChunkSizeBytes}`
      );
    }

    // Generate storage key for chunk
    const chunkFilename = `chunk-${String(params.chunkIndex).padStart(5, '0')}.webm`;
    const storageKey = generateStorageKey(params.recordingId, recording.tenantId, chunkFilename);

    // Upload to S3
    const { size } = await uploadToS3(
      config.s3Bucket,
      storageKey,
      params.data,
      params.contentType ?? 'video/webm',
      config.kmsKeyId
    );

    // Create chunk record
    const chunk = await repo.createChunk({
      recordingId: params.recordingId,
      chunkIndex: params.chunkIndex,
      startOffset: params.startOffset,
      durationSeconds: params.durationSeconds,
      storageKey,
      fileSizeBytes: size,
    });

    console.log(
      `[Recording] Uploaded chunk ${params.chunkIndex} for recording ${params.recordingId}`
    );

    return {
      chunkId: chunk.id,
      storageKey,
      fileSizeBytes: size,
    };
  }

  async function getChunks(recordingId: string): Promise<RecordingChunk[]> {
    return repo.getChunks(recordingId);
  }

  // =========================================================================
  // PROCESSING
  // =========================================================================

  async function processRecording(recordingId: string): Promise<ProcessRecordingResult> {
    const recording = await repo.findById(recordingId);
    if (!recording) throw new Error('Recording not found');

    // Update status to processing
    await repo.update(recordingId, {
      status: 'PROCESSING',
      processingStatus: 'PROCESSING',
    });

    try {
      // Get all chunks
      const chunks = await repo.getChunks(recordingId);

      if (chunks.length === 0) {
        throw new Error('No chunks found for recording');
      }

      // Merge chunks using FFmpeg
      const mergedFilename = 'recording-merged.webm';
      const mergedKey = generateStorageKey(recordingId, recording.tenantId, mergedFilename);

      const { duration, size } = await mergeChunks(chunks, config.s3Bucket, mergedKey);

      // Generate thumbnail
      let thumbnailUrl: string | undefined;
      if (config.thumbnailGenerationEnabled) {
        thumbnailUrl = await generateThumbnail(recordingId);
      }

      // Update recording
      await repo.update(recordingId, {
        status: 'COMPLETED',
        processingStatus: 'COMPLETED',
        processedAt: new Date(),
        storageKey: mergedKey,
        storageLocation: `s3://${config.s3Bucket}/${mergedKey}`,
        durationSeconds: duration,
        fileSizeBytes: BigInt(size),
        thumbnailUrl,
      });

      // Queue OCR processing if enabled
      if (config.ocrEnabled) {
        await redis.lpush('recording:ocr:queue', recordingId);
      }

      console.log(`[Recording] Processed recording ${recordingId} (${duration}s, ${size} bytes)`);

      return {
        recordingId,
        mergedStorageKey: mergedKey,
        totalDuration: duration,
        totalSize: size,
        thumbnailUrl,
      };
    } catch (error) {
      // Update status to failed
      await repo.update(recordingId, {
        status: 'FAILED',
        processingStatus: 'FAILED',
      });
      throw error;
    }
  }

  async function performOcr(recordingId: string): Promise<OcrProcessingResult> {
    const recording = await repo.findById(recordingId);
    if (!recording) throw new Error('Recording not found');

    // Update OCR status
    await repo.update(recordingId, { ocrStatus: 'PROCESSING' });

    try {
      const framesProcessed: RecordingOcrFrame[] = [];
      const duration = recording.durationSeconds ?? 0;

      // Process frames at configured interval
      for (let ts = 0; ts < duration; ts += config.ocrSampleIntervalSeconds) {
        // In production, extract frame from video at timestamp
        const frameData = Buffer.alloc(0); // Placeholder

        const { text, confidence, regions } = await extractTextFromFrame(frameData, ts);

        if (text.length > 0) {
          let elasticsearchId: string | undefined;

          // Index in Elasticsearch if enabled
          if (config.elasticsearchEnabled && config.elasticsearchUrl) {
            elasticsearchId =
              (await indexInElasticsearch(
                config.elasticsearchUrl,
                config.elasticsearchIndex ?? 'recordings',
                {
                  recordingId,
                  tenantId: recording.tenantId,
                  userId: recording.userId,
                  sessionId: recording.sessionId,
                  timestamp: ts,
                  text,
                  createdAt: new Date(),
                }
              )) ?? undefined;
          }

          const frame = await repo.createOcrFrame({
            recordingId,
            timestamp: ts,
            frameNumber: Math.floor(ts / config.ocrSampleIntervalSeconds),
            extractedText: text,
            textConfidence: confidence,
            textRegions: regions as {
              x: number;
              y: number;
              width: number;
              height: number;
              text: string;
            }[],
            elasticsearchId,
          });

          framesProcessed.push(frame);
        }
      }

      // Update OCR status
      await repo.update(recordingId, {
        ocrStatus: 'COMPLETED',
        ocrCompletedAt: new Date(),
      });

      console.log(
        `[Recording] OCR completed for ${recordingId}: ${framesProcessed.length} frames processed`
      );

      return {
        recordingId,
        framesProcessed: framesProcessed.length,
        textExtracted: framesProcessed.filter((f) => f.extractedText.length > 0).length,
        indexedInElasticsearch: config.elasticsearchEnabled,
      };
    } catch (error) {
      await repo.update(recordingId, { ocrStatus: 'FAILED' });
      throw error;
    }
  }

  async function generateThumbnail(recordingId: string): Promise<string> {
    const recording = await repo.findById(recordingId);
    if (!recording) throw new Error('Recording not found');

    // In production, extract frame at 5s mark and create thumbnail
    const thumbnailKey = generateStorageKey(recordingId, recording.tenantId, 'thumbnail.jpg');

    // Placeholder - would use FFmpeg to extract frame
    console.log(`[Recording] Generated thumbnail for ${recordingId}`);

    const { url } = generateSignedUrl(
      config.s3Bucket,
      thumbnailKey,
      86400 * 365, // 1 year
      config.cloudfrontDomain
    );

    await repo.update(recordingId, { thumbnailUrl: url });

    return url;
  }

  // =========================================================================
  // PLAYBACK
  // =========================================================================

  async function getPlaybackUrl(recordingId: string, userId: string): Promise<PlaybackUrlResult> {
    const recording = await repo.findById(recordingId);
    if (!recording) throw new Error('Recording not found');
    if (recording.status !== 'COMPLETED') {
      throw new Error('Recording is not ready for playback');
    }
    if (!recording.storageKey) {
      throw new Error('Recording has no storage key');
    }

    // Generate signed URL (1 hour expiry)
    const { url, expiresAt } = generateSignedUrl(
      config.s3Bucket,
      recording.storageKey,
      3600,
      config.cloudfrontDomain
    );

    // Log access
    await repo.createAccessLog({
      recordingId,
      accessType: 'VIEW',
      accessedBy: userId,
    });

    return {
      url,
      expiresAt,
      recordingId,
      format: recording.format,
    };
  }

  async function getRecording(recordingId: string): Promise<RecordingWithRelations | null> {
    return repo.findById(recordingId);
  }

  async function listRecordings(
    filter: RecordingListFilter,
    options?: RecordingListOptions
  ): Promise<{ recordings: RecordingWithRelations[]; total: number }> {
    return repo.findMany(filter, options);
  }

  // =========================================================================
  // SEARCH
  // =========================================================================

  async function searchRecordings(params: SearchRecordingsParams): Promise<SearchResult[]> {
    // In production, use Elasticsearch for full-text search
    const frames = await repo.searchOcrText(params.tenantId, params.query, params.limit);

    return frames.map((frame) => ({
      recordingId: frame.recordingId,
      sessionId: '', // Would need to join with recording
      userId: '', // Would need to join with recording
      timestamp: frame.timestamp,
      matchedText: frame.extractedText,
      confidence: Number(frame.textConfidence),
    }));
  }

  async function searchOcrText(
    tenantId: string,
    query: string,
    limit?: number
  ): Promise<RecordingOcrFrame[]> {
    return repo.searchOcrText(tenantId, query, limit);
  }

  // =========================================================================
  // MARKERS
  // =========================================================================

  async function addMarker(params: AddMarkerParams): Promise<RecordingMarker> {
    return repo.createMarker({
      recordingId: params.recordingId,
      markerType: params.markerType,
      timestamp: params.timestamp,
      label: params.label,
      description: params.description,
      metadata: params.metadata,
      isAutoDetected: false,
      createdBy: params.createdBy,
    });
  }

  async function getMarkers(recordingId: string): Promise<RecordingMarker[]> {
    return repo.getMarkers(recordingId);
  }

  async function deleteMarker(markerId: string): Promise<void> {
    await repo.deleteMarker(markerId);
  }

  // =========================================================================
  // ACCESS CONTROL
  // =========================================================================

  async function logAccess(params: LogAccessParams): Promise<RecordingAccessLog> {
    const playbackDuration =
      params.playbackStartTime !== undefined && params.playbackEndTime !== undefined
        ? params.playbackEndTime - params.playbackStartTime
        : undefined;

    return repo.createAccessLog({
      ...params,
      playbackDuration,
    });
  }

  async function getAccessLogs(recordingId: string): Promise<RecordingAccessLog[]> {
    return repo.getAccessLogs(recordingId);
  }

  async function getUserAccessHistory(
    userId: string,
    limit?: number
  ): Promise<RecordingAccessLog[]> {
    return repo.getUserAccessHistory(userId, limit);
  }

  // =========================================================================
  // RETENTION
  // =========================================================================

  async function createRetentionPolicy(
    params: CreateRetentionPolicyParams
  ): Promise<RecordingRetentionPolicy> {
    return repo.createRetentionPolicy(params);
  }

  async function getRetentionPolicies(tenantId: string): Promise<RecordingRetentionPolicy[]> {
    return repo.getRetentionPolicies(tenantId);
  }

  async function updateRetentionPolicy(
    id: string,
    params: Partial<CreateRetentionPolicyParams>
  ): Promise<RecordingRetentionPolicy> {
    return repo.updateRetentionPolicy(id, params);
  }

  async function deleteRetentionPolicy(id: string): Promise<void> {
    await repo.deleteRetentionPolicy(id);
  }

  async function applyRetentionPolicy(recordingId: string, policyId: string): Promise<void> {
    const recording = await repo.findById(recordingId);
    if (!recording) throw new Error('Recording not found');

    const policies = await repo.getRetentionPolicies(recording.tenantId);
    const policy = policies.find((p) => p.id === policyId);
    if (!policy) throw new Error('Retention policy not found');

    const expiresAt = calculateExpirationDate(policy.retentionDays);

    await repo.update(recordingId, {
      retentionPolicy: policy.name,
      expiresAt,
    });

    console.log(
      `[Recording] Applied retention policy ${policy.name} to ${recordingId}, expires ${expiresAt.toISOString()}`
    );
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  async function deleteRecording(
    recordingId: string,
    deletedBy: string,
    reason?: string
  ): Promise<void> {
    const recording = await repo.findById(recordingId);
    if (!recording) throw new Error('Recording not found');

    // Log deletion
    await repo.createAccessLog({
      recordingId,
      accessType: 'DELETE',
      accessedBy: deletedBy,
      accessReason: reason,
    });

    // Delete from S3
    if (recording.storageKey) {
      await deleteFromS3(config.s3Bucket, recording.storageKey);
    }

    // Delete chunks
    if (recording.chunks) {
      for (const chunk of recording.chunks) {
        await deleteFromS3(config.s3Bucket, chunk.storageKey);
      }
    }

    // Soft delete record
    await repo.softDelete(recordingId);

    console.log(`[Recording] Deleted recording ${recordingId} by ${deletedBy}`);
  }

  async function cleanupExpiredRecordings(): Promise<number> {
    const now = new Date();
    const expired = await repo.getExpiredRecordings(now);

    let deleted = 0;
    for (const recording of expired) {
      try {
        await deleteRecording(recording.id, 'system', 'Retention policy expired');
        deleted++;
      } catch (error) {
        console.error(`[Recording] Failed to delete expired recording ${recording.id}:`, error);
      }
    }

    console.log(`[Recording] Cleaned up ${deleted} expired recordings`);
    return deleted;
  }

  // =========================================================================
  // STATS
  // =========================================================================

  async function getStats(tenantId: string): Promise<RecordingStats> {
    const stats = await repo.getRecordingStats(tenantId);
    return {
      total: stats.total,
      recording: stats.recording,
      completed: stats.completed,
      failed: stats.failed,
      totalDurationSeconds: stats.totalDuration,
      totalStorageBytes: stats.totalSize,
    };
  }

  // Return service interface
  return {
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    uploadChunk,
    getChunks,
    processRecording,
    performOcr,
    generateThumbnail,
    getPlaybackUrl,
    getRecording,
    listRecordings,
    searchRecordings,
    searchOcrText,
    addMarker,
    getMarkers,
    deleteMarker,
    logAccess,
    getAccessLogs,
    getUserAccessHistory,
    createRetentionPolicy,
    getRetentionPolicies,
    updateRetentionPolicy,
    deleteRetentionPolicy,
    applyRetentionPolicy,
    deleteRecording,
    cleanupExpiredRecordings,
    getStats,
  };
}
