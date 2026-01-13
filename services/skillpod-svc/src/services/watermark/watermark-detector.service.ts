/**
 * @module @skillancer/skillpod-svc/services/watermark/watermark-detector
 * Watermark detection and forensics service for leak investigation
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  createInvisibleWatermarkService,
  type ExtractResult,
  type WatermarkPayload,
} from './invisible-watermark.service.js';

import type {
  WatermarkRepository,
  CreateDetectionInput,
  DetectionSourceType,
  InvestigationStatus,
  WatermarkPayload as RepoWatermarkPayload,
  WatermarkDetection,
} from '../../repositories/watermark.repository.js';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectionRequest {
  tenantId: string;
  imageData: Buffer;
  sourceType: DetectionSourceType;
  sourceUrl?: string;
  sourceIdentifier?: string;
  reportedBy?: string;
  notes?: string;
}

export interface DetectionResult {
  detected: boolean;
  payload?: WatermarkPayload;
  confidence: number;
  method?: string;
  manipulationDetected: boolean;
  detectionId?: string;
  matchedSession?: {
    sessionId: string;
    userId: string;
    timestamp: Date;
  };
  forensics?: {
    bitsExtracted: number;
    errorRate: number;
    qualityAssessment: 'HIGH' | 'MEDIUM' | 'LOW' | 'CORRUPTED';
  };
}

export interface ScanResult {
  url: string;
  detected: boolean;
  confidence: number;
  detectionId?: string;
  error?: string;
}

export interface BulkScanRequest {
  tenantId: string;
  urls: string[];
  sourceType: DetectionSourceType;
}

export interface InvestigationUpdate {
  status: InvestigationStatus;
  investigatorId?: string;
  notes?: string;
  evidenceLinks?: string[];
}

// =============================================================================
// WATERMARK DETECTOR SERVICE
// =============================================================================

export interface WatermarkDetectorService {
  /**
   * Detect watermark in image data
   */
  detectWatermark(request: DetectionRequest): Promise<DetectionResult>;

  /**
   * Scan image from URL
   */
  scanUrl(tenantId: string, url: string, sourceType: DetectionSourceType): Promise<DetectionResult>;

  /**
   * Bulk scan multiple URLs
   */
  bulkScan(request: BulkScanRequest): Promise<ScanResult[]>;

  /**
   * Update investigation status
   */
  updateInvestigation(
    detectionId: string,
    update: InvestigationUpdate
  ): Promise<WatermarkDetection>;

  /**
   * Get detection statistics for tenant
   */
  getDetectionStats(tenantId: string): Promise<{
    total: number;
    confirmed: number;
    pending: number;
    falsePositives: number;
  }>;

  /**
   * Find detections by session
   */
  findDetectionsBySession(sessionId: string): Promise<WatermarkDetection[]>;

  /**
   * Find detections by user
   */
  findDetectionsByUser(userId: string): Promise<WatermarkDetection[]>;
}

