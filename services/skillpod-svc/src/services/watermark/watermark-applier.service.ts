/**
 * @module @skillancer/skillpod-svc/services/watermark/watermark-applier
 * Main watermark applier service that coordinates visible and invisible watermarking
 */

import {
  createInvisibleWatermarkService,
  type WatermarkPayload as InvisiblePayload,
  type EmbedResult,
} from './invisible-watermark.service.js';
import {
  createVisibleWatermarkService,
  type WatermarkPayload as VisiblePayload,
  type WatermarkOverlayResult,
} from './visible-watermark.service.js';

import type {
  WatermarkRepository,
  VisibleWatermarkConfig,
  InvisibleWatermarkConfig,
  WatermarkPayload,
  WatermarkConfiguration,
  WatermarkInstance,
} from '../../repositories/watermark.repository.js';

// =============================================================================
// TYPES
// =============================================================================

export interface SessionContext {
  sessionId: string;
  userId: string;
  userEmail: string;
  tenantId: string;
  podId: string;
  ipAddress?: string;
  customText?: string;
}

export interface ApplyWatermarkRequest {
  sessionContext: SessionContext;
  configurationId?: string;
  frameData?: Buffer;
  timestamp?: Date;
  sequenceNumber?: number;
}

export interface AppliedWatermark {
  instanceId: string;
  visible: WatermarkOverlayResult;
  invisible?: EmbedResult;
  configuration: WatermarkConfiguration;
}

export interface FrameWatermarkResult {
  frameData: Buffer;
  payloadKey: string;
  payloadHash: string;
  method: string;
  bytesUsed: number;
}

export interface SessionWatermarkConfig {
  configuration: WatermarkConfiguration;
  visibleOverlay: WatermarkOverlayResult;
  instanceId: string;
}

// =============================================================================
// WATERMARK APPLIER SERVICE
// =============================================================================

export interface WatermarkApplierService {
  /**
   * Initialize watermarking for a session
   */
  initializeSession(
    sessionContext: SessionContext,
    configurationId?: string
  ): Promise<SessionWatermarkConfig>;

  /**
   * Apply watermark to a video frame
   */
  applyToFrame(
    sessionContext: SessionContext,
    frameData: Buffer,
    sequenceNumber: number,
    instanceId: string
  ): Promise<FrameWatermarkResult>;

  /**
   * Generate visible watermark overlay for session
   */
  generateOverlay(
    sessionContext: SessionContext,
    configurationId?: string
  ): Promise<WatermarkOverlayResult>;

  /**
   * Get or create watermark configuration for tenant
   */
  getConfiguration(tenantId: string, configurationId?: string): Promise<WatermarkConfiguration>;

  /**
   * Create watermark instance for session
   */
  createInstance(
    sessionContext: SessionContext,
    configurationId: string
  ): Promise<WatermarkInstance>;

  /**
   * Get watermark instance by session
   */
  getInstanceBySession(sessionId: string): Promise<WatermarkInstance | null>;

  /**
   * Refresh visible watermark (e.g., update timestamp)
   */
  refreshVisibleWatermark(
    sessionContext: SessionContext,
    instanceId: string
  ): Promise<WatermarkOverlayResult>;
}

