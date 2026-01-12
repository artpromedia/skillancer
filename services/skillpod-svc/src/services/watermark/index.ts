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

// DCT watermarking exports
export {
  embedDCT,
  extractDCT,
  calculateDCTCapacity,
  type DCTConfig,
  type DCTEmbedResult,
  type DCTExtractResult,
} from './dct-watermark.js';

// DWT watermarking exports
export {
  embedDWT,
  extractDWT,
  calculateDWTCapacity,
  analyzeDWTParameters,
  type DWTConfig,
  type DWTEmbedResult,
  type DWTExtractResult,
} from './dwt-watermark.js';

// Transform utilities exports
export {
  dct1D,
  idct1D,
  dct2D,
  idct2D,
  dwt2D,
  idwt2D,
  dwtMultiLevel,
  idwtMultiLevel,
  bufferToChannel,
  channelToBuffer,
  calculatePSNR,
  type TransformConfig,
  type TransformResult,
  type WaveletCoefficients,
} from './transforms.js';
