/**
 * @module @skillancer/skillpod-svc/routes/recording
 * Session Recording API routes for comprehensive session capture and playback
 *
 * Note: Some type mismatches exist due to exactOptionalPropertyTypes (undefined vs null).
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod';

import type { MarkerType, RecordingAccessType } from '../repositories/recording.repository.js';
import type { RecordingService } from '../services/recording.service.js';
import type { FastifyInstance } from 'fastify';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const RecordingIdParam = z.object({
  recordingId: z.string().uuid(),
});

const SessionIdParam = z.object({
  sessionId: z.string().uuid(),
});

const TenantIdParam = z.object({
  tenantId: z.string().uuid(),
});

const MarkerIdParam = z.object({
  markerId: z.string().uuid(),
});

const PolicyIdParam = z.object({
  policyId: z.string().uuid(),
});

// Start recording request
const StartRecordingSchema = z.object({
  sessionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  kasmId: z.string(),
  format: z.string().optional().default('webm'),
  codec: z.string().optional().default('vp9'),
  resolution: z.string().optional(),
  frameRate: z.number().positive().optional(),
  retentionPolicy: z.string().optional(),
});

// Stop recording request
const StopRecordingSchema = z.object({
  kasmRecordingId: z.string(),
  kasmId: z.string(),
});

// Chunk upload request
const ChunkUploadSchema = z.object({
  chunkIndex: z.number().int().min(0),
  startOffset: z.number().int().min(0),
  durationSeconds: z.number().positive(),
  contentType: z.string().optional().default('video/webm'),
});

// Add marker request
const AddMarkerSchema = z.object({
  markerType: z.enum([
    'SESSION_START',
    'SESSION_END',
    'APPLICATION_OPEN',
    'APPLICATION_CLOSE',
    'FILE_ACCESS',
    'CLIPBOARD_ACTIVITY',
    'IDLE_START',
    'IDLE_END',
    'SECURITY_EVENT',
    'USER_ADDED',
    'ERROR',
  ]),
  timestamp: z.number().int().min(0),
  label: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.unknown()).optional(),
  createdBy: z.string().uuid().optional(),
});

// Log access request
const LogAccessSchema = z.object({
  accessType: z.enum(['VIEW', 'DOWNLOAD', 'SHARE', 'EXPORT', 'DELETE']),
  accessedBy: z.string().uuid(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  playbackStartTime: z.number().int().min(0).optional(),
  playbackEndTime: z.number().int().min(0).optional(),
  accessReason: z.string().max(500).optional(),
});

// Create retention policy request
const CreateRetentionPolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional().default(false),
  retentionDays: z.number().int().min(1).max(3650), // Max 10 years
  complianceTags: z.array(z.string()).optional().default([]),
  autoDeleteEnabled: z.boolean().optional().default(true),
});

// Update retention policy request
const UpdateRetentionPolicySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  complianceTags: z.array(z.string()).optional(),
  autoDeleteEnabled: z.boolean().optional(),
});

// List recordings query
const ListRecordingsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sessionId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: z
    .enum(['RECORDING', 'STOPPED', 'PROCESSING', 'COMPLETED', 'FAILED', 'DELETED'])
    .optional(),
  processingStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  ocrStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  orderBy: z.enum(['startedAt', 'createdAt', 'durationSeconds', 'fileSizeBytes']).optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  includeChunks: z.coerce.boolean().optional().default(false),
  includeMarkers: z.coerce.boolean().optional().default(false),
});

// Search recordings query
const SearchRecordingsQuery = z.object({
  query: z.string().min(1).max(500),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  userId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Delete recording request
const DeleteRecordingSchema = z.object({
  deletedBy: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// Apply retention policy request
const ApplyRetentionPolicySchema = z.object({
  policyId: z.string().uuid(),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

export function recordingRoutes(recordingService: RecordingService) {
  return async function routes(fastify: FastifyInstance): Promise<void> {
    // =========================================================================
    // RECORDING LIFECYCLE
    // =========================================================================

    /**
     * Start a new recording for a session
     * POST /recordings
     */
    fastify.post('/recordings', async (request, reply) => {
      const body = StartRecordingSchema.parse(request.body);

      const result = await recordingService.startRecording({
        sessionId: body.sessionId,
        tenantId: body.tenantId,
        userId: body.userId,
        kasmId: body.kasmId,
        format: body.format,
        codec: body.codec,
        resolution: body.resolution,
        frameRate: body.frameRate,
        retentionPolicy: body.retentionPolicy,
      });

      return reply.status(201).send({
        success: true,
        data: result,
      });
    });

    /**
     * Stop a recording
     * POST /recordings/:recordingId/stop
     */
    fastify.post('/recordings/:recordingId/stop', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);
      const body = StopRecordingSchema.parse(request.body);

      const result = await recordingService.stopRecording({
        recordingId,
        kasmRecordingId: body.kasmRecordingId,
        kasmId: body.kasmId,
      });

      return reply.send({
        success: true,
        data: result,
      });
    });

    /**
     * Get a recording by ID
     * GET /recordings/:recordingId
     */
    fastify.get('/recordings/:recordingId', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);

      const recording = await recordingService.getRecording(recordingId);

      if (!recording) {
        return reply.status(404).send({
          success: false,
          error: 'Recording not found',
        });
      }

      return reply.send({
        success: true,
        data: recording,
      });
    });

    /**
     * List recordings for a tenant
     * GET /tenants/:tenantId/recordings
     */
    fastify.get('/tenants/:tenantId/recordings', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.params);
      const query = ListRecordingsQuery.parse(request.query);

      const { recordings, total } = await recordingService.listRecordings(
        {
          tenantId,
          sessionId: query.sessionId,
          userId: query.userId,
          status: query.status,
          processingStatus: query.processingStatus,
          ocrStatus: query.ocrStatus,
          startDate: query.startDate ? new Date(query.startDate) : undefined,
          endDate: query.endDate ? new Date(query.endDate) : undefined,
        },
        {
          page: query.page,
          limit: query.limit,
          orderBy: query.orderBy,
          orderDirection: query.orderDirection,
          includeChunks: query.includeChunks,
          includeMarkers: query.includeMarkers,
        }
      );

      return reply.send({
        success: true,
        data: recordings,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      });
    });

    /**
     * Get recordings for a session
     * GET /sessions/:sessionId/recordings
     */
    fastify.get('/sessions/:sessionId/recordings', async (request, reply) => {
      const { sessionId } = SessionIdParam.parse(request.params);

      const recordings = await recordingService.listRecordings(
        { tenantId: '', sessionId },
        { limit: 100 }
      );

      return reply.send({
        success: true,
        data: recordings.recordings,
      });
    });

    /**
     * Delete a recording
     * DELETE /recordings/:recordingId
     */
    fastify.delete('/recordings/:recordingId', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);
      const body = DeleteRecordingSchema.parse(request.body);

      await recordingService.deleteRecording(recordingId, body.deletedBy, body.reason);

      return reply.send({
        success: true,
        message: 'Recording deleted successfully',
      });
    });

    // =========================================================================
    // PLAYBACK
    // =========================================================================

    /**
     * Get playback URL for a recording
     * GET /recordings/:recordingId/playback
     */
    fastify.get('/recordings/:recordingId/playback', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);
      const userId = (request.query as { userId?: string }).userId;

      if (!userId) {
        return reply.status(400).send({
          success: false,
          error: 'userId is required',
        });
      }

      const result = await recordingService.getPlaybackUrl(recordingId, userId);

      return reply.send({
        success: true,
        data: result,
      });
    });

    // =========================================================================
    // CHUNKS
    // =========================================================================

    /**
     * Upload a recording chunk
     * POST /recordings/:recordingId/chunks
     */
    fastify.post('/recordings/:recordingId/chunks', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);
      const query = ChunkUploadSchema.parse(request.query);

      // Get raw body as buffer
      const data = request.body as Buffer;

      const result = await recordingService.uploadChunk({
        recordingId,
        chunkIndex: query.chunkIndex,
        startOffset: query.startOffset,
        durationSeconds: query.durationSeconds,
        data,
        contentType: query.contentType,
      });

      return reply.status(201).send({
        success: true,
        data: result,
      });
    });

    /**
     * Get chunks for a recording
     * GET /recordings/:recordingId/chunks
     */
    fastify.get('/recordings/:recordingId/chunks', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);

      const chunks = await recordingService.getChunks(recordingId);

      return reply.send({
        success: true,
        data: chunks,
      });
    });

    // =========================================================================
    // PROCESSING
    // =========================================================================

    /**
     * Trigger processing for a recording
     * POST /recordings/:recordingId/process
     */
    fastify.post('/recordings/:recordingId/process', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);

      const result = await recordingService.processRecording(recordingId);

      return reply.send({
        success: true,
        data: result,
      });
    });

    /**
     * Trigger OCR processing for a recording
     * POST /recordings/:recordingId/ocr
     */
    fastify.post('/recordings/:recordingId/ocr', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);

      const result = await recordingService.performOcr(recordingId);

      return reply.send({
        success: true,
        data: result,
      });
    });

    /**
     * Generate thumbnail for a recording
     * POST /recordings/:recordingId/thumbnail
     */
    fastify.post('/recordings/:recordingId/thumbnail', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);

      const thumbnailUrl = await recordingService.generateThumbnail(recordingId);

      return reply.send({
        success: true,
        data: { thumbnailUrl },
      });
    });

    // =========================================================================
    // SEARCH
    // =========================================================================

    /**
     * Search recordings by OCR text
     * GET /tenants/:tenantId/recordings/search
     */
    fastify.get('/tenants/:tenantId/recordings/search', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.params);
      const query = SearchRecordingsQuery.parse(request.query);

      const results = await recordingService.searchRecordings({
        tenantId,
        query: query.query,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        userId: query.userId,
        sessionId: query.sessionId,
        limit: query.limit,
      });

      return reply.send({
        success: true,
        data: results,
      });
    });

    // =========================================================================
    // MARKERS
    // =========================================================================

    /**
     * Add a marker to a recording
     * POST /recordings/:recordingId/markers
     */
    fastify.post('/recordings/:recordingId/markers', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);
      const body = AddMarkerSchema.parse(request.body);

      const marker = await recordingService.addMarker({
        recordingId,
        markerType: body.markerType as MarkerType,
        timestamp: body.timestamp,
        label: body.label,
        description: body.description,
        metadata: body.metadata,
        createdBy: body.createdBy,
      });

      return reply.status(201).send({
        success: true,
        data: marker,
      });
    });

    /**
     * Get markers for a recording
     * GET /recordings/:recordingId/markers
     */
    fastify.get('/recordings/:recordingId/markers', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);

      const markers = await recordingService.getMarkers(recordingId);

      return reply.send({
        success: true,
        data: markers,
      });
    });

    /**
     * Delete a marker
     * DELETE /recordings/:recordingId/markers/:markerId
     */
    fastify.delete('/recordings/:recordingId/markers/:markerId', async (request, reply) => {
      const { markerId } = MarkerIdParam.parse(request.params);

      await recordingService.deleteMarker(markerId);

      return reply.send({
        success: true,
        message: 'Marker deleted successfully',
      });
    });

    // =========================================================================
    // ACCESS LOGS
    // =========================================================================

    /**
     * Log access to a recording
     * POST /recordings/:recordingId/access
     */
    fastify.post('/recordings/:recordingId/access', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);
      const body = LogAccessSchema.parse(request.body);

      const accessLog = await recordingService.logAccess({
        recordingId,
        accessType: body.accessType as RecordingAccessType,
        accessedBy: body.accessedBy,
        ipAddress: body.ipAddress,
        userAgent: body.userAgent,
        playbackStartTime: body.playbackStartTime,
        playbackEndTime: body.playbackEndTime,
        accessReason: body.accessReason,
      });

      return reply.status(201).send({
        success: true,
        data: accessLog,
      });
    });

    /**
     * Get access logs for a recording
     * GET /recordings/:recordingId/access
     */
    fastify.get('/recordings/:recordingId/access', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);

      const logs = await recordingService.getAccessLogs(recordingId);

      return reply.send({
        success: true,
        data: logs,
      });
    });

    /**
     * Get user's access history
     * GET /users/:userId/recording-access
     */
    fastify.get('/users/:userId/recording-access', async (request, reply) => {
      const { userId } = z.object({ userId: z.string().uuid() }).parse(request.params);
      const limit = (request.query as { limit?: number }).limit ?? 100;

      const history = await recordingService.getUserAccessHistory(userId, limit);

      return reply.send({
        success: true,
        data: history,
      });
    });

    // =========================================================================
    // RETENTION POLICIES
    // =========================================================================

    /**
     * Create a retention policy
     * POST /tenants/:tenantId/retention-policies
     */
    fastify.post('/tenants/:tenantId/retention-policies', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.params);
      const body = CreateRetentionPolicySchema.parse(request.body);

      const policy = await recordingService.createRetentionPolicy({
        tenantId,
        name: body.name,
        description: body.description,
        isDefault: body.isDefault,
        retentionDays: body.retentionDays,
        complianceTags: body.complianceTags,
        autoDeleteEnabled: body.autoDeleteEnabled,
      });

      return reply.status(201).send({
        success: true,
        data: policy,
      });
    });

    /**
     * Get retention policies for a tenant
     * GET /tenants/:tenantId/retention-policies
     */
    fastify.get('/tenants/:tenantId/retention-policies', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.params);

      const policies = await recordingService.getRetentionPolicies(tenantId);

      return reply.send({
        success: true,
        data: policies,
      });
    });

    /**
     * Update a retention policy
     * PATCH /tenants/:tenantId/retention-policies/:policyId
     */
    fastify.patch('/tenants/:tenantId/retention-policies/:policyId', async (request, reply) => {
      const { policyId } = PolicyIdParam.parse(request.params);
      const body = UpdateRetentionPolicySchema.parse(request.body);

      const policy = await recordingService.updateRetentionPolicy(policyId, body);

      return reply.send({
        success: true,
        data: policy,
      });
    });

    /**
     * Delete a retention policy
     * DELETE /tenants/:tenantId/retention-policies/:policyId
     */
    fastify.delete('/tenants/:tenantId/retention-policies/:policyId', async (request, reply) => {
      const { policyId } = PolicyIdParam.parse(request.params);

      await recordingService.deleteRetentionPolicy(policyId);

      return reply.send({
        success: true,
        message: 'Retention policy deleted successfully',
      });
    });

    /**
     * Apply a retention policy to a recording
     * POST /recordings/:recordingId/retention-policy
     */
    fastify.post('/recordings/:recordingId/retention-policy', async (request, reply) => {
      const { recordingId } = RecordingIdParam.parse(request.params);
      const body = ApplyRetentionPolicySchema.parse(request.body);

      await recordingService.applyRetentionPolicy(recordingId, body.policyId);

      return reply.send({
        success: true,
        message: 'Retention policy applied successfully',
      });
    });

    // =========================================================================
    // STATS & CLEANUP
    // =========================================================================

    /**
     * Get recording stats for a tenant
     * GET /tenants/:tenantId/recordings/stats
     */
    fastify.get('/tenants/:tenantId/recordings/stats', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.params);

      const stats = await recordingService.getStats(tenantId);

      return reply.send({
        success: true,
        data: {
          ...stats,
          totalStorageBytes: stats.totalStorageBytes.toString(),
        },
      });
    });

    /**
     * Cleanup expired recordings (admin endpoint)
     * POST /recordings/cleanup
     */
    fastify.post('/recordings/cleanup', async (request, reply) => {
      const deletedCount = await recordingService.cleanupExpiredRecordings();

      return reply.send({
        success: true,
        data: {
          deletedCount,
        },
      });
    });
  };
}
