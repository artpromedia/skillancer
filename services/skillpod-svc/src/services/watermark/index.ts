/**
 * @module @skillancer/skillpod-svc/services/watermark
 * Watermark services barrel export
 */

export {
  createVisibleWatermarkService,
  type VisibleWatermarkService,
  type WatermarkPayload as VisibleWatermarkPayload,
  type WatermarkOverlayResult,
} from './visible-watermark.service.js';

export {
  createInvisibleWatermarkService,
  type InvisibleWatermarkService,
  type WatermarkPayload as InvisibleWatermarkPayload,
  type EncodedPayload,
  type EmbedResult,
  type ExtractResult,
  type EncryptionKeys,
} from './invisible-watermark.service.js';

export {
  createWatermarkDetectorService,
  type WatermarkDetectorService,
  type DetectionRequest,
  type DetectionResult,
  type ScanResult,
  type BulkScanRequest,
  type InvestigationUpdate,
} from './watermark-detector.service.js';

export {
  createWatermarkApplierService,
  type WatermarkApplierService,
  type SessionContext,
  type ApplyWatermarkRequest,
  type AppliedWatermark,
  type FrameWatermarkResult,
  type SessionWatermarkConfig,
} from './watermark-applier.service.js';

export {
  createKasmWatermarkService,
  type KasmWatermarkService,
  type KasmSession,
  type KasmWatermarkConfig,
  type KasmInjectionPayload,
  type KasmWebhookPayload,
  type WebhookResponse,
} from './kasm-watermark.service.js';
