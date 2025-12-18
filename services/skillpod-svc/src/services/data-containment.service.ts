/**
 * @module @skillancer/skillpod-svc/services/data-containment.service
 * Core data containment service for VDI security policy enforcement
 */

// @ts-nocheck - TODO: Fix TypeScript errors related to complex type conversions
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-redundant-type-constituents */

import * as path from 'node:path';

import type { SecurityPolicyService } from './security-policy.service.js';
import type { ViolationDetectionService } from './violation-detection.service.js';
import type {
  ClipboardActionRequest,
  ClipboardActionResponse,
  ContainmentEventCategory,
  ContainmentEventType,
  CreateAuditLogInput,
  FileTransferActionRequest,
  FileTransferActionResponse,
  NetworkAccessRequest,
  NetworkAccessResponse,
  PeripheralAccessRequest,
  PeripheralAccessResponse,
  PodSecurityPolicy,
  SessionSecurityContext,
  TransferDirection,
  ViolationType,
} from '../types/containment.types.js';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

// Re-export types used by other modules
export type {
  ClipboardActionRequest,
  ClipboardActionResponse,
  FileTransferActionRequest,
  FileTransferActionResponse,
  NetworkAccessRequest,
  NetworkAccessResponse,
  PeripheralAccessRequest,
  PeripheralAccessResponse,
  SessionSecurityContext,
} from '../types/containment.types.js';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface DataContainmentService {
  // Session context management
  getSessionContext(sessionId: string): Promise<SessionSecurityContext | null>;
  updateSessionContext(sessionId: string, updates: Partial<SessionSecurityContext>): Promise<void>;

  // Policy enforcement
  checkClipboardAccess(request: ClipboardActionRequest): Promise<ClipboardActionResponse>;
  checkFileTransfer(request: FileTransferActionRequest): Promise<FileTransferActionResponse>;
  checkNetworkAccess(request: NetworkAccessRequest): Promise<NetworkAccessResponse>;
  checkPeripheralAccess(request: PeripheralAccessRequest): Promise<PeripheralAccessResponse>;
  checkPrintAccess(sessionId: string): Promise<{ allowed: boolean; reason?: string }>;
  checkScreenCapture(sessionId: string): Promise<{ allowed: boolean; reason?: string }>;

  // Audit logging
  logContainmentEvent(input: CreateAuditLogInput): Promise<void>;

  // File transfer approval workflow
  createFileTransferRequest(input: {
    sessionId: string;
    tenantId: string;
    requestedBy: string;
    fileName: string;
    fileSize: number;
    direction: TransferDirection;
    purpose: string;
  }): Promise<{ requestId: string; status: string }>;
  approveFileTransfer(requestId: string, approvedBy: string): Promise<void>;
  rejectFileTransfer(requestId: string, rejectedBy: string, reason: string): Promise<void>;

  // Watermark generation
  generateWatermarkConfig(sessionId: string): Promise<{
    enabled: boolean;
    text: string;
    config: Record<string, unknown>;
  }>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check clipboard size and type constraints
 */
function doCheckClipboardConstraints(
  policy: PodSecurityPolicy,
  contentLength: number,
  contentType: string
): { allowed: false; reason: string } | null {
  if (policy.clipboardMaxSize && contentLength > policy.clipboardMaxSize) {
    return {
      allowed: false,
      reason: `Content exceeds max size (${policy.clipboardMaxSize} bytes)`,
    };
  }
  if (policy.clipboardAllowedTypes && policy.clipboardAllowedTypes.length > 0) {
    if (!policy.clipboardAllowedTypes.includes(contentType)) {
      return { allowed: false, reason: `Content type ${contentType} not allowed` };
    }
  }
  return null;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createDataContainmentService(
  prisma: PrismaClient,
  redis: Redis,
  policyService: SecurityPolicyService,
  violationService: ViolationDetectionService
): DataContainmentService {
  // ===========================================================================
  // SESSION CONTEXT MANAGEMENT
  // ===========================================================================

  /**
   * Get the security context for a session
   */
  async function getSessionContext(sessionId: string): Promise<SessionSecurityContext | null> {
    // Check Redis cache first
    const cached = await redis.get(`session:context:${sessionId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Load from database
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        securityPolicy: true,
      },
    });

    if (!session || !session.securityPolicyId) {
      return null;
    }

    const policy = await policyService.getPolicy(session.securityPolicyId);
    if (!policy) {
      return null;
    }

    const violationCount = await violationService.getSessionViolationCount(sessionId);

    const context: SessionSecurityContext = {
      sessionId: session.id,
      tenantId: session.tenantId ?? '',
      userId: session.userId,
      policyId: session.securityPolicyId,
      policy,
      violationCount,
      lastActivity: new Date(),
      sourceIp: ((session.config as Record<string, unknown>)?.sourceIp as string) ?? 'unknown',
    };

    // Cache for 5 minutes
    await redis.setex(`session:context:${sessionId}`, 300, JSON.stringify(context));

    return context;
  }

  /**
   * Update session context (e.g., after activity)
   */
  async function updateSessionContext(
    sessionId: string,
    updates: Partial<SessionSecurityContext>
  ): Promise<void> {
    const existing = await getSessionContext(sessionId);
    if (existing) {
      const updated = { ...existing, ...updates, lastActivity: new Date() };
      await redis.setex(`session:context:${sessionId}`, 300, JSON.stringify(updated));
    }
  }

  // ===========================================================================
  // CLIPBOARD ACCESS CONTROL
  // ===========================================================================

  /**
   * Check clipboard policy and return early response if blocked
   */
  async function checkClipboardPolicy(
    context: SessionSecurityContext,
    request: ClipboardActionRequest
  ): Promise<ClipboardActionResponse | null> {
    const { policy } = context;

    switch (policy.clipboardPolicy) {
      case 'BLOCKED':
        await recordViolationAndLog(
          context,
          request.direction === 'outbound' ? 'CLIPBOARD_COPY_ATTEMPT' : 'CLIPBOARD_PASTE_BLOCKED',
          `Clipboard ${request.direction} blocked by policy`,
          { contentType: request.contentType, contentLength: request.contentLength }
        );
        return { allowed: false, reason: 'Clipboard access is disabled' };

      case 'READ_ONLY':
        if (request.direction === 'outbound') {
          await recordViolationAndLog(
            context,
            'CLIPBOARD_COPY_ATTEMPT',
            'Clipboard copy blocked (read-only policy)',
            { contentType: request.contentType }
          );
          return { allowed: false, reason: 'Copy from session is disabled' };
        }
        return null;

      case 'WRITE_ONLY':
        if (request.direction === 'inbound') {
          await recordViolationAndLog(
            context,
            'CLIPBOARD_PASTE_BLOCKED',
            'Clipboard paste blocked (write-only policy)',
            { contentType: request.contentType }
          );
          return { allowed: false, reason: 'Paste into session is disabled' };
        }
        return null;

      case 'APPROVAL_REQUIRED':
        return {
          allowed: false,
          requiresApproval: true,
          reason: 'Clipboard access requires approval',
        };

      case 'BIDIRECTIONAL':
      default:
        return null;
    }
  }

  /**
   * Check clipboard direction flags
   */
  async function checkClipboardDirectionFlags(
    context: SessionSecurityContext,
    request: ClipboardActionRequest
  ): Promise<ClipboardActionResponse | null> {
    const { policy } = context;

    if (request.direction === 'inbound' && !policy.clipboardInbound) {
      return { allowed: false, reason: 'Paste into session is disabled' };
    }
    if (request.direction === 'outbound' && !policy.clipboardOutbound) {
      await recordViolationAndLog(
        context,
        'CLIPBOARD_COPY_ATTEMPT',
        'Clipboard copy blocked (outbound disabled)',
        { contentType: request.contentType }
      );
      return { allowed: false, reason: 'Copy from session is disabled' };
    }
    return null;
  }

  /**
   * Check if clipboard access is allowed
   */
  async function checkClipboardAccess(
    request: ClipboardActionRequest
  ): Promise<ClipboardActionResponse> {
    const context = await getSessionContext(request.sessionId);
    if (!context) {
      return { allowed: false, reason: 'Session not found' };
    }

    // Check policy
    const policyResult = await checkClipboardPolicy(context, request);
    if (policyResult) return policyResult;

    // Check direction flags
    const directionResult = await checkClipboardDirectionFlags(context, request);
    if (directionResult) return directionResult;

    // Check constraints
    const constraintResult = doCheckClipboardConstraints(
      context.policy,
      request.contentLength,
      request.contentType
    );
    if (constraintResult) return constraintResult;

    // Log the allowed action
    await logContainmentEvent({
      sessionId: context.sessionId,
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: request.direction === 'inbound' ? 'CLIPBOARD_PASTE' : 'CLIPBOARD_COPY',
      eventCategory: 'DATA_TRANSFER',
      description: `Clipboard ${request.direction} allowed`,
      details: { contentType: request.contentType, contentLength: request.contentLength },
      sourceIp: context.sourceIp,
      allowed: true,
      policyId: context.policyId,
    });

    return { allowed: true };
  }

  // ===========================================================================
  // FILE TRANSFER CONTROL
  // ===========================================================================

  /**
   * Check file transfer policy
   */
  async function checkFileTransferPolicy(
    context: SessionSecurityContext,
    request: FileTransferActionRequest,
    isDownload: boolean
  ): Promise<FileTransferActionResponse | null> {
    const transferPolicy = isDownload
      ? context.policy.fileDownloadPolicy
      : context.policy.fileUploadPolicy;

    switch (transferPolicy) {
      case 'BLOCKED':
        await recordViolationAndLog(
          context,
          isDownload ? 'FILE_DOWNLOAD_BLOCKED' : 'FILE_UPLOAD_BLOCKED',
          `File ${request.direction.toLowerCase()} blocked: ${request.fileName}`,
          { fileName: request.fileName, fileType: request.fileType, fileSize: request.fileSize }
        );
        return { allowed: false, reason: `File ${request.direction.toLowerCase()}s are disabled` };

      case 'APPROVAL_REQUIRED': {
        const result = await createFileTransferRequest({
          sessionId: request.sessionId,
          tenantId: context.tenantId,
          requestedBy: context.userId,
          fileName: request.fileName,
          fileSize: request.fileSize,
          direction: request.direction,
          purpose: 'User initiated transfer',
        });
        return {
          allowed: false,
          requiresApproval: true,
          requestId: result.requestId,
          reason: 'File transfer requires approval',
        };
      }

      case 'LOGGED_ONLY':
      case 'ALLOWED':
      default:
        return null;
    }
  }

  /**
   * Check file type constraints
   */
  async function checkFileTypeConstraints(
    context: SessionSecurityContext,
    request: FileTransferActionRequest,
    isDownload: boolean
  ): Promise<FileTransferActionResponse | null> {
    const { policy } = context;
    const fileExt = path.extname(request.fileName).toLowerCase();

    if (policy.blockedFileTypes && policy.blockedFileTypes.length > 0) {
      if (policy.blockedFileTypes.includes('*') || policy.blockedFileTypes.includes(fileExt)) {
        await recordViolationAndLog(
          context,
          isDownload ? 'FILE_DOWNLOAD_BLOCKED' : 'FILE_UPLOAD_BLOCKED',
          `Blocked file type: ${fileExt}`,
          { fileName: request.fileName, fileType: fileExt }
        );
        return { allowed: false, reason: `File type ${fileExt} is not allowed` };
      }
    }

    if (policy.allowedFileTypes && policy.allowedFileTypes.length > 0) {
      if (!policy.allowedFileTypes.includes(fileExt)) {
        return { allowed: false, reason: `File type ${fileExt} is not in allowed list` };
      }
    }

    return null;
  }

  /**
   * Check if file transfer is allowed
   */
  async function checkFileTransfer(
    request: FileTransferActionRequest
  ): Promise<FileTransferActionResponse> {
    const context = await getSessionContext(request.sessionId);
    if (!context) {
      return { allowed: false, reason: 'Session not found' };
    }

    const isDownload = request.direction === 'DOWNLOAD';

    // Check transfer policy
    const policyResult = await checkFileTransferPolicy(context, request, isDownload);
    if (policyResult) return policyResult;

    // Check file size
    if (context.policy.maxFileSize && request.fileSize > context.policy.maxFileSize) {
      return {
        allowed: false,
        reason: `File exceeds max size (${formatBytes(context.policy.maxFileSize)})`,
      };
    }

    // Check file type constraints
    const typeResult = await checkFileTypeConstraints(context, request, isDownload);
    if (typeResult) return typeResult;

    // Log the allowed transfer
    const fileExt = path.extname(request.fileName).toLowerCase();
    await logContainmentEvent({
      sessionId: context.sessionId,
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: isDownload ? 'FILE_DOWNLOAD' : 'FILE_UPLOAD',
      eventCategory: 'DATA_TRANSFER',
      description: `File ${request.direction.toLowerCase()} allowed: ${request.fileName}`,
      details: {
        fileName: request.fileName,
        fileType: fileExt,
        fileSize: request.fileSize,
        fileHash: request.fileHash,
      },
      sourceIp: context.sourceIp,
      targetResource: request.fileName,
      allowed: true,
      policyId: context.policyId,
    });

    return { allowed: true };
  }

  // ===========================================================================
  // NETWORK ACCESS CONTROL
  // ===========================================================================

  /**
   * Check if network access to a URL is allowed
   */
  async function checkNetworkAccess(request: NetworkAccessRequest): Promise<NetworkAccessResponse> {
    const context = await getSessionContext(request.sessionId);
    if (!context) {
      return { allowed: false, reason: 'Session not found' };
    }

    const { policy } = context;

    // Parse URL to get domain
    let domain: string;
    try {
      const url = new URL(request.targetUrl);
      domain = url.hostname;
    } catch {
      return { allowed: false, reason: 'Invalid URL' };
    }

    // Check network policy
    switch (policy.networkPolicy) {
      case 'BLOCKED':
        await recordViolationAndLog(
          context,
          'NETWORK_ACCESS_BLOCKED',
          `Network access blocked: ${domain}`,
          { targetUrl: request.targetUrl, protocol: request.protocol }
        );
        return { allowed: false, reason: 'Network access is disabled' };

      case 'RESTRICTED':
        // Only allow whitelisted domains
        if (!policy.allowedDomains?.some((d) => matchDomain(domain, d))) {
          await recordViolationAndLog(
            context,
            'NETWORK_ACCESS_BLOCKED',
            `Domain not in whitelist: ${domain}`,
            { targetUrl: request.targetUrl }
          );
          return { allowed: false, reason: `Access to ${domain} is not allowed` };
        }
        break;

      case 'MONITORED':
      case 'UNRESTRICTED':
        // Check blocklist even for unrestricted
        if (policy.blockedDomains?.some((d) => matchDomain(domain, d))) {
          await recordViolationAndLog(
            context,
            'NETWORK_ACCESS_BLOCKED',
            `Domain in blocklist: ${domain}`,
            { targetUrl: request.targetUrl }
          );
          return { allowed: false, reason: `Access to ${domain} is blocked` };
        }
        break;
    }

    // Check general internet access
    if (!policy.allowInternet && !isInternalDomain(domain)) {
      return { allowed: false, reason: 'Internet access is disabled' };
    }

    // Log for monitored connections
    if (policy.networkPolicy === 'MONITORED' || policy.networkPolicy === 'UNRESTRICTED') {
      await logContainmentEvent({
        sessionId: context.sessionId,
        tenantId: context.tenantId,
        userId: context.userId,
        eventType: 'NETWORK_REQUEST',
        eventCategory: 'NETWORK',
        description: `Network access: ${domain}`,
        details: { targetUrl: request.targetUrl, protocol: request.protocol },
        sourceIp: context.sourceIp,
        targetResource: request.targetUrl,
        allowed: true,
        policyId: context.policyId,
      });
    }

    return { allowed: true };
  }

  // ===========================================================================
  // PERIPHERAL ACCESS CONTROL
  // ===========================================================================

  /**
   * Check if peripheral access is allowed
   */
  async function checkPeripheralAccess(
    request: PeripheralAccessRequest
  ): Promise<PeripheralAccessResponse> {
    const context = await getSessionContext(request.sessionId);
    if (!context) {
      return { allowed: false, reason: 'Session not found' };
    }

    const { policy } = context;

    switch (request.deviceType) {
      case 'usb':
        return checkUsbAccess(context, policy, request);

      case 'webcam':
        return checkCameraAccess(policy.webcamPolicy);

      case 'microphone':
        return checkCameraAccess(policy.microphonePolicy);

      case 'printer': {
        const printResult = await checkPrintAccess(request.sessionId);
        return printResult;
      }

      default:
        return { allowed: false, reason: 'Unknown device type' };
    }
  }

  /**
   * Check USB device access
   */
  async function checkUsbAccess(
    context: SessionSecurityContext,
    policy: PodSecurityPolicy,
    request: PeripheralAccessRequest
  ): Promise<PeripheralAccessResponse> {
    switch (policy.usbPolicy) {
      case 'BLOCKED':
        await recordViolationAndLog(
          context,
          'USB_DEVICE_BLOCKED',
          `USB device blocked: ${request.deviceId || 'unknown'}`,
          { deviceId: request.deviceId, deviceClass: request.deviceClass }
        );
        return { allowed: false, reason: 'USB devices are disabled' };

      case 'STORAGE_BLOCKED':
        // Block storage class (0x08)
        if (request.deviceClass === '0x08' || request.deviceClass === 'mass_storage') {
          await recordViolationAndLog(context, 'USB_DEVICE_BLOCKED', 'USB storage device blocked', {
            deviceId: request.deviceId,
            deviceClass: request.deviceClass,
          });
          return { allowed: false, reason: 'USB storage devices are blocked' };
        }
        return { allowed: true };

      case 'WHITELIST_ONLY':
        if (!policy.allowedUsbDevices?.includes(request.deviceId || '')) {
          await recordViolationAndLog(
            context,
            'USB_DEVICE_BLOCKED',
            'USB device not in whitelist',
            { deviceId: request.deviceId }
          );
          return { allowed: false, reason: 'USB device not in approved list' };
        }
        return { allowed: true };

      case 'ALLOWED':
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Invalid USB policy' };
    }
  }

  // ===========================================================================
  // PRINT ACCESS CONTROL
  // ===========================================================================

  /**
   * Check if printing is allowed
   */
  async function checkPrintAccess(
    sessionId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const context = await getSessionContext(sessionId);
    if (!context) {
      return { allowed: false, reason: 'Session not found' };
    }

    const { policy } = context;

    switch (policy.printingPolicy) {
      case 'BLOCKED':
        await recordViolationAndLog(
          context,
          'PRINT_BLOCKED',
          'Print request blocked by policy',
          {}
        );
        return { allowed: false, reason: 'Printing is disabled' };

      case 'LOCAL_ONLY':
        if (!policy.allowLocalPrinting) {
          return { allowed: false, reason: 'Local printing is not allowed' };
        }
        return { allowed: true };

      case 'PDF_ONLY':
        if (!policy.allowPdfExport) {
          return { allowed: false, reason: 'PDF export is not allowed' };
        }
        return { allowed: true };

      case 'APPROVAL_REQUIRED':
        return { allowed: false, reason: 'Print requests require approval' };

      case 'ALLOWED':
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Invalid printing policy' };
    }
  }

  // ===========================================================================
  // SCREEN CAPTURE CONTROL
  // ===========================================================================

  /**
   * Check if screen capture should be blocked
   */
  async function checkScreenCapture(
    sessionId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const context = await getSessionContext(sessionId);
    if (!context) {
      return { allowed: false, reason: 'Session not found' };
    }

    const { policy } = context;

    if (policy.screenCaptureBlocking) {
      await recordViolationAndLog(
        context,
        'SCREEN_CAPTURE_ATTEMPT',
        'Screen capture attempt detected and blocked',
        {}
      );
      return { allowed: false, reason: 'Screen capture is blocked' };
    }

    return { allowed: true };
  }

  // ===========================================================================
  // AUDIT LOGGING
  // ===========================================================================

  /**
   * Log a containment event
   */
  async function logContainmentEvent(input: CreateAuditLogInput): Promise<void> {
    await prisma.containmentAuditLog.create({
      data: {
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        userId: input.userId,
        eventType: input.eventType,
        eventCategory: input.eventCategory,
        description: input.description,
        details: input.details ?? {},
        sourceIp: input.sourceIp,
        targetResource: input.targetResource,
        allowed: input.allowed,
        blockedReason: input.blockedReason,
        policyId: input.policyId,
      },
    });
  }

  // ===========================================================================
  // FILE TRANSFER APPROVAL WORKFLOW
  // ===========================================================================

  /**
   * Create a file transfer request
   */
  async function createFileTransferRequest(input: {
    sessionId: string;
    tenantId: string;
    requestedBy: string;
    fileName: string;
    fileSize: number;
    direction: TransferDirection;
    purpose: string;
  }): Promise<{ requestId: string; status: string }> {
    const fileExt = path.extname(input.fileName).toLowerCase();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const request = await prisma.fileTransferRequest.create({
      data: {
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        fileName: input.fileName,
        fileType: fileExt,
        fileSize: input.fileSize,
        direction: input.direction,
        purpose: input.purpose,
        expiresAt,
        status: 'PENDING',
      },
    });

    // Publish notification for approvers
    await redis.publish(
      'file:transfer:request',
      JSON.stringify({
        requestId: request.id,
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        fileName: input.fileName,
        direction: input.direction,
      })
    );

    return { requestId: request.id, status: 'PENDING' };
  }

  /**
   * Approve a file transfer request
   */
  async function approveFileTransfer(requestId: string, approvedBy: string): Promise<void> {
    await prisma.fileTransferRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });

    // Publish approval notification
    await redis.publish('file:transfer:approved', JSON.stringify({ requestId, approvedBy }));
  }

  /**
   * Reject a file transfer request
   */
  async function rejectFileTransfer(
    requestId: string,
    rejectedBy: string,
    reason: string
  ): Promise<void> {
    await prisma.fileTransferRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });

    // Publish rejection notification
    await redis.publish(
      'file:transfer:rejected',
      JSON.stringify({ requestId, rejectedBy, reason })
    );
  }

  // ===========================================================================
  // WATERMARK CONFIGURATION
  // ===========================================================================

  /**
   * Generate watermark configuration for a session
   */
  async function generateWatermarkConfig(sessionId: string): Promise<{
    enabled: boolean;
    text: string;
    config: Record<string, unknown>;
  }> {
    const context = await getSessionContext(sessionId);
    if (!context) {
      return { enabled: false, text: '', config: {} };
    }

    const { policy } = context;

    if (!policy.watermarkEnabled) {
      return { enabled: false, text: '', config: {} };
    }

    const wmConfig = policy.watermarkConfig || {};
    const textParts: string[] = [];

    if (wmConfig.text) {
      textParts.push(wmConfig.text);
    }
    if (wmConfig.showUsername) {
      // Fetch username
      const user = await prisma.user.findUnique({
        where: { id: context.userId },
        select: { email: true },
      });
      textParts.push(user?.email || context.userId);
    }
    if (wmConfig.showTimestamp) {
      textParts.push(new Date().toISOString());
    }
    if (wmConfig.showIpAddress) {
      textParts.push(context.sourceIp);
    }

    return {
      enabled: true,
      text: textParts.join(' | '),
      config: {
        position: wmConfig.position || 'corner',
        opacity: wmConfig.opacity || 0.2,
        fontSize: wmConfig.fontSize || 12,
        color: wmConfig.color || '#888888',
      },
    };
  }

  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================

  /**
   * Record a violation and log the event
   */
  async function recordViolationAndLog(
    context: SessionSecurityContext,
    violationType: ViolationType,
    description: string,
    details: Record<string, unknown>
  ): Promise<void> {
    // Record violation
    await violationService.recordViolation({
      sessionId: context.sessionId,
      tenantId: context.tenantId,
      violationType,
      description,
      details,
      sourceIp: context.sourceIp,
    });

    // Log the event
    const eventType = mapViolationToEventType(violationType);
    const eventCategory = mapViolationToCategory(violationType);

    await logContainmentEvent({
      sessionId: context.sessionId,
      tenantId: context.tenantId,
      userId: context.userId,
      eventType,
      eventCategory,
      description,
      details,
      sourceIp: context.sourceIp,
      allowed: false,
      blockedReason: description,
      policyId: context.policyId,
    });
  }

  return {
    getSessionContext,
    updateSessionContext,
    checkClipboardAccess,
    checkFileTransfer,
    checkNetworkAccess,
    checkPeripheralAccess,
    checkPrintAccess,
    checkScreenCapture,
    logContainmentEvent,
    createFileTransferRequest,
    approveFileTransfer,
    rejectFileTransfer,
    generateWatermarkConfig,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if domain matches a pattern (supports wildcards)
 */
function matchDomain(domain: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const baseDomain = pattern.slice(2);
    return domain === baseDomain || domain.endsWith('.' + baseDomain);
  }
  return domain === pattern;
}

/**
 * Check if domain is internal
 */
function isInternalDomain(domain: string): boolean {
  return (
    domain === 'localhost' ||
    domain.endsWith('.local') ||
    domain.endsWith('.internal') ||
    /^10\.\d+\.\d+\.\d+$/.test(domain) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(domain) ||
    /^192\.168\.\d+\.\d+$/.test(domain)
  );
}

/**
 * Map violation type to event type
 */
function mapViolationToEventType(violationType: ViolationType): ContainmentEventType {
  const mapping: Record<ViolationType, ContainmentEventType> = {
    CLIPBOARD_COPY_ATTEMPT: 'CLIPBOARD_COPY',
    CLIPBOARD_PASTE_BLOCKED: 'CLIPBOARD_PASTE',
    FILE_DOWNLOAD_BLOCKED: 'FILE_DOWNLOAD',
    FILE_UPLOAD_BLOCKED: 'FILE_UPLOAD',
    SCREEN_CAPTURE_ATTEMPT: 'SCREEN_CAPTURE',
    USB_DEVICE_BLOCKED: 'USB_CONNECT',
    NETWORK_ACCESS_BLOCKED: 'NETWORK_REQUEST',
    PRINT_BLOCKED: 'PRINT_REQUEST',
    SESSION_TIMEOUT: 'SESSION_END',
    IDLE_TIMEOUT: 'SESSION_END',
    UNAUTHORIZED_PERIPHERAL: 'PERIPHERAL_ACCESS',
    POLICY_BYPASS_ATTEMPT: 'POLICY_CHANGE',
    SUSPICIOUS_ACTIVITY: 'POLICY_CHANGE',
  };
  return mapping[violationType] || 'POLICY_CHANGE';
}

/**
 * Map violation type to event category
 */
function mapViolationToCategory(violationType: ViolationType): ContainmentEventCategory {
  switch (violationType) {
    case 'CLIPBOARD_COPY_ATTEMPT':
    case 'CLIPBOARD_PASTE_BLOCKED':
    case 'FILE_DOWNLOAD_BLOCKED':
    case 'FILE_UPLOAD_BLOCKED':
      return 'DATA_TRANSFER';

    case 'USB_DEVICE_BLOCKED':
    case 'UNAUTHORIZED_PERIPHERAL':
      return 'DEVICE_ACCESS';

    case 'NETWORK_ACCESS_BLOCKED':
      return 'NETWORK';

    case 'SESSION_TIMEOUT':
    case 'IDLE_TIMEOUT':
      return 'SESSION';

    default:
      return 'SECURITY';
  }
}

/**
 * Check camera/microphone access
 */
function checkCameraAccess(peripheralPolicy: string | undefined): PeripheralAccessResponse {
  switch (peripheralPolicy) {
    case 'BLOCKED':
      return { allowed: false, reason: 'Device access is disabled' };

    case 'SESSION_PROMPT':
      return { allowed: false, requiresPrompt: true, reason: 'User confirmation required' };

    case 'ALLOWED':
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Invalid peripheral policy' };
  }
}
