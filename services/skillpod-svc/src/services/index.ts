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