export function createWatermarkDetectorService(
  repository: WatermarkRepository
): WatermarkDetectorService {
  const invisibleService = createInvisibleWatermarkService();

  /**
   * Assess quality based on extraction metrics
   */
  function assessQuality(
    errorRate: number,
    _confidence: number
  ): 'HIGH' | 'MEDIUM' | 'LOW' | 'CORRUPTED' {
    if (errorRate > 0.5) return 'CORRUPTED';
    if (errorRate > 0.3) return 'LOW';
    if (errorRate > 0.1) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Get encryption key for tenant
   */
  async function getTenantEncryptionKey(tenantId: string): Promise<Buffer | null> {
    const keyData = await repository.getTenantEncryptionKey(tenantId);
    if (!keyData) return null;
    return Buffer.from(keyData, 'hex');
  }

  /**
   * Create detection record
   */
  async function createDetectionRecord(
    request: DetectionRequest,
    result: ExtractResult,
    matchedPayload?: WatermarkPayload
  ): Promise<string> {
    // Convert to repo payload type (partial, since invisible payload doesn't have userEmail)
    const detectedPayload: Partial<RepoWatermarkPayload> | undefined = matchedPayload
      ? {
          userId: matchedPayload.userId,
          sessionId: matchedPayload.sessionId,
          tenantId: matchedPayload.tenantId,
          podId: matchedPayload.podId,
          timestamp: matchedPayload.timestamp?.getTime() ?? Date.now(),
          sequenceNumber: matchedPayload.sequenceNumber ?? 0,
        }
      : undefined;

    const input: CreateDetectionInput = {
      sourceType: request.sourceType,
      sourceUrl: request.sourceUrl,
      sourceDescription: request.notes,
      detectedPayload: detectedPayload as any,
      confidence: result.confidence,
      detectionMethod: result.method || 'LSB',
      extractedUserId: matchedPayload?.userId,
      extractedSessionId: matchedPayload?.sessionId,
      extractedTimestamp: matchedPayload?.timestamp,
      manipulationDetected: result.manipulationDetected,
      investigationStatus: 'PENDING',
      reportedBy: request.reportedBy,
    };

    const detection = await repository.createDetection(input);
    return detection.id;
  }

  /**
   * Detect watermark in image data
   */
  async function detectWatermark(request: DetectionRequest): Promise<DetectionResult> {
    // Get tenant encryption key
    const encryptionKey = await getTenantEncryptionKey(request.tenantId);

    if (!encryptionKey) {
      return {
        detected: false,
        confidence: 0,
        manipulationDetected: false,
        forensics: {
          bitsExtracted: 0,
          errorRate: 1,
          qualityAssessment: 'CORRUPTED',
        },
      };
    }

    // Try to extract watermark
    const extractResult = invisibleService.extractWatermark(request.imageData, encryptionKey);

    if (!extractResult.found) {
      // Still create detection record for audit trail if from external source
      if (request.sourceType !== 'UPLOADED_IMAGE') {
        await createDetectionRecord(request, extractResult);
      }

      return {
        detected: false,
        confidence: 0,
        manipulationDetected: extractResult.manipulationDetected,
        forensics: extractResult.extractionDetails
          ? {
              bitsExtracted: extractResult.extractionDetails.bitsExtracted,
              errorRate: extractResult.extractionDetails.errorRate,
              qualityAssessment: assessQuality(extractResult.extractionDetails.errorRate, 0),
            }
          : undefined,
      };
    }

    // Create detection record
    const detectionId = await createDetectionRecord(request, extractResult, extractResult.payload);

    const qualityAssessment = extractResult.extractionDetails
      ? assessQuality(extractResult.extractionDetails.errorRate, extractResult.confidence)
      : 'MEDIUM';

    return {
      detected: true,
      payload: extractResult.payload,
      confidence: extractResult.confidence,
      method: extractResult.method,
      manipulationDetected: extractResult.manipulationDetected,
      detectionId,
      matchedSession: extractResult.payload
        ? {
            sessionId: extractResult.payload.sessionId,
            userId: extractResult.payload.userId,
            timestamp: extractResult.payload.timestamp,
          }
        : undefined,
      forensics: extractResult.extractionDetails
        ? {
            bitsExtracted: extractResult.extractionDetails.bitsExtracted,
            errorRate: extractResult.extractionDetails.errorRate,
            qualityAssessment,
          }
        : undefined,
    };
  }

  /**
   * Scan image from URL
   */
  async function scanUrl(
    tenantId: string,
    url: string,
    sourceType: DetectionSourceType
  ): Promise<DetectionResult> {
    try {
      // Fetch image from URL
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      return await detectWatermark({
        tenantId,
        imageData: imageBuffer,
        sourceType,
        sourceUrl: url,
      });
    } catch (error) {
      return {
        detected: false,
        confidence: 0,
        manipulationDetected: false,
        forensics: {
          bitsExtracted: 0,
          errorRate: 1,
          qualityAssessment: 'CORRUPTED',
        },
      };
    }
  }

  /**
   * Bulk scan multiple URLs
   */
  async function bulkScan(request: BulkScanRequest): Promise<ScanResult[]> {
    const results: ScanResult[] = [];

    // Process URLs in parallel with concurrency limit
    const concurrencyLimit = 5;
    const chunks: string[][] = [];

    for (let i = 0; i < request.urls.length; i += concurrencyLimit) {
      chunks.push(request.urls.slice(i, i + concurrencyLimit));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (url) => {
          try {
            const result = await scanUrl(request.tenantId, url, request.sourceType);
            return {
              url,
              detected: result.detected,
              confidence: result.confidence,
              detectionId: result.detectionId,
            };
          } catch (error) {
            return {
              url,
              detected: false,
              confidence: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Update investigation status
   */
  async function updateInvestigation(
    detectionId: string,
    update: InvestigationUpdate
  ): Promise<WatermarkDetection> {
    return repository.updateDetection(detectionId, {
      investigationStatus: update.status,
      investigatedBy: update.investigatorId,
      investigationNotes: update.notes,
    });
  }

  /**
   * Get detection statistics for tenant
   */
  async function getDetectionStats(tenantId: string): Promise<{
    total: number;
    confirmed: number;
    pending: number;
    falsePositives: number;
  }> {
    return repository.getDetectionStats(tenantId);
  }

  /**
   * Find detections by session
   */
  async function findDetectionsBySession(sessionId: string): Promise<WatermarkDetection[]> {
    const result = await repository.findDetections({ extractedSessionId: sessionId });
    return result.detections;
  }

  /**
   * Find detections by user
   */
  async function findDetectionsByUser(userId: string): Promise<WatermarkDetection[]> {
    const result = await repository.findDetections({ extractedUserId: userId });
    return result.detections;
  }

  return {
    detectWatermark,
    scanUrl,
    bulkScan,
    updateInvestigation,
    getDetectionStats,
    findDetectionsBySession,
    findDetectionsByUser,
  };
}
