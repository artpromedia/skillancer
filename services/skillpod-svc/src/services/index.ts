/**
 * @module @skillancer/skillpod-svc/services
 * Services index
 */

export { createSecurityPolicyService, PRESET_POLICIES } from './security-policy.service.js';
export type { SecurityPolicyService } from './security-policy.service.js';

export { createViolationDetectionService } from './violation-detection.service.js';
export type { ViolationDetectionService } from './violation-detection.service.js';

export { createDataContainmentService } from './data-containment.service.js';
export type { DataContainmentService } from './data-containment.service.js';

export { createKasmWorkspacesService } from './kasm-workspaces.service.js';
export type {
  KasmWorkspacesService,
  KasmSecurityConfig,
  KasmWorkspace,
  WorkspaceStatus,
  SessionMetrics,
  RecordingResult,
  WatermarkApiConfig,
} from './kasm-workspaces.service.js';

export { createWebSocketEnforcementService } from './websocket-enforcement.service.js';
export type {
  WebSocketEnforcementService,
  PolicyViolation,
  PolicyEnforcementConfig,
  WebSocketMessage,
  SessionConnection,
} from './websocket-enforcement.service.js';

export { createScreenshotDetectionService } from './screenshot-detection.service.js';
export type {
  ScreenshotDetectionService,
  ScreenCaptureEvent,
  DetectionResult,
  DetectionConfig,
  CaptureType,
} from './screenshot-detection.service.js';

export { createCdnService } from './cdn.service.js';
export type { CdnService, InvalidationRequest, InvalidationResult } from './cdn.service.js';

export { createKillSwitchService } from './kill-switch.service.js';
export type {
  KillSwitchService,
  KillSwitchParams,
  KillSwitchResult,
  KillSwitchTargets,
  KillSwitchScope,
  KillSwitchReason,
  KillSwitchStatus,
  AccessBlockStatus,
  ReinstateAccessParams,
} from './kill-switch.service.js';

export { createDLPService } from './dlp.service.js';
export type {
  DLPService,
  TransferEvaluationParams,
  TransferEvaluationResult,
  SensitiveDataMatch,
  DLPScanResult,
} from './dlp.service.js';

export { createRecordingService } from './recording.service.js';
export type {
  RecordingService,
  RecordingConfig,
  StartRecordingParams,
  StartRecordingResult,
  StopRecordingParams,
  StopRecordingResult,
  ChunkUploadParams,
  ChunkUploadResult,
  ProcessRecordingResult,
  OcrProcessingResult,
  PlaybackUrlResult,
  SearchRecordingsParams,
  SearchResult,
  AddMarkerParams,
  LogAccessParams,
  CreateRetentionPolicyParams,
  RecordingStats,
} from './recording.service.js';

// Watermark services
export {
  createVisibleWatermarkService,
  createInvisibleWatermarkService,
  createWatermarkDetectorService,
  createWatermarkApplierService,
  createKasmWatermarkService,
} from './watermark/index.js';
export type {
  VisibleWatermarkService,
  InvisibleWatermarkService,
  WatermarkDetectorService,
  WatermarkApplierService,
  KasmWatermarkService,
  SessionContext,
  WatermarkOverlayResult,
  DetectionResult as WatermarkDetectionResult,
  KasmInjectionPayload,
} from './watermark/index.js';

// Environment management services
export { createECRService } from './ecr.service.js';
export type { ECRService, ECRBuildResult, ECRListResult, ImageInfo } from './ecr.service.js';

export { createMetricsService } from './metrics.service.js';
export type { MetricsService, PodMetrics } from './metrics.service.js';

export { createStorageService } from './storage.service.js';
export type {
  StorageService,
  CreateVolumeParams,
  VolumeInfo,
  ResizeVolumeParams,
  AttachVolumeParams,
  DetachVolumeParams,
} from './storage.service.js';

export { createTemplateService, TemplateError } from './template.service.js';
export type { TemplateService } from './template.service.js';

export { createPodService, PodError } from './pod.service.js';
export type { PodService, ListPodsParams } from './pod.service.js';

export { createAutoScalingService } from './auto-scaling.service.js';
export type { AutoScalingService, CooldownStatus, ScalingEvent } from './auto-scaling.service.js';

export { createResourcePoolService } from './resource-pool.service.js';
export type {
  ResourcePoolService,
  CreatePoolParams,
  UpdatePoolParams,
  PoolCapacity,
  AvailableCapacity,
  CapacityCheck,
  ReservationToken,
  QuotaTier,
} from './resource-pool.service.js';