export function createWatermarkApplierService(
  repository: WatermarkRepository
): WatermarkApplierService {
  const visibleService = createVisibleWatermarkService();
  const invisibleService = createInvisibleWatermarkService();

  // Cache for encryption keys per tenant
  const encryptionKeyCache = new Map<string, Buffer>();

  /**
   * Get or generate encryption key for tenant
   */
  async function getEncryptionKey(tenantId: string): Promise<Buffer> {
    // Check cache first
    const cached = encryptionKeyCache.get(tenantId);
    if (cached) return cached;

    // Try to get from database
    const storedKey = await repository.getTenantEncryptionKey(tenantId);
    if (storedKey) {
      const key = Buffer.from(storedKey, 'hex');
      encryptionKeyCache.set(tenantId, key);
      return key;
    }

    // Generate new key
    const { encryptionKey } = invisibleService.generateEncryptionKeys();
    encryptionKeyCache.set(tenantId, encryptionKey);

    // TODO: Store key in tenant settings
    // For now, we'll use a derived key from tenant ID
    return encryptionKey;
  }

  /**
   * Build visible watermark payload from session context
   */
  function buildVisiblePayload(
    sessionContext: SessionContext,
    timestamp: Date = new Date()
  ): VisiblePayload {
    return {
      userId: sessionContext.userId,
      userEmail: sessionContext.userEmail,
      sessionId: sessionContext.sessionId,
      tenantId: sessionContext.tenantId,
      podId: sessionContext.podId,
      timestamp,
      ipAddress: sessionContext.ipAddress,
      customText: sessionContext.customText,
    };
  }

  /**
   * Build invisible watermark payload from session context
   */
  function buildInvisiblePayload(
    sessionContext: SessionContext,
    timestamp: Date = new Date(),
    sequenceNumber: number = 0
  ): InvisiblePayload {
    return {
      userId: sessionContext.userId,
      sessionId: sessionContext.sessionId,
      tenantId: sessionContext.tenantId,
      podId: sessionContext.podId,
      timestamp,
      sequenceNumber,
    };
  }

  /**
   * Get or create watermark configuration for tenant
   */
  async function getConfiguration(
    tenantId: string,
    configurationId?: string
  ): Promise<WatermarkConfiguration> {
    // If specific configuration requested, fetch it
    if (configurationId) {
      const config = await repository.findConfigurationById(configurationId);
      if (config && config.tenantId === tenantId) {
        return config;
      }
    }

    // Try to get default configuration
    const defaultConfig = await repository.findDefaultConfiguration(tenantId);
    if (defaultConfig) {
      return defaultConfig;
    }

    // Create default configuration
    return repository.createConfiguration({
      tenantId,
      name: 'Default Configuration',
      isDefault: true,
      visibleEnabled: true,
      visibleConfig: {
        pattern: 'TILED',
        content: ['USER_EMAIL', 'TIMESTAMP'],
        opacity: 0.15,
        fontSize: 14,
        fontFamily: 'Arial',
        fontColor: '#000000',
        rotation: -30,
        spacing: 200,
        margin: 20,
        includeCompanyLogo: false,
      },
      invisibleEnabled: true,
      invisibleConfig: {
        method: 'LSB',
        strength: 'LOW',
        redundancy: 3,
        encodeFields: ['USER_ID', 'SESSION_ID', 'TIMESTAMP'],
      },
    });
  }

  /**
   * Create watermark instance for session
   */
  async function createInstance(
    sessionContext: SessionContext,
    configurationId: string
  ): Promise<WatermarkInstance> {
    // Generate unique payload key
    const { payloadKey: _payloadKey } = invisibleService.generateEncryptionKeys();

    // Calculate invisible key hash
    const invisiblePayload = buildInvisiblePayload(sessionContext);
    const invisibleKey = invisibleService.calculatePayloadHash(invisiblePayload);

    const payload: WatermarkPayload = {
      userId: sessionContext.userId,
      userEmail: sessionContext.userEmail,
      sessionId: sessionContext.sessionId,
      tenantId: sessionContext.tenantId,
      podId: sessionContext.podId,
      timestamp: Date.now(),
      sequenceNumber: 0,
      ipAddress: sessionContext.ipAddress,
    };

    return repository.createInstance({
      configurationId,
      sessionId: sessionContext.sessionId,
      payload,
      visibleHash: undefined,
      invisibleKey,
      generatedAt: new Date(),
    });
  }

  /**
   * Initialize watermarking for a session
   */
  async function initializeSession(
    sessionContext: SessionContext,
    configurationId?: string
  ): Promise<SessionWatermarkConfig> {
    // Get configuration
    const configuration = await getConfiguration(sessionContext.tenantId, configurationId);

    // Create instance
    const instance = await createInstance(sessionContext, configuration.id);

    // Generate visible overlay
    const visibleConfig = configuration.visibleConfig as unknown as VisibleWatermarkConfig;
    const visiblePayload = buildVisiblePayload(sessionContext);
    const visibleOverlay = visibleService.generateOverlay(visibleConfig, visiblePayload);

    return {
      configuration,
      visibleOverlay,
      instanceId: instance.id,
    };
  }

  /**
   * Apply watermark to a video frame
   */
  async function applyToFrame(
    sessionContext: SessionContext,
    frameData: Buffer,
    sequenceNumber: number,
    _instanceId: string
  ): Promise<FrameWatermarkResult> {
    // Get configuration
    const instance = await repository.findInstanceBySession(sessionContext.sessionId);
    if (!instance) {
      throw new Error(`No watermark instance found for session ${sessionContext.sessionId}`);
    }

    const configuration = await repository.findConfigurationById(instance.configurationId);
    if (!configuration) {
      throw new Error(`Configuration not found: ${instance.configurationId}`);
    }

    const invisibleConfig = configuration.invisibleConfig as unknown as InvisibleWatermarkConfig;
    const encryptionKey = await getEncryptionKey(sessionContext.tenantId);
    const payload = buildInvisiblePayload(sessionContext, new Date(), sequenceNumber);

    const result = invisibleService.embedWatermark(
      frameData,
      payload,
      encryptionKey,
      invisibleConfig
    );

    return {
      frameData: result.embeddedData,
      payloadKey: result.payloadKey,
      payloadHash: result.payloadHash,
      method: result.method,
      bytesUsed: result.bytesUsed,
    };
  }

  /**
   * Generate visible watermark overlay for session
   */
  async function generateOverlay(
    sessionContext: SessionContext,
    configurationId?: string
  ): Promise<WatermarkOverlayResult> {
    const configuration = await getConfiguration(sessionContext.tenantId, configurationId);

    const visibleConfig = configuration.visibleConfig as unknown as VisibleWatermarkConfig;
    const payload = buildVisiblePayload(sessionContext);

    return visibleService.generateOverlay(visibleConfig, payload);
  }

  /**
   * Get watermark instance by session
   */
  async function getInstanceBySession(sessionId: string): Promise<WatermarkInstance | null> {
    return repository.findInstanceBySession(sessionId);
  }

  /**
   * Refresh visible watermark (e.g., update timestamp)
   */
  async function refreshVisibleWatermark(
    sessionContext: SessionContext,
    instanceId: string
  ): Promise<WatermarkOverlayResult> {
    const instance = await repository.findInstanceBySession(sessionContext.sessionId);
    if (!instance || instance.id !== instanceId) {
      throw new Error(`Invalid watermark instance: ${instanceId}`);
    }

    const configuration = await repository.findConfigurationById(instance.configurationId);
    if (!configuration) {
      throw new Error(`Configuration not found: ${instance.configurationId}`);
    }

    const visibleConfig = configuration.visibleConfig as unknown as VisibleWatermarkConfig;
    const payload = buildVisiblePayload(sessionContext, new Date());

    return visibleService.generateOverlay(visibleConfig, payload);
  }

  return {
    initializeSession,
    applyToFrame,
    generateOverlay,
    getConfiguration,
    createInstance,
    getInstanceBySession,
    refreshVisibleWatermark,
  };
}
