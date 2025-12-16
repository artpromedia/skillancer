/**
 * @module @skillancer/skillpod-svc/routes/watermark
 * Watermark API routes for dynamic watermarking and leak detection
 *
 * Note: Some type mismatches exist due to exactOptionalPropertyTypes (undefined vs null).
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod';

import {
  createWatermarkApplierService,
  createWatermarkDetectorService,
  createKasmWatermarkService,
  type SessionContext,
} from '../services/watermark/index.js';

import type {
  WatermarkRepository,
  DetectionSourceType,
  InvestigationStatus,
} from '../repositories/watermark.repository.js';
import type { FastifyInstance } from 'fastify';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const TenantIdParam = z.object({
  tenantId: z.string().uuid(),
});

const ConfigurationIdParam = z.object({
  configurationId: z.string().uuid(),
});

const SessionIdParam = z.object({
  sessionId: z.string().uuid(),
});

const DetectionIdParam = z.object({
  detectionId: z.string().uuid(),
});

const _InstanceIdParam = z.object({
  instanceId: z.string().uuid(),
});

// Visible watermark configuration
const VisibleConfigSchema = z.object({
  pattern: z.enum(['TILED', 'CORNER', 'CENTER', 'BORDER']),
  content: z.array(z.enum(['USER_EMAIL', 'SESSION_ID', 'TIMESTAMP', 'CUSTOM_TEXT', 'IP_ADDRESS'])),
  opacity: z.number().min(0).max(1).optional().default(0.15),
  fontSize: z.number().int().min(8).max(72).optional().default(14),
  fontFamily: z.string().optional().default('Arial'),
  fontColor: z.string().optional().default('#000000'),
  backgroundColor: z.string().optional(),
  rotation: z.number().min(-90).max(90).optional().default(-30),
  spacing: z.number().int().min(50).max(500).optional().default(200),
  margin: z.number().int().min(0).max(100).optional().default(20),
  includeCompanyLogo: z.boolean().optional().default(false),
  logoUrl: z.string().url().optional(),
});

// Invisible watermark configuration
const InvisibleConfigSchema = z.object({
  method: z.enum(['LSB', 'DCT', 'DWT']).optional().default('LSB'),
  strength: z.number().int().min(1).max(8).optional().default(1),
  channels: z
    .array(z.enum(['R', 'G', 'B']))
    .optional()
    .default(['B']),
  redundancy: z.number().int().min(1).max(10).optional().default(3),
  errorCorrection: z.boolean().optional().default(true),
});

// Create configuration request
const CreateConfigurationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  visibleConfig: VisibleConfigSchema,
  invisibleConfig: InvisibleConfigSchema.optional(),
  enableVisible: z.boolean().optional().default(true),
  enableInvisible: z.boolean().optional().default(true),
});

// Update configuration request
const UpdateConfigurationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  visibleConfig: VisibleConfigSchema.optional(),
  invisibleConfig: InvisibleConfigSchema.optional(),
  enableVisible: z.boolean().optional(),
  enableInvisible: z.boolean().optional(),
});

// Session context for watermark generation
const SessionContextSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  tenantId: z.string().uuid(),
  podId: z.string().uuid(),
  ipAddress: z.string().ip().optional(),
  customText: z.string().max(200).optional(),
});

// Initialize session watermark request
const InitializeSessionSchema = z.object({
  sessionContext: SessionContextSchema,
  configurationId: z.string().uuid().optional(),
});

// Generate overlay request
const GenerateOverlaySchema = z.object({
  sessionContext: SessionContextSchema,
  configurationId: z.string().uuid().optional(),
});

// Detect watermark request
const DetectWatermarkSchema = z.object({
  tenantId: z.string().uuid(),
  sourceType: z.enum([
    'UPLOADED_IMAGE',
    'WEB_CRAWL',
    'MANUAL_REPORT',
    'AUTOMATED_SCAN',
    'THIRD_PARTY',
  ]),
  sourceUrl: z.string().url().optional(),
  sourceIdentifier: z.string().max(500).optional(),
  reportedBy: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

// Bulk scan request
const BulkScanSchema = z.object({
  tenantId: z.string().uuid(),
  urls: z.array(z.string().url()).min(1).max(100),
  sourceType: z.enum([
    'UPLOADED_IMAGE',
    'WEB_CRAWL',
    'MANUAL_REPORT',
    'AUTOMATED_SCAN',
    'THIRD_PARTY',
  ]),
});

// Update investigation request
const UpdateInvestigationSchema = z.object({
  status: z.enum([
    'PENDING',
    'IN_PROGRESS',
    'CONFIRMED_LEAK',
    'FALSE_POSITIVE',
    'INCONCLUSIVE',
    'RESOLVED',
  ]),
  investigatorId: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
  evidenceLinks: z.array(z.string().url()).optional(),
});

// List detections query
const ListDetectionsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sessionId: z.string().uuid().optional(),
  status: z
    .enum([
      'PENDING',
      'IN_PROGRESS',
      'CONFIRMED_LEAK',
      'FALSE_POSITIVE',
      'INCONCLUSIVE',
      'RESOLVED',
    ])
    .optional(),
  sourceType: z
    .enum(['UPLOADED_IMAGE', 'WEB_CRAWL', 'MANUAL_REPORT', 'AUTOMATED_SCAN', 'THIRD_PARTY'])
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Kasm webhook request
const KasmWebhookSchema = z.object({
  event: z.enum(['session_start', 'session_end', 'screenshot', 'recording']),
  kasmSessionId: z.string(),
  userId: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()).optional(),
});

// Kasm session for injection
const KasmSessionSchema = z.object({
  kasmSessionId: z.string(),
  userId: z.string().uuid(),
  userEmail: z.string().email(),
  tenantId: z.string().uuid(),
  podId: z.string().uuid(),
  ipAddress: z.string().ip().optional(),
  kasmUrl: z.string().url(),
  kasmToken: z.string().optional(),
});

// =============================================================================
// ROUTE FACTORY
// =============================================================================

export function watermarkRoutes(repository: WatermarkRepository) {
  const applierService = createWatermarkApplierService(repository);
  const detectorService = createWatermarkDetectorService(repository);
  const kasmService = createKasmWatermarkService(repository);

  return function routes(fastify: FastifyInstance): void {
    // =========================================================================
    // CONFIGURATION MANAGEMENT
    // =========================================================================

    /**
     * Create watermark configuration
     * POST /watermarks/configurations
     */
    fastify.post('/watermarks/configurations', async (request, reply) => {
      const body = CreateConfigurationSchema.parse(request.body);
      const { tenantId } = TenantIdParam.parse(request.query);

      const configuration = await repository.createConfiguration({
        tenantId,
        name: body.name,
        description: body.description,
        isDefault: body.isDefault,
        visibleEnabled: body.enableVisible,
        visibleConfig: body.visibleConfig as any,
        invisibleEnabled: body.enableInvisible,
        invisibleConfig: body.invisibleConfig as any,
      });

      return reply.status(201).send({
        success: true,
        data: configuration,
      });
    });

    /**
     * Get watermark configuration
     * GET /watermarks/configurations/:configurationId
     */
    fastify.get('/watermarks/configurations/:configurationId', async (request, reply) => {
      const { configurationId } = ConfigurationIdParam.parse(request.params);

      const configuration = await repository.findConfigurationById(configurationId);
      if (!configuration) {
        return reply.status(404).send({
          success: false,
          error: 'Configuration not found',
        });
      }

      return reply.send({
        success: true,
        data: configuration,
      });
    });

    /**
     * Get default configuration for tenant
     * GET /watermarks/configurations/default
     */
    fastify.get('/watermarks/configurations/default', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.query);

      const configuration = await repository.findDefaultConfiguration(tenantId);
      if (!configuration) {
        return reply.status(404).send({
          success: false,
          error: 'No default configuration found',
        });
      }

      return reply.send({
        success: true,
        data: configuration,
      });
    });

    /**
     * Update watermark configuration
     * PATCH /watermarks/configurations/:configurationId
     */
    fastify.patch('/watermarks/configurations/:configurationId', async (request, reply) => {
      const { configurationId } = ConfigurationIdParam.parse(request.params);
      const body = UpdateConfigurationSchema.parse(request.body);

      const configuration = await repository.updateConfiguration(configurationId, {
        name: body.name,
        description: body.description,
        isDefault: body.isDefault,
        visibleEnabled: body.enableVisible,
        visibleConfig: body.visibleConfig as any,
        invisibleEnabled: body.enableInvisible,
        invisibleConfig: body.invisibleConfig as any,
      });

      return reply.send({
        success: true,
        data: configuration,
      });
    });

    /**
     * Delete watermark configuration
     * DELETE /watermarks/configurations/:configurationId
     */
    fastify.delete('/watermarks/configurations/:configurationId', async (request, reply) => {
      const { configurationId } = ConfigurationIdParam.parse(request.params);

      await repository.deleteConfiguration(configurationId);

      return reply.send({
        success: true,
        message: 'Configuration deleted',
      });
    });

    // =========================================================================
    // WATERMARK APPLICATION
    // =========================================================================

    /**
     * Initialize watermark for session
     * POST /watermarks/sessions/initialize
     */
    fastify.post('/watermarks/sessions/initialize', async (request, reply) => {
      const body = InitializeSessionSchema.parse(request.body);

      const result = await applierService.initializeSession(
        body.sessionContext as SessionContext,
        body.configurationId
      );

      return reply.status(201).send({
        success: true,
        data: {
          instanceId: result.instanceId,
          configuration: result.configuration,
          overlay: result.visibleOverlay,
        },
      });
    });

    /**
     * Generate visible watermark overlay
     * POST /watermarks/overlay
     */
    fastify.post('/watermarks/overlay', async (request, reply) => {
      const body = GenerateOverlaySchema.parse(request.body);

      const overlay = await applierService.generateOverlay(
        body.sessionContext as SessionContext,
        body.configurationId
      );

      return reply.send({
        success: true,
        data: overlay,
      });
    });

    /**
     * Refresh watermark for session
     * POST /watermarks/sessions/:sessionId/refresh
     */
    fastify.post('/watermarks/sessions/:sessionId/refresh', async (request, reply) => {
      const { sessionId } = SessionIdParam.parse(request.params);
      const body = SessionContextSchema.parse(request.body);

      const instance = await applierService.getInstanceBySession(sessionId);
      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'No watermark instance found for session',
        });
      }

      const overlay = await applierService.refreshVisibleWatermark(
        body as SessionContext,
        instance.id
      );

      return reply.send({
        success: true,
        data: overlay,
      });
    });

    /**
     * Get watermark instance by session
     * GET /watermarks/sessions/:sessionId/instance
     */
    fastify.get('/watermarks/sessions/:sessionId/instance', async (request, reply) => {
      const { sessionId } = SessionIdParam.parse(request.params);

      const instance = await applierService.getInstanceBySession(sessionId);
      if (!instance) {
        return reply.status(404).send({
          success: false,
          error: 'No watermark instance found for session',
        });
      }

      return reply.send({
        success: true,
        data: instance,
      });
    });

    // =========================================================================
    // DETECTION & FORENSICS
    // =========================================================================

    /**
     * Detect watermark in uploaded image
     * POST /watermarks/detect
     */
    fastify.post('/watermarks/detect', async (request, reply) => {
      const body = DetectWatermarkSchema.parse(request.body);

      // Get image data from request body (multipart or base64)
      const imageData = (request.body as any).imageData;
      if (!imageData) {
        return reply.status(400).send({
          success: false,
          error: 'imageData is required',
        });
      }

      const imageBuffer = Buffer.isBuffer(imageData) ? imageData : Buffer.from(imageData, 'base64');

      const result = await detectorService.detectWatermark({
        tenantId: body.tenantId,
        imageData: imageBuffer,
        sourceType: body.sourceType as DetectionSourceType,
        sourceUrl: body.sourceUrl,
        sourceIdentifier: body.sourceIdentifier,
        reportedBy: body.reportedBy,
        notes: body.notes,
      });

      return reply.send({
        success: true,
        data: result,
      });
    });

    /**
     * Scan URL for watermark
     * POST /watermarks/scan-url
     */
    fastify.post('/watermarks/scan-url', async (request, reply) => {
      const body = z
        .object({
          tenantId: z.string().uuid(),
          url: z.string().url(),
          sourceType: z.enum([
            'UPLOADED_IMAGE',
            'WEB_CRAWL',
            'MANUAL_REPORT',
            'AUTOMATED_SCAN',
            'THIRD_PARTY',
          ]),
        })
        .parse(request.body);

      const result = await detectorService.scanUrl(
        body.tenantId,
        body.url,
        body.sourceType as DetectionSourceType
      );

      return reply.send({
        success: true,
        data: result,
      });
    });

    /**
     * Bulk scan URLs for watermarks
     * POST /watermarks/bulk-scan
     */
    fastify.post('/watermarks/bulk-scan', async (request, reply) => {
      const body = BulkScanSchema.parse(request.body);

      const results = await detectorService.bulkScan({
        tenantId: body.tenantId,
        urls: body.urls,
        sourceType: body.sourceType as DetectionSourceType,
      });

      return reply.send({
        success: true,
        data: results,
        summary: {
          total: results.length,
          detected: results.filter((r) => r.detected).length,
          failed: results.filter((r) => r.error).length,
        },
      });
    });

    /**
     * Get detection by ID
     * GET /watermarks/detections/:detectionId
     */
    fastify.get('/watermarks/detections/:detectionId', async (request, reply) => {
      const { detectionId } = DetectionIdParam.parse(request.params);

      const detection = await repository.findDetectionById(detectionId);
      if (!detection) {
        return reply.status(404).send({
          success: false,
          error: 'Detection not found',
        });
      }

      return reply.send({
        success: true,
        data: detection,
      });
    });

    /**
     * List detections for tenant
     * GET /watermarks/detections
     */
    fastify.get('/watermarks/detections', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.query);
      const query = ListDetectionsQuery.parse(request.query);

      const result = await repository.findDetections(
        {
          tenantId,
          extractedSessionId: query.sessionId,
          investigationStatus: query.status as InvestigationStatus,
          sourceType: query.sourceType as DetectionSourceType,
        },
        {
          page: query.page,
          limit: query.limit,
        }
      );

      return reply.send({
        success: true,
        data: result.detections,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      });
    });

    /**
     * Update detection investigation
     * PATCH /watermarks/detections/:detectionId/investigation
     */
    fastify.patch('/watermarks/detections/:detectionId/investigation', async (request, reply) => {
      const { detectionId } = DetectionIdParam.parse(request.params);
      const body = UpdateInvestigationSchema.parse(request.body);

      const detection = await detectorService.updateInvestigation(detectionId, {
        status: body.status as InvestigationStatus,
        investigatorId: body.investigatorId,
        notes: body.notes,
        evidenceLinks: body.evidenceLinks,
      });

      return reply.send({
        success: true,
        data: detection,
      });
    });

    /**
     * Get detection statistics for tenant
     * GET /watermarks/detections/stats
     */
    fastify.get('/watermarks/detections/stats', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.query);

      const stats = await detectorService.getDetectionStats(tenantId);

      return reply.send({
        success: true,
        data: stats,
      });
    });

    /**
     * Get detections by session
     * GET /watermarks/sessions/:sessionId/detections
     */
    fastify.get('/watermarks/sessions/:sessionId/detections', async (request, reply) => {
      const { sessionId } = SessionIdParam.parse(request.params);

      const detections = await detectorService.findDetectionsBySession(sessionId);

      return reply.send({
        success: true,
        data: detections,
      });
    });

    // =========================================================================
    // KASM INTEGRATION
    // =========================================================================

    /**
     * Handle Kasm webhook
     * POST /watermarks/kasm/webhook
     */
    fastify.post('/watermarks/kasm/webhook', async (request, reply) => {
      const body = KasmWebhookSchema.parse(request.body);

      let result;
      switch (body.event) {
        case 'session_start':
          result = await kasmService.handleSessionStart({
            event: body.event,
            kasmSessionId: body.kasmSessionId,
            userId: body.userId,
            timestamp: body.timestamp,
            data: body.data,
          });
          break;
        case 'session_end':
          result = kasmService.handleSessionEnd({
            event: body.event,
            kasmSessionId: body.kasmSessionId,
            userId: body.userId,
            timestamp: body.timestamp,
            data: body.data,
          });
          break;
        default:
          return reply.send({
            success: true,
            message: `Event ${body.event} acknowledged`,
          });
      }

      return reply.send({
        success: result.success,
        data: result.overlay,
        instanceId: result.instanceId,
        error: result.error,
      });
    });

    /**
     * Generate Kasm injection payload
     * POST /watermarks/kasm/injection
     */
    fastify.post('/watermarks/kasm/injection', async (request, reply) => {
      const body = KasmSessionSchema.parse(request.body);
      const { configurationId } = z
        .object({
          configurationId: z.string().uuid().optional(),
        })
        .parse(request.query);

      const payload = await kasmService.generateInjectionPayload(
        {
          kasmSessionId: body.kasmSessionId,
          userId: body.userId,
          userEmail: body.userEmail,
          tenantId: body.tenantId,
          podId: body.podId,
          ipAddress: body.ipAddress,
          startTime: new Date(),
          kasmUrl: body.kasmUrl,
          kasmToken: body.kasmToken,
        },
        configurationId
      );

      return reply.send({
        success: true,
        data: payload,
      });
    });

    /**
     * Get Kasm watermark configuration
     * GET /watermarks/kasm/config
     */
    fastify.get('/watermarks/kasm/config', async (request, reply) => {
      const { tenantId } = TenantIdParam.parse(request.query);

      const config = await kasmService.getKasmConfig(tenantId);

      return reply.send({
        success: true,
        data: config,
      });
    });

    /**
     * Refresh Kasm watermark
     * POST /watermarks/kasm/refresh
     */
    fastify.post('/watermarks/kasm/refresh', async (request, reply) => {
      const body = KasmSessionSchema.parse(request.body);

      const overlay = await kasmService.refreshWatermark({
        kasmSessionId: body.kasmSessionId,
        userId: body.userId,
        userEmail: body.userEmail,
        tenantId: body.tenantId,
        podId: body.podId,
        ipAddress: body.ipAddress,
        startTime: new Date(),
        kasmUrl: body.kasmUrl,
        kasmToken: body.kasmToken,
      });

      return reply.send({
        success: true,
        data: overlay,
      });
    });

    /**
     * Get anti-screenshot script
     * GET /watermarks/kasm/anti-screenshot
     */
    fastify.get('/watermarks/kasm/anti-screenshot', async (request, reply) => {
      const script = kasmService.buildAntiScreenshotScript();

      return reply.header('Content-Type', 'application/javascript').send(script);
    });
  };
}
