/**
 * @module @skillancer/skillpod-svc/types
 * TypeScript types for SkillPod data containment
 */

// =============================================================================
// POLICY TYPES
// =============================================================================

export type ClipboardPolicy =
  | 'BLOCKED'
  | 'READ_ONLY'
  | 'WRITE_ONLY'
  | 'BIDIRECTIONAL'
  | 'APPROVAL_REQUIRED';
export type FileTransferPolicy = 'BLOCKED' | 'ALLOWED' | 'APPROVAL_REQUIRED' | 'LOGGED_ONLY';
export type PrintingPolicy =
  | 'BLOCKED'
  | 'LOCAL_ONLY'
  | 'PDF_ONLY'
  | 'ALLOWED'
  | 'APPROVAL_REQUIRED';
export type UsbPolicy = 'BLOCKED' | 'STORAGE_BLOCKED' | 'WHITELIST_ONLY' | 'ALLOWED';
export type PeripheralPolicy = 'BLOCKED' | 'ALLOWED' | 'SESSION_PROMPT';
export type NetworkPolicy = 'BLOCKED' | 'RESTRICTED' | 'MONITORED' | 'UNRESTRICTED';

export type ViolationType =
  | 'CLIPBOARD_COPY_ATTEMPT'
  | 'CLIPBOARD_PASTE_BLOCKED'
  | 'FILE_DOWNLOAD_BLOCKED'
  | 'FILE_UPLOAD_BLOCKED'
  | 'SCREEN_CAPTURE_ATTEMPT'
  | 'USB_DEVICE_BLOCKED'
  | 'NETWORK_ACCESS_BLOCKED'
  | 'PRINT_BLOCKED'
  | 'SESSION_TIMEOUT'
  | 'IDLE_TIMEOUT'
  | 'UNAUTHORIZED_PERIPHERAL'
  | 'POLICY_BYPASS_ATTEMPT'
  | 'SUSPICIOUS_ACTIVITY';

export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ViolationAction =
  | 'LOGGED'
  | 'WARNED'
  | 'BLOCKED'
  | 'SESSION_TERMINATED'
  | 'USER_SUSPENDED'
  | 'INCIDENT_CREATED';

export type TransferDirection = 'UPLOAD' | 'DOWNLOAD';
export type TransferRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ContainmentEventType =
  | 'CLIPBOARD_COPY'
  | 'CLIPBOARD_PASTE'
  | 'FILE_DOWNLOAD'
  | 'FILE_UPLOAD'
  | 'PRINT_REQUEST'
  | 'USB_CONNECT'
  | 'USB_DISCONNECT'
  | 'NETWORK_REQUEST'
  | 'SCREEN_CAPTURE'
  | 'PERIPHERAL_ACCESS'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'POLICY_CHANGE'
  | 'WATERMARK_DISPLAYED';

export type ContainmentEventCategory =
  | 'DATA_TRANSFER'
  | 'DEVICE_ACCESS'
  | 'NETWORK'
  | 'SESSION'
  | 'SECURITY'
  | 'CONFIGURATION';

// =============================================================================
// SECURITY POLICY INTERFACES
// =============================================================================

export interface WatermarkConfig {
  text?: string;
  showUsername: boolean;
  showTimestamp: boolean;
  showIpAddress: boolean;
  position: 'center' | 'corner' | 'tiled';
  opacity: number;
  fontSize: number;
  color: string;
}

export interface PodSecurityPolicyInput {
  name: string;
  description?: string;
  isDefault?: boolean;

  // Clipboard controls
  clipboardPolicy?: ClipboardPolicy;
  clipboardInbound?: boolean;
  clipboardOutbound?: boolean;
  clipboardMaxSize?: number;
  clipboardAllowedTypes?: string[];

  // File transfer controls
  fileDownloadPolicy?: FileTransferPolicy;
  fileUploadPolicy?: FileTransferPolicy;
  allowedFileTypes?: string[];
  blockedFileTypes?: string[];
  maxFileSize?: number;

  // Printing controls
  printingPolicy?: PrintingPolicy;
  allowLocalPrinting?: boolean;
  allowPdfExport?: boolean;

  // Peripheral controls
  usbPolicy?: UsbPolicy;
  allowedUsbDevices?: string[];
  webcamPolicy?: PeripheralPolicy;
  microphonePolicy?: PeripheralPolicy;

  // Screen capture controls
  screenCaptureBlocking?: boolean;
  watermarkEnabled?: boolean;
  watermarkConfig?: WatermarkConfig;

