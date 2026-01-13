/**
 * @module @skillancer/skillpod-svc/services/dlp
 * Data Loss Prevention (DLP) service for sensitive data scanning and transfer evaluation
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */

import crypto from 'node:crypto';

import type { SecurityPolicyService } from './security-policy.service.js';
import type { TransferDirection } from '../types/containment.types.js';
import type { PrismaClient } from '@/types/prisma-shim.js';
import type { Redis } from 'ioredis';

// =============================================================================
// TYPES
// =============================================================================

export type TransferType =
  | 'CLIPBOARD_TEXT'
  | 'CLIPBOARD_IMAGE'
  | 'CLIPBOARD_FILE'
  | 'FILE_DOWNLOAD'
  | 'FILE_UPLOAD'
  | 'USB_TRANSFER'
  | 'PRINT'
  | 'SCREEN_SHARE';

export type TransferAction = 'ALLOWED' | 'BLOCKED' | 'LOGGED' | 'QUARANTINED' | 'OVERRIDE_APPROVED';

export interface TransferRequest {
  podId: string;
  sessionId: string;
  userId: string;
  tenantId: string;
  transferType: TransferType;
  direction: TransferDirection;
  contentType?: string;
  contentSize?: number;
  content?: Buffer;
  fileName?: string;
  sourceApplication?: string;
  targetApplication?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferResult {
  allowed: boolean;
  action: TransferAction;
  reason?: string;
  contentHash?: string;
  sensitiveDataTypes?: string[];
  requiresApproval?: boolean;
  attemptId?: string;
}

export interface SensitiveDataPattern {
  name: string;
  pattern: RegExp;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'PII' | 'FINANCIAL' | 'CREDENTIALS' | 'HEALTH' | 'CONFIDENTIAL';
}

export interface MalwareScanResult {
  clean: boolean;
  threatName?: string;
  threatType?: string;
  scanEngine: string;
  scanTime: Date;
}

export interface DLPConfig {
  enableSensitiveDataScanning: boolean;
  enableMalwareScanning: boolean;
  sensitiveDataPatterns: SensitiveDataPattern[];
  malwareScannerEndpoint?: string;
  maxFileSizeForScanning: number;
  scanTimeout: number;
}

// =============================================================================
// SENSITIVE DATA PATTERNS
// =============================================================================

const DEFAULT_SENSITIVE_PATTERNS: SensitiveDataPattern[] = [
  // Credit Card Numbers - Visa
  {
    name: 'Credit Card Number (Visa)',
    pattern: /\b4\d{12}(?:\d{3})?\b/g,
    severity: 'CRITICAL',
    category: 'FINANCIAL',
  },
  // Credit Card Numbers - MasterCard
  {
    name: 'Credit Card Number (MasterCard)',
    pattern: /\b5[1-5]\d{14}\b/g,
    severity: 'CRITICAL',
    category: 'FINANCIAL',
  },
  // Credit Card Numbers - Amex
  {
    name: 'Credit Card Number (Amex)',
    pattern: /\b3[47]\d{13}\b/g,
    severity: 'CRITICAL',
    category: 'FINANCIAL',
  },
  // Credit Card Numbers - Discover
  {
    name: 'Credit Card Number (Discover)',
    pattern: /\b6(?:011|5\d{2})\d{12}\b/g,
    severity: 'CRITICAL',
    category: 'FINANCIAL',
  },
  // Credit Card Number with separators
  {
    name: 'Credit Card Number (formatted)',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    severity: 'HIGH',
    category: 'FINANCIAL',
  },
  // US Social Security Numbers
  {
    name: 'SSN',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    severity: 'CRITICAL',
    category: 'PII',
  },
  // US Phone Numbers
  {
    name: 'US Phone Number',
    pattern: /\b(?:\+1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    severity: 'MEDIUM',
    category: 'PII',
  },
  // Email Addresses
  {
    name: 'Email Address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    severity: 'LOW',
    category: 'PII',
  },
  // AWS Access Keys
  {
    name: 'AWS Access Key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: 'CRITICAL',
    category: 'CREDENTIALS',
  },
  // AWS Secret Keys
  {
    name: 'AWS Secret Key',
    pattern: /\b[A-Za-z0-9/+=]{40}\b/g,
    severity: 'CRITICAL',
    category: 'CREDENTIALS',
  },
  // GitHub Personal Access Tokens
  {
    name: 'GitHub Token',
    pattern: /\bghp_[A-Za-z0-9]{36}\b/g,
    severity: 'CRITICAL',
    category: 'CREDENTIALS',
  },
  // Generic API Keys
  {
    name: 'API Key (generic)',
    pattern: /\b[A-Za-z0-9]{32,64}\b/g,
    severity: 'MEDIUM',
    category: 'CREDENTIALS',
  },
  // Private Keys (PEM format)
  {
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'CRITICAL',
    category: 'CREDENTIALS',
  },
  // RSA Private Key Block
  {
    name: 'RSA Private Key Block',
    pattern: /-----BEGIN RSA PRIVATE KEY-----[\s\S]+?-----END RSA PRIVATE KEY-----/g,
    severity: 'CRITICAL',
    category: 'CREDENTIALS',
  },
  // Password in URLs
  {
    name: 'Password in URL',
    pattern: /(?:https?:\/\/)[^:]+:[^@]+@/g,
    severity: 'HIGH',
    category: 'CREDENTIALS',
  },
  // IP Addresses (10.x.x.x range)
  {
    name: 'Internal IP Address (10.x)',
    pattern: /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    severity: 'MEDIUM',
    category: 'CONFIDENTIAL',
  },
  // IP Addresses (172.16-31.x.x range)
  {
    name: 'Internal IP Address (172.x)',
    pattern: /\b172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g,
    severity: 'MEDIUM',
    category: 'CONFIDENTIAL',
  },
  // IP Addresses (192.168.x.x range)
  {
    name: 'Internal IP Address (192.168.x)',
    pattern: /\b192\.168\.\d{1,3}\.\d{1,3}\b/g,
    severity: 'MEDIUM',
    category: 'CONFIDENTIAL',
  },
  // HIPAA PHI - Medical Record Numbers (generic pattern)
  {
    name: 'Medical Record Number',
    pattern: /\bMRN[:\s]?[A-Z0-9]{6,12}\b/gi,
    severity: 'CRITICAL',
    category: 'HEALTH',
  },
  // Date of Birth patterns
  {
    name: 'Date of Birth',
    pattern: /\bDOB[:\s]?\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
    severity: 'HIGH',
    category: 'PII',
  },
  // Passport Numbers (generic)
  {
    name: 'Passport Number',
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    severity: 'HIGH',
    category: 'PII',
  },
  // Database Connection Strings
  {
    name: 'Database Connection String',
    pattern: /(?:mongodb|postgres(?:ql)?|mysql|mssql|redis):\/\/[^\s]+/gi,
    severity: 'CRITICAL',
    category: 'CREDENTIALS',
  },
  // JWT Tokens
  {
    name: 'JWT Token',
    pattern: /\beyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/=]+\b/g,
    severity: 'HIGH',
    category: 'CREDENTIALS',
  },
  // Slack Tokens
  {
    name: 'Slack Token',
    pattern: /\bxox[baprs]-[0-9A-Za-z-]+\b/g,
    severity: 'CRITICAL',
    category: 'CREDENTIALS',
  },
  // Stripe API Keys
  {
    name: 'Stripe API Key',
    pattern: /\bsk_(?:live|test)_[0-9a-zA-Z]{24,}\b/g,
    severity: 'CRITICAL',
    category: 'CREDENTIALS',
  },
];

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface DLPService {
  // Transfer evaluation
  evaluateTransfer(request: TransferRequest): Promise<TransferResult>;

  // Content scanning
  scanForSensitiveData(content: Buffer | string): Promise<{
    found: boolean;
    patterns: Array<{ name: string; category: string; severity: string; count: number }>;
  }>;
  scanForMalware(content: Buffer): Promise<MalwareScanResult>;

  // Content hashing
  hashContent(content: Buffer | string): string;

  // Transfer logging
  logTransferAttempt(request: TransferRequest, result: TransferResult): Promise<string>;
  getTransferAttempts(
    sessionId: string,
    options?: {
      page?: number;
      limit?: number;
      action?: TransferAction;
      transferType?: TransferType;
    }
  ): Promise<{
    attempts: Array<{
      id: string;
      transferType: TransferType;
      direction: TransferDirection;
      action: TransferAction;
      reason?: string;
      contentType?: string;
      contentSize?: number;
      fileName?: string;
      createdAt: Date;
    }>;
    total: number;
  }>;

  // Configuration
  getConfig(tenantId: string): Promise<DLPConfig>;
  updateConfig(tenantId: string, config: Partial<DLPConfig>): Promise<void>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function blockTransfer(code: string, reason: string): TransferResult {
  return {
    allowed: false,
    action: 'BLOCKED',
    reason: `${code}: ${reason}`,
  };
}

function getFileExtension(fileName?: string): string {
  if (!fileName) return '';
  const parts = fileName.split('.');
  return parts.length > 1 ? `.${parts.pop()?.toLowerCase()}` : '';
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

// =============================================================================
// CONTENT SCANNING HELPERS
// =============================================================================

async function scanForSensitiveData(content: Buffer | string): Promise<{
  found: boolean;
  patterns: Array<{ name: string; category: string; severity: string; count: number }>;
}> {
  const text = typeof content === 'string' ? content : content.toString('utf-8');
  const foundPatterns: Array<{
    name: string;
    category: string;
    severity: string;
    count: number;
  }> = [];

  for (const pattern of DEFAULT_SENSITIVE_PATTERNS) {
    // Reset regex lastIndex
    pattern.pattern.lastIndex = 0;

    const matches = text.match(pattern.pattern);
    if (matches && matches.length > 0) {
      // Filter out false positives for generic patterns
      if (pattern.name === 'API Key (generic)') {
        // Only flag if there are other indicators
        const hasContext = /(?:api[_-]?key|secret|token|password)/i.test(text);
        if (!hasContext) continue;
      }

      foundPatterns.push({
        name: pattern.name,
        category: pattern.category,
        severity: pattern.severity,
        count: matches.length,
      });
    }
  }

  return {
    found: foundPatterns.length > 0,
    patterns: foundPatterns,
  };
}

async function scanForMalware(content: Buffer): Promise<MalwareScanResult> {
  // In production, integrate with ClamAV, VirusTotal, or similar
  // For now, implement basic signature detection

  const signatures = [
    {
      name: 'EICAR Test',
      pattern: Buffer.from(
        'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNU',
        'base64'
      ),
    },
    // Add more known malware signatures here
  ];

  for (const sig of signatures) {
    if (content.includes(sig.pattern)) {
      return {
        clean: false,
        threatName: sig.name,
        threatType: 'signature_match',
        scanEngine: 'internal',
        scanTime: new Date(),
      };
    }
  }

  // Check for executable headers in non-executable file types
  const exeHeaders = [
    Buffer.from([0x4d, 0x5a]), // MZ (DOS/Windows executable)
    Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF (Linux executable)
  ];

  for (const header of exeHeaders) {
    if (content.subarray(0, header.length).equals(header)) {
      return {
        clean: false,
        threatName: 'Executable Content',
        threatType: 'suspicious_header',
        scanEngine: 'internal',
        scanTime: new Date(),
      };
    }
  }

  return {
    clean: true,
    scanEngine: 'internal',
    scanTime: new Date(),
  };
}

function hashContent(content: Buffer | string): string {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// =============================================================================
// CLIPBOARD EVALUATION HELPERS
// =============================================================================

interface MappedPolicyForClipboard {
  clipboardPolicy?: string;
  clipboardMaxSize?: number | null;
  clipboardAllowedTypes?: string[] | null;
}

function checkClipboardPolicyBlock(
  policy: MappedPolicyForClipboard,
  direction: TransferDirection
): TransferResult | null {
  switch (policy.clipboardPolicy) {
    case 'BLOCKED':
      return blockTransfer('CLIPBOARD_BLOCKED', 'Clipboard access is disabled');
    case 'READ_ONLY':
      if (direction === 'DOWNLOAD') {
        return blockTransfer('CLIPBOARD_OUTBOUND_BLOCKED', 'Cannot copy from pod');
      }
      break;
    case 'WRITE_ONLY':
      if (direction === 'UPLOAD') {
        return blockTransfer('CLIPBOARD_INBOUND_BLOCKED', 'Cannot paste into pod');
      }
      break;
    case 'APPROVAL_REQUIRED':
      return {
        allowed: false,
        action: 'QUARANTINED',
        reason: 'Clipboard access requires approval',
        requiresApproval: true,
      };
  }
  return null;
}

function checkClipboardSizeAndType(
  policy: MappedPolicyForClipboard,
  contentSize?: number,
  contentType?: string
): TransferResult | null {
  if (policy.clipboardMaxSize && contentSize) {
    if (contentSize > policy.clipboardMaxSize) {
      return blockTransfer(
        'CLIPBOARD_SIZE_EXCEEDED',
        `Content size ${contentSize} exceeds maximum ${policy.clipboardMaxSize}`
      );
    }
  }
  if (policy.clipboardAllowedTypes && policy.clipboardAllowedTypes.length > 0) {
    if (contentType && !policy.clipboardAllowedTypes.includes(contentType)) {
      return blockTransfer('CLIPBOARD_TYPE_BLOCKED', `Content type ${contentType} is not allowed`);
    }
  }
  return null;
}

async function checkClipboardSensitiveData(
  direction: TransferDirection,
  content?: Buffer
): Promise<TransferResult | null> {
  if (direction === 'DOWNLOAD' && content) {
    const scanResult = await scanForSensitiveData(content);
    if (scanResult.found) {
      const criticalPatterns = scanResult.patterns.filter((p) => p.severity === 'CRITICAL');
      if (criticalPatterns.length > 0) {
        return {
          ...blockTransfer(
            'SENSITIVE_DATA_BLOCKED',
            `Sensitive data detected: ${criticalPatterns.map((p) => p.name).join(', ')}`
          ),
          sensitiveDataTypes: criticalPatterns.map((p) => p.category),
        };
      }
    }
  }
  return null;
}

// =============================================================================
// FILE TRANSFER EVALUATION HELPERS
// =============================================================================

interface MappedPolicyForFile {
  fileDownloadPolicy?: string;
  fileUploadPolicy?: string;
  blockedFileTypes?: string[] | null;
  allowedFileTypes?: string[] | null;
  maxFileSize?: number | null;
}

function checkFileDownloadPolicyBlock(policy: MappedPolicyForFile): TransferResult | null {
  switch (policy.fileDownloadPolicy) {
    case 'BLOCKED':
      return blockTransfer('FILE_DOWNLOAD_BLOCKED', 'File downloads are disabled');
    case 'APPROVAL_REQUIRED':
      return {
        allowed: false,
        action: 'QUARANTINED',
        reason: 'File download requires approval',
        requiresApproval: true,
      };
  }
  return null;
}

function checkFileUploadPolicyBlock(policy: MappedPolicyForFile): TransferResult | null {
  switch (policy.fileUploadPolicy) {
    case 'BLOCKED':
      return blockTransfer('FILE_UPLOAD_BLOCKED', 'File uploads are disabled');
    case 'APPROVAL_REQUIRED':
      return {
        allowed: false,
        action: 'QUARANTINED',
        reason: 'File upload requires approval',
        requiresApproval: true,
      };
  }
  return null;
}

function checkFileTypeAllowed(
  policy: MappedPolicyForFile,
  extension: string,
  isDownload: boolean
): TransferResult | null {
  const direction = isDownload ? 'download' : 'upload';
  if (policy.blockedFileTypes && policy.blockedFileTypes.length > 0) {
    if (
      policy.blockedFileTypes.includes(extension) ||
      (isDownload && policy.blockedFileTypes.includes('*'))
    ) {
      return blockTransfer(
        'FILE_TYPE_BLOCKED',
        `File type ${extension} is not allowed for ${direction}`
      );
    }
  }
  if (policy.allowedFileTypes && policy.allowedFileTypes.length > 0) {
    if (!policy.allowedFileTypes.includes(extension)) {
      return blockTransfer(
        'FILE_TYPE_NOT_ALLOWED',
        `File type ${extension} is not in the allowed list`
      );
    }
  }
  return null;
}

function checkFileSizeLimit(
  policy: MappedPolicyForFile,
  contentSize?: number
): TransferResult | null {
  if (policy.maxFileSize && contentSize) {
    if (contentSize > policy.maxFileSize) {
      return blockTransfer(
        'FILE_SIZE_EXCEEDED',
        `File size ${formatBytes(contentSize)} exceeds maximum ${formatBytes(policy.maxFileSize)}`
      );
    }
  }
  return null;
}

async function checkFileSensitiveData(
  content: Buffer,
  contentSize: number,
  config: DLPConfig
): Promise<TransferResult | null> {
  if (config.enableSensitiveDataScanning && contentSize <= config.maxFileSizeForScanning) {
    const scanResult = await scanForSensitiveData(content);
    if (scanResult.found) {
      const highSeverityPatterns = scanResult.patterns.filter(
        (p) => p.severity === 'CRITICAL' || p.severity === 'HIGH'
      );
      if (highSeverityPatterns.length > 0) {
        return {
          ...blockTransfer(
            'SENSITIVE_DATA_BLOCKED',
            `File contains sensitive data: ${highSeverityPatterns.map((p) => p.name).join(', ')}`
          ),
          sensitiveDataTypes: highSeverityPatterns.map((p) => p.category),
        };
      }
    }
  }
  return null;
}

async function checkFileMalware(
  content: Buffer,
  contentSize: number,
  config: DLPConfig
): Promise<TransferResult | null> {
  if (config.enableMalwareScanning && contentSize <= config.maxFileSizeForScanning) {
    const malwareResult = await scanForMalware(content);
    if (!malwareResult.clean) {
      return blockTransfer(
        'MALWARE_DETECTED',
        `Malware detected: ${malwareResult.threatName} (${malwareResult.threatType})`
      );
    }
  }
  return null;
}

function buildSuccessResult(
  contentHash?: string,
  action: TransferAction = 'LOGGED',
  reason = 'Transfer permitted'
): TransferResult {
  const result: TransferResult = {
    allowed: true,
    action,
    reason,
  };
  if (contentHash) result.contentHash = contentHash;
  return result;
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createDLPService(
  prisma: PrismaClient,
  redis: Redis,
  _policyService: SecurityPolicyService
): DLPService {
  const CONFIG_CACHE_TTL = 300; // 5 minutes
  const DEFAULT_MAX_SCAN_SIZE = 10 * 1024 * 1024; // 10MB
  const DEFAULT_SCAN_TIMEOUT = 30000; // 30 seconds

  // ===========================================================================
  // TRANSFER EVALUATION
  // ===========================================================================

  async function evaluateTransfer(request: TransferRequest): Promise<TransferResult> {
    // Get session and policy
    const session = await prisma.session.findUnique({
      where: { id: request.sessionId },
      include: { securityPolicy: true },
    });

    if (!session) {
      return blockTransfer('SESSION_NOT_FOUND', 'Session not found');
    }

    const policy = session.securityPolicy;
    if (!policy) {
      return blockTransfer('NO_POLICY', 'No security policy configured');
    }

    // Map policy to evaluation
    const policyMapped = mapPolicyFromDb(policy);

    // Evaluate based on transfer type
    let result: TransferResult;

    switch (request.transferType) {
      case 'CLIPBOARD_TEXT':
      case 'CLIPBOARD_IMAGE':
      case 'CLIPBOARD_FILE':
        result = await evaluateClipboard(request, policyMapped);
        break;
      case 'FILE_DOWNLOAD':
        result = await evaluateFileDownload(request, policyMapped);
        break;
      case 'FILE_UPLOAD':
        result = await evaluateFileUpload(request, policyMapped);
        break;
      case 'PRINT':
        result = await evaluatePrint(request, policyMapped);
        break;
      case 'USB_TRANSFER':
        result = await evaluateUsb(request, policyMapped);
        break;
      default:
        result = blockTransfer('UNKNOWN_TYPE', 'Unknown transfer type');
    }

    // Log the attempt
    const attemptId = await logTransferAttempt(request, result);
    result.attemptId = attemptId;

    // Send security alert for blocked attempts
    if (!result.allowed) {
      await sendSecurityAlert(request, result, session.tenantId ?? '');
    }

    return result;
  }

  // ===========================================================================
  // CLIPBOARD EVALUATION
  // ===========================================================================

  async function evaluateClipboard(
    request: TransferRequest,
    policy: MappedPolicy
  ): Promise<TransferResult> {
    // Check policy block
    const policyBlock = checkClipboardPolicyBlock(policy, request.direction);
    if (policyBlock) return policyBlock;

    // Check size and type
    const sizeTypeBlock = checkClipboardSizeAndType(
      policy,
      request.contentSize,
      request.contentType
    );
    if (sizeTypeBlock) return sizeTypeBlock;

    // Scan for sensitive data on outbound transfers
    const sensitiveBlock = await checkClipboardSensitiveData(request.direction, request.content);
    if (sensitiveBlock) return sensitiveBlock;

    // Hash content for audit trail
    const contentHash = request.content ? hashContent(request.content) : undefined;
    return buildSuccessResult(contentHash, 'LOGGED', 'Clipboard access permitted');
  }

  // ===========================================================================
  // FILE DOWNLOAD EVALUATION
  // ===========================================================================

  async function evaluateFileDownload(
    request: TransferRequest,
    policy: MappedPolicy
  ): Promise<TransferResult> {
    // Check policy block
    const policyBlock = checkFileDownloadPolicyBlock(policy);
    if (policyBlock) return policyBlock;

    // Check file type
    const extension = getFileExtension(request.fileName);
    const typeBlock = checkFileTypeAllowed(policy, extension, true);
    if (typeBlock) return typeBlock;

    // Check file size
    const sizeBlock = checkFileSizeLimit(policy, request.contentSize);
    if (sizeBlock) return sizeBlock;

    // Scan for sensitive data
    if (request.content && request.contentSize) {
      const config = await getConfig(request.tenantId);
      const sensitiveBlock = await checkFileSensitiveData(
        request.content,
        request.contentSize,
        config
      );
      if (sensitiveBlock) return sensitiveBlock;
    }

    // Hash content for audit trail
    const contentHash = request.content ? hashContent(request.content) : undefined;
    const action: TransferAction =
      policy.fileDownloadPolicy === 'LOGGED_ONLY' ? 'LOGGED' : 'ALLOWED';
    return buildSuccessResult(contentHash, action, 'File download permitted');
  }

  // ===========================================================================
  // FILE UPLOAD EVALUATION
  // ===========================================================================

  async function evaluateFileUpload(
    request: TransferRequest,
    policy: MappedPolicy
  ): Promise<TransferResult> {
    // Check policy block
    const policyBlock = checkFileUploadPolicyBlock(policy);
    if (policyBlock) return policyBlock;

    // Check file type
    const extension = getFileExtension(request.fileName);
    const typeBlock = checkFileTypeAllowed(policy, extension, false);
    if (typeBlock) return typeBlock;

    // Check file size
    const sizeBlock = checkFileSizeLimit(policy, request.contentSize);
    if (sizeBlock) return sizeBlock;

    // Scan for malware
    if (request.content && request.contentSize) {
      const config = await getConfig(request.tenantId);
      const malwareBlock = await checkFileMalware(request.content, request.contentSize, config);
      if (malwareBlock) return malwareBlock;
    }

    // Hash content for audit trail
    const contentHash = request.content ? hashContent(request.content) : undefined;
    const action: TransferAction = policy.fileUploadPolicy === 'LOGGED_ONLY' ? 'LOGGED' : 'ALLOWED';
    return buildSuccessResult(contentHash, action, 'File upload permitted');
  }

  // ===========================================================================
  // PRINT EVALUATION
  // ===========================================================================

  async function evaluatePrint(
    request: TransferRequest,
    policy: MappedPolicy
  ): Promise<TransferResult> {
    switch (policy.printingPolicy) {
      case 'BLOCKED':
        return blockTransfer('PRINT_BLOCKED', 'Printing is disabled');

      case 'PDF_ONLY':
        return {
          allowed: true,
          action: 'LOGGED',
          reason: 'Printing redirected to PDF',
        };

      case 'LOCAL_ONLY':
        if (!policy.allowLocalPrinting) {
          return blockTransfer('LOCAL_PRINT_BLOCKED', 'Local printing is disabled');
        }
        break;

      case 'APPROVAL_REQUIRED':
        return {
          allowed: false,
          action: 'QUARANTINED',
          reason: 'Printing requires approval',
          requiresApproval: true,
        };

      case 'ALLOWED':
        break;
    }

    return {
      allowed: true,
      action: 'LOGGED',
      reason: 'Printing permitted',
    };
  }

  // ===========================================================================
  // USB EVALUATION
  // ===========================================================================

  async function evaluateUsb(
    request: TransferRequest,
    policy: MappedPolicy
  ): Promise<TransferResult> {
    switch (policy.usbPolicy) {
      case 'BLOCKED':
        return blockTransfer('USB_BLOCKED', 'USB devices are disabled');

      case 'STORAGE_BLOCKED': {
        const deviceClass = request.metadata?.deviceClass as string | undefined;
        // USB Mass Storage Class: 0x08
        if (deviceClass === '08' || deviceClass === 'mass_storage') {
          return blockTransfer('USB_STORAGE_BLOCKED', 'USB storage devices are disabled');
        }
        break;
      }

      case 'WHITELIST_ONLY': {
        const deviceId = request.metadata?.deviceId as string | undefined;
        if (deviceId && policy.allowedUsbDevices && !policy.allowedUsbDevices.includes(deviceId)) {
          return blockTransfer(
            'USB_DEVICE_NOT_WHITELISTED',
            'USB device is not in the allowed list'
          );
        }
        break;
      }

      case 'ALLOWED':
        break;
    }

    // Hash content for audit trail
    const contentHash = request.content ? hashContent(request.content) : undefined;

    const result: TransferResult = {
      allowed: true,
      action: 'LOGGED',
      reason: 'USB transfer permitted',
    };
    if (contentHash) result.contentHash = contentHash;
    return result;
  }

  // ===========================================================================
  // TRANSFER LOGGING
  // ===========================================================================

  async function logTransferAttempt(
    request: TransferRequest,
    result: TransferResult
  ): Promise<string> {
    const attempt = await prisma.dataTransferAttempt.create({
      data: {
        sessionId: request.sessionId,
        userId: request.userId,
        tenantId: request.tenantId,
        transferType: request.transferType,
        direction: request.direction === 'UPLOAD' ? 'INBOUND' : 'OUTBOUND',
        contentType: request.contentType ?? null,
        contentSize: request.contentSize ?? null,
        contentHash: result.contentHash ?? null,
        fileName: request.fileName ?? null,
        action: result.action,
        reason: result.reason ?? null,
        sourceApplication: request.sourceApplication ?? null,
        targetApplication: request.targetApplication ?? null,
        ipAddress: request.ipAddress ?? null,
      },
    });

    return attempt.id;
  }

  async function getTransferAttempts(
    sessionId: string,
    options: {
      page?: number;
      limit?: number;
      action?: TransferAction;
      transferType?: TransferType;
    } = {}
  ): Promise<{
    attempts: Array<{
      id: string;
      transferType: TransferType;
      direction: TransferDirection;
      action: TransferAction;
      reason?: string;
      contentType?: string;
      contentSize?: number;
      fileName?: string;
      createdAt: Date;
    }>;
    total: number;
  }> {
    const { page = 1, limit = 20, action, transferType } = options;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { sessionId };
    if (action) where.action = action;
    if (transferType) where.transferType = transferType;

    const [attempts, total] = await Promise.all([
      prisma.dataTransferAttempt.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.dataTransferAttempt.count({ where }),
    ]);

    return {
      attempts: attempts.map((a) => {
        const attempt: {
          id: string;
          transferType: TransferType;
          direction: TransferDirection;
          action: TransferAction;
          reason?: string;
          contentType?: string;
          contentSize?: number;
          fileName?: string;
          createdAt: Date;
        } = {
          id: a.id,
          transferType: a.transferType as TransferType,
          direction: a.direction === 'INBOUND' ? 'UPLOAD' : 'DOWNLOAD',
          action: a.action as TransferAction,
          createdAt: a.createdAt,
        };
        if (a.reason !== null) attempt.reason = a.reason;
        if (a.contentType !== null) attempt.contentType = a.contentType;
        if (a.contentSize !== null) attempt.contentSize = a.contentSize;
        if (a.fileName !== null) attempt.fileName = a.fileName;
        return attempt;
      }),
      total,
    };
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  async function getConfig(tenantId: string): Promise<DLPConfig> {
    // Check cache
    const cached = await redis.get(`dlp:config:${tenantId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Default config
    const config: DLPConfig = {
      enableSensitiveDataScanning: true,
      enableMalwareScanning: true,
      sensitiveDataPatterns: DEFAULT_SENSITIVE_PATTERNS,
      maxFileSizeForScanning: DEFAULT_MAX_SCAN_SIZE,
      scanTimeout: DEFAULT_SCAN_TIMEOUT,
    };

    // Cache config
    await redis.setex(`dlp:config:${tenantId}`, CONFIG_CACHE_TTL, JSON.stringify(config));

    return config;
  }

  async function updateConfig(tenantId: string, updates: Partial<DLPConfig>): Promise<void> {
    const existing = await getConfig(tenantId);
    const updated = { ...existing, ...updates };
    await redis.setex(`dlp:config:${tenantId}`, CONFIG_CACHE_TTL, JSON.stringify(updated));
  }

  async function sendSecurityAlert(
    request: TransferRequest,
    result: TransferResult,
    tenantId: string
  ): Promise<void> {
    // Publish security alert to Redis for notification service
    await redis.publish(
      'security:alerts',
      JSON.stringify({
        type: 'DATA_TRANSFER_BLOCKED',
        tenantId,
        severity: 'MEDIUM',
        data: {
          podId: request.podId,
          sessionId: request.sessionId,
          userId: request.userId,
          transferType: request.transferType,
          direction: request.direction,
          reason: result.reason,
          sensitiveDataTypes: result.sensitiveDataTypes,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  // ===========================================================================
  // TYPE MAPPING
  // ===========================================================================

  interface MappedPolicy {
    clipboardPolicy: 'BLOCKED' | 'READ_ONLY' | 'WRITE_ONLY' | 'BIDIRECTIONAL' | 'APPROVAL_REQUIRED';
    clipboardMaxSize?: number | null;
    clipboardAllowedTypes?: string[];
    fileDownloadPolicy: 'BLOCKED' | 'ALLOWED' | 'APPROVAL_REQUIRED' | 'LOGGED_ONLY';
    fileUploadPolicy: 'BLOCKED' | 'ALLOWED' | 'APPROVAL_REQUIRED' | 'LOGGED_ONLY';
    allowedFileTypes?: string[];
    blockedFileTypes?: string[];
    maxFileSize?: number | null;
    printingPolicy: 'BLOCKED' | 'LOCAL_ONLY' | 'PDF_ONLY' | 'ALLOWED' | 'APPROVAL_REQUIRED';
    allowLocalPrinting?: boolean;
    allowPdfExport?: boolean;
    usbPolicy: 'BLOCKED' | 'STORAGE_BLOCKED' | 'WHITELIST_ONLY' | 'ALLOWED';
    allowedUsbDevices?: string[];
  }

  function mapPolicyFromDb(policy: {
    clipboardPolicy: string;
    clipboardMaxSize: number | null;
    clipboardAllowedTypes: string[];
    fileDownloadPolicy: string;
    fileUploadPolicy: string;
    allowedFileTypes: string[];
    blockedFileTypes: string[];
    maxFileSize: number | null;
    printingPolicy: string;
    allowLocalPrinting: boolean;
    allowPdfExport: boolean;
    usbPolicy: string;
    allowedUsbDevices: string[];
  }): MappedPolicy {
    return {
      clipboardPolicy: policy.clipboardPolicy as MappedPolicy['clipboardPolicy'],
      clipboardMaxSize: policy.clipboardMaxSize,
      clipboardAllowedTypes: policy.clipboardAllowedTypes,
      fileDownloadPolicy: policy.fileDownloadPolicy as MappedPolicy['fileDownloadPolicy'],
      fileUploadPolicy: policy.fileUploadPolicy as MappedPolicy['fileUploadPolicy'],
      allowedFileTypes: policy.allowedFileTypes,
      blockedFileTypes: policy.blockedFileTypes,
      maxFileSize: policy.maxFileSize,
      printingPolicy: policy.printingPolicy as MappedPolicy['printingPolicy'],
      allowLocalPrinting: policy.allowLocalPrinting,
      allowPdfExport: policy.allowPdfExport,
      usbPolicy: policy.usbPolicy as MappedPolicy['usbPolicy'],
      allowedUsbDevices: policy.allowedUsbDevices,
    };
  }

  // ===========================================================================
  // RETURN SERVICE
  // ===========================================================================

  return {
    evaluateTransfer,
    scanForSensitiveData,
    scanForMalware,
    hashContent,
    logTransferAttempt,
    getTransferAttempts,
    getConfig,
    updateConfig,
  };
}