  // Network controls
  networkPolicy?: NetworkPolicy;
  allowedDomains?: string[];
  blockedDomains?: string[];
  allowInternet?: boolean;

  // Session controls
  idleTimeout?: number;
  maxSessionDuration?: number;
  requireMfa?: boolean;

  // Audit settings
  recordSession?: boolean;
  logKeystrokes?: boolean;
  logClipboard?: boolean;
  logFileAccess?: boolean;
}

export interface PodSecurityPolicy extends PodSecurityPolicyInput {
  id: string;
  tenantId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// VIOLATION INTERFACES
// =============================================================================

export interface ViolationDetails {
  attemptedAction?: string;
  blockedContent?: string;
  targetResource?: string;
  deviceInfo?: {
    deviceId?: string;
    deviceName?: string;
    deviceClass?: string;
  };
  networkInfo?: {
    targetUrl?: string;
    targetIp?: string;
    protocol?: string;
  };
  fileInfo?: {
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    fileHash?: string;
  };
  clipboardInfo?: {
    contentType?: string;
    contentLength?: number;
    truncatedContent?: string;
  };
}

export interface CreateViolationInput {
  sessionId: string;
  tenantId: string;
  violationType: ViolationType;
  severity?: ViolationSeverity;
  description: string;
  details?: ViolationDetails;
  sourceIp?: string;
  userAgent?: string;
}

export interface SecurityViolation extends CreateViolationInput {
  id: string;
  action: ViolationAction;
  actionDetails?: Record<string, unknown>;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
}

// =============================================================================
// FILE TRANSFER INTERFACES
// =============================================================================

export interface CreateFileTransferRequestInput {
  sessionId: string;
  tenantId: string;
  requestedBy: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash?: string;
  direction: TransferDirection;
  purpose: string;
  expiresAt?: Date;
  maxDownloads?: number;
}

export interface FileTransferRequest extends CreateFileTransferRequestInput {
  id: string;
  status: TransferRequestStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  transferStartedAt?: Date;
  transferCompletedAt?: Date;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// AUDIT LOG INTERFACES
// =============================================================================

export interface CreateAuditLogInput {
  sessionId: string;
  tenantId: string;
  userId: string;
  eventType: ContainmentEventType;
  eventCategory: ContainmentEventCategory;
  description: string;
  details?: Record<string, unknown>;
  sourceIp?: string;
  targetResource?: string;
  allowed: boolean;
  blockedReason?: string;
  policyId?: string;
}

export interface ContainmentAuditLog extends CreateAuditLogInput {
  id: string;
  createdAt: Date;
}

// =============================================================================
// ACTION REQUEST/RESPONSE INTERFACES
// =============================================================================

export interface ClipboardActionRequest {
  sessionId: string;
  direction: 'inbound' | 'outbound';
  contentType: string;
  contentLength: number;
  contentHash?: string;
}

export interface ClipboardActionResponse {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

export interface FileTransferActionRequest {
  sessionId: string;
  direction: TransferDirection;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash?: string;
}

export interface FileTransferActionResponse {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  requestId?: string;
}

export interface NetworkAccessRequest {
  sessionId: string;
  targetUrl: string;
  protocol: string;
}

export interface NetworkAccessResponse {
  allowed: boolean;
  reason?: string;
}

export interface PeripheralAccessRequest {
  sessionId: string;
  deviceType: 'usb' | 'webcam' | 'microphone' | 'printer';
  deviceId?: string;
  deviceClass?: string;
}

export interface PeripheralAccessResponse {
  allowed: boolean;
  reason?: string;
  requiresPrompt?: boolean;
}

// =============================================================================
// SESSION CONTEXT
// =============================================================================

export interface SessionSecurityContext {
  sessionId: string;
  tenantId: string;
  userId: string;
  policyId: string;
  policy: PodSecurityPolicy;
  violationCount: number;
  lastActivity: Date;
  sourceIp: string;
}

// =============================================================================
// DASHBOARD/REPORTING INTERFACES
// =============================================================================

export interface ViolationSummary {
  total: number;
  byType: Record<ViolationType, number>;
  bySeverity: Record<ViolationSeverity, number>;
  byAction: Record<ViolationAction, number>;
  recentViolations: SecurityViolation[];
}

export interface ContainmentMetrics {
  totalSessions: number;
  activeSessions: number;
  totalViolations: number;
  blockedTransfers: number;
  pendingApprovals: number;
  averageSessionDuration: number;
}
