/**
 * @module @skillancer/skillpod-svc/services/security-policy.service
 * Security policy management for VDI data containment
 */

// @ts-nocheck - FUTURE: Fix TypeScript errors related to security policy types
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import type {
  PodSecurityPolicy,
  PodSecurityPolicyInput,
  WatermarkConfig,
} from '../types/containment.types.js';
import type { PrismaClient } from '@prisma/client';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface SecurityPolicyService {
  createPolicy(tenantId: string, input: PodSecurityPolicyInput): Promise<PodSecurityPolicy>;
  updatePolicy(
    policyId: string,
    input: Partial<PodSecurityPolicyInput>
  ): Promise<PodSecurityPolicy>;
  deletePolicy(policyId: string): Promise<void>;
  getPolicy(policyId: string): Promise<PodSecurityPolicy | null>;
  getPolicyByName(tenantId: string, name: string): Promise<PodSecurityPolicy | null>;
  getDefaultPolicy(tenantId: string): Promise<PodSecurityPolicy | null>;
  listPolicies(tenantId: string): Promise<PodSecurityPolicy[]>;
  setDefaultPolicy(tenantId: string, policyId: string): Promise<PodSecurityPolicy>;
  clonePolicy(policyId: string, newName: string): Promise<PodSecurityPolicy>;
  validatePolicy(input: PodSecurityPolicyInput): { valid: boolean; errors: string[] };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate policy configuration
 */
function doValidatePolicy(input: PodSecurityPolicyInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Name validation
  if (!input.name || input.name.trim().length === 0) {
    errors.push('Policy name is required');
  } else if (input.name.length > 100) {
    errors.push('Policy name must be 100 characters or less');
  }

  // Timeout validation
  if (input.idleTimeout !== undefined) {
    validateIdleTimeout(input.idleTimeout, errors);
  }

  if (input.maxSessionDuration !== undefined) {
    validateMaxSessionDuration(input.maxSessionDuration, errors);
  }

  // File size validation
  if (input.maxFileSize !== undefined) {
    validateMaxFileSize(input.maxFileSize, errors);
  }

  // Clipboard size validation
  if (input.clipboardMaxSize !== undefined) {
    validateClipboardMaxSize(input.clipboardMaxSize, errors);
  }

  // Watermark config validation
  if (input.watermarkConfig) {
    validateWatermarkConfig(input.watermarkConfig, errors);
  }

  // Conflicting settings check
  if (input.clipboardPolicy === 'BIDIRECTIONAL') {
    if (input.clipboardInbound === false && input.clipboardOutbound === false) {
      errors.push('Bidirectional clipboard requires at least one direction enabled');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateIdleTimeout(value: number, errors: string[]): void {
  if (value < 1 || value > 480) {
    errors.push('Idle timeout must be between 1 and 480 minutes');
  }
}

function validateMaxSessionDuration(value: number, errors: string[]): void {
  if (value < 15 || value > 1440) {
    errors.push('Max session duration must be between 15 and 1440 minutes');
  }
}

function validateMaxFileSize(value: number, errors: string[]): void {
  // 10GB max
  if (value < 0 || value > 10 * 1024 * 1024 * 1024) {
    errors.push('Max file size must be between 0 and 10GB');
  }
}

function validateClipboardMaxSize(value: number, errors: string[]): void {
  // 100MB max
  if (value < 0 || value > 100 * 1024 * 1024) {
    errors.push('Clipboard max size must be between 0 and 100MB');
  }
}

function validateWatermarkConfig(wm: WatermarkConfig, errors: string[]): void {
  if (wm.opacity !== undefined && (wm.opacity < 0 || wm.opacity > 1)) {
    errors.push('Watermark opacity must be between 0 and 1');
  }
  if (wm.fontSize !== undefined && (wm.fontSize < 8 || wm.fontSize > 72)) {
    errors.push('Watermark font size must be between 8 and 72');
  }
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

export function createSecurityPolicyService(prisma: PrismaClient): SecurityPolicyService {
  /**
   * Create a new security policy
   */
  async function createPolicy(
    tenantId: string,
    input: PodSecurityPolicyInput
  ): Promise<PodSecurityPolicy> {
    // Validate input
    const validation = doValidatePolicy(input);
    if (!validation.valid) {
      throw new Error(`Invalid policy configuration: ${validation.errors.join(', ')}`);
    }

    // If this is being set as default, unset other defaults first
    if (input.isDefault) {
      await prisma.podSecurityPolicy.updateMany({
        where: { tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const policy = await prisma.podSecurityPolicy.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,

        // Clipboard controls
        clipboardPolicy: input.clipboardPolicy ?? 'BLOCKED',
        clipboardInbound: input.clipboardInbound ?? false,
        clipboardOutbound: input.clipboardOutbound ?? false,
        clipboardMaxSize: input.clipboardMaxSize,
        clipboardAllowedTypes: input.clipboardAllowedTypes ?? [],

        // File transfer controls
        fileDownloadPolicy: input.fileDownloadPolicy ?? 'BLOCKED',
        fileUploadPolicy: input.fileUploadPolicy ?? 'ALLOWED',
        allowedFileTypes: input.allowedFileTypes ?? [],
        blockedFileTypes: input.blockedFileTypes ?? ['.exe', '.bat', '.cmd', '.ps1', '.sh'],
        maxFileSize: input.maxFileSize,

        // Printing controls
        printingPolicy: input.printingPolicy ?? 'BLOCKED',
        allowLocalPrinting: input.allowLocalPrinting ?? false,
        allowPdfExport: input.allowPdfExport ?? false,

        // Peripheral controls
        usbPolicy: input.usbPolicy ?? 'BLOCKED',
        allowedUsbDevices: input.allowedUsbDevices ?? [],
        webcamPolicy: input.webcamPolicy ?? 'ALLOWED',
        microphonePolicy: input.microphonePolicy ?? 'ALLOWED',

        // Screen capture controls
        screenCaptureBlocking: input.screenCaptureBlocking ?? true,
        watermarkEnabled: input.watermarkEnabled ?? true,
        watermarkConfig: input.watermarkConfig as object | undefined,

        // Network controls
        networkPolicy: input.networkPolicy ?? 'RESTRICTED',
        allowedDomains: input.allowedDomains ?? [],
        blockedDomains: input.blockedDomains ?? [],
        allowInternet: input.allowInternet ?? false,

        // Session controls
        idleTimeout: input.idleTimeout ?? 15,
        maxSessionDuration: input.maxSessionDuration,
        requireMfa: input.requireMfa ?? true,

        // Audit settings
        recordSession: input.recordSession ?? true,
        logKeystrokes: input.logKeystrokes ?? false,
        logClipboard: input.logClipboard ?? true,
        logFileAccess: input.logFileAccess ?? true,

        isActive: true,
      },
    });

    return mapPolicyFromDb(policy);
  }

  /**
   * Update an existing security policy
   */
  async function updatePolicy(
    policyId: string,
    input: Partial<PodSecurityPolicyInput>
  ): Promise<PodSecurityPolicy> {
    // If updating to default, unset other defaults
    if (input.isDefault === true) {
      const existingPolicy = await prisma.podSecurityPolicy.findUnique({
        where: { id: policyId },
      });

      if (existingPolicy) {
        await prisma.podSecurityPolicy.updateMany({
          where: { tenantId: existingPolicy.tenantId, isDefault: true, id: { not: policyId } },
          data: { isDefault: false },
        });
      }
    }

    const policy = await prisma.podSecurityPolicy.update({
      where: { id: policyId },
      data: {
        name: input.name,
        description: input.description,
        isDefault: input.isDefault,

        // Clipboard controls
        clipboardPolicy: input.clipboardPolicy,
        clipboardInbound: input.clipboardInbound,
        clipboardOutbound: input.clipboardOutbound,
        clipboardMaxSize: input.clipboardMaxSize,
        clipboardAllowedTypes: input.clipboardAllowedTypes,

        // File transfer controls
        fileDownloadPolicy: input.fileDownloadPolicy,
        fileUploadPolicy: input.fileUploadPolicy,
        allowedFileTypes: input.allowedFileTypes,
        blockedFileTypes: input.blockedFileTypes,
        maxFileSize: input.maxFileSize,

        // Printing controls
        printingPolicy: input.printingPolicy,
        allowLocalPrinting: input.allowLocalPrinting,
        allowPdfExport: input.allowPdfExport,

        // Peripheral controls
        usbPolicy: input.usbPolicy,
        allowedUsbDevices: input.allowedUsbDevices,
        webcamPolicy: input.webcamPolicy,
        microphonePolicy: input.microphonePolicy,

        // Screen capture controls
        screenCaptureBlocking: input.screenCaptureBlocking,
        watermarkEnabled: input.watermarkEnabled,
        watermarkConfig: input.watermarkConfig as object | undefined,

        // Network controls
        networkPolicy: input.networkPolicy,
        allowedDomains: input.allowedDomains,
        blockedDomains: input.blockedDomains,
        allowInternet: input.allowInternet,

        // Session controls
        idleTimeout: input.idleTimeout,
        maxSessionDuration: input.maxSessionDuration,
        requireMfa: input.requireMfa,

        // Audit settings
        recordSession: input.recordSession,
        logKeystrokes: input.logKeystrokes,
        logClipboard: input.logClipboard,
        logFileAccess: input.logFileAccess,
      },
    });

    return mapPolicyFromDb(policy);
  }

  /**
   * Delete a security policy (soft delete via isActive flag)
   */
  async function deletePolicy(policyId: string): Promise<void> {
    // Check if policy is in use
    const sessionsUsingPolicy = await prisma.session.count({
      where: { securityPolicyId: policyId, status: 'RUNNING' },
    });

    if (sessionsUsingPolicy > 0) {
      throw new Error(
        `Cannot delete policy: ${sessionsUsingPolicy} active sessions are using this policy`
      );
    }

    await prisma.podSecurityPolicy.update({
      where: { id: policyId },
      data: { isActive: false },
    });
  }

  /**
   * Get a policy by ID
   */
  async function getPolicy(policyId: string): Promise<PodSecurityPolicy | null> {
    const policy = await prisma.podSecurityPolicy.findUnique({
      where: { id: policyId },
    });

    return policy ? mapPolicyFromDb(policy) : null;
  }

  /**
   * Get a policy by name within a tenant
   */
  async function getPolicyByName(
    tenantId: string,
    name: string
  ): Promise<PodSecurityPolicy | null> {
    const policy = await prisma.podSecurityPolicy.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });

    return policy ? mapPolicyFromDb(policy) : null;
  }

  /**
   * Get the default policy for a tenant
   */
  async function getDefaultPolicy(tenantId: string): Promise<PodSecurityPolicy | null> {
    const policy = await prisma.podSecurityPolicy.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });

    return policy ? mapPolicyFromDb(policy) : null;
  }

  /**
   * List all policies for a tenant
   */
  async function listPolicies(tenantId: string): Promise<PodSecurityPolicy[]> {
    const policies = await prisma.podSecurityPolicy.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return policies.map(mapPolicyFromDb);
  }

  /**
   * Set a policy as the default for a tenant
   */
  async function setDefaultPolicy(tenantId: string, policyId: string): Promise<PodSecurityPolicy> {
    // Verify policy belongs to tenant
    const policy = await prisma.podSecurityPolicy.findFirst({
      where: { id: policyId, tenantId },
    });

    if (!policy) {
      throw new Error('Policy not found or does not belong to tenant');
    }

    // Unset current default
    await prisma.podSecurityPolicy.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    const updated = await prisma.podSecurityPolicy.update({
      where: { id: policyId },
      data: { isDefault: true },
    });

    return mapPolicyFromDb(updated);
  }

  /**
   * Clone an existing policy with a new name
   */
  async function clonePolicy(policyId: string, newName: string): Promise<PodSecurityPolicy> {
    const existing = await prisma.podSecurityPolicy.findUnique({
      where: { id: policyId },
    });

    if (!existing) {
      throw new Error('Policy not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, createdAt, updatedAt, isDefault, ...policyData } = existing;

    const cloned = await prisma.podSecurityPolicy.create({
      data: {
        ...policyData,
        name: newName,
        isDefault: false,
        description: `Cloned from: ${existing.name}`,
      },
    });

    return mapPolicyFromDb(cloned);
  }

  return {
    createPolicy,
    updatePolicy,
    deletePolicy,
    getPolicy,
    getPolicyByName,
    getDefaultPolicy,
    listPolicies,
    setDefaultPolicy,
    clonePolicy,
    validatePolicy: doValidatePolicy,
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map database policy to service type
 */
function mapPolicyFromDb(policy: {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  clipboardPolicy: string;
  clipboardInbound: boolean;
  clipboardOutbound: boolean;
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
  webcamPolicy: string;
  microphonePolicy: string;
  screenCaptureBlocking: boolean;
  watermarkEnabled: boolean;
  watermarkConfig: unknown;
  networkPolicy: string;
  allowedDomains: string[];
  blockedDomains: string[];
  allowInternet: boolean;
  idleTimeout: number;
  maxSessionDuration: number | null;
  requireMfa: boolean;
  recordSession: boolean;
  logKeystrokes: boolean;
  logClipboard: boolean;
  logFileAccess: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PodSecurityPolicy {
  return {
    id: policy.id,
    tenantId: policy.tenantId,
    name: policy.name,
    description: policy.description ?? undefined,
    isDefault: policy.isDefault,

    clipboardPolicy: policy.clipboardPolicy as PodSecurityPolicy['clipboardPolicy'],
    clipboardInbound: policy.clipboardInbound,
    clipboardOutbound: policy.clipboardOutbound,
    clipboardMaxSize: policy.clipboardMaxSize ?? undefined,
    clipboardAllowedTypes: policy.clipboardAllowedTypes,

    fileDownloadPolicy: policy.fileDownloadPolicy as PodSecurityPolicy['fileDownloadPolicy'],
    fileUploadPolicy: policy.fileUploadPolicy as PodSecurityPolicy['fileUploadPolicy'],
    allowedFileTypes: policy.allowedFileTypes,
    blockedFileTypes: policy.blockedFileTypes,
    maxFileSize: policy.maxFileSize ?? undefined,

    printingPolicy: policy.printingPolicy as PodSecurityPolicy['printingPolicy'],
    allowLocalPrinting: policy.allowLocalPrinting,
    allowPdfExport: policy.allowPdfExport,

    usbPolicy: policy.usbPolicy as PodSecurityPolicy['usbPolicy'],
    allowedUsbDevices: policy.allowedUsbDevices,
    webcamPolicy: policy.webcamPolicy as PodSecurityPolicy['webcamPolicy'],
    microphonePolicy: policy.microphonePolicy as PodSecurityPolicy['microphonePolicy'],

    screenCaptureBlocking: policy.screenCaptureBlocking,
    watermarkEnabled: policy.watermarkEnabled,
    watermarkConfig: policy.watermarkConfig as WatermarkConfig | undefined,

    networkPolicy: policy.networkPolicy as PodSecurityPolicy['networkPolicy'],
    allowedDomains: policy.allowedDomains,
    blockedDomains: policy.blockedDomains,
    allowInternet: policy.allowInternet,

    idleTimeout: policy.idleTimeout,
    maxSessionDuration: policy.maxSessionDuration ?? undefined,
    requireMfa: policy.requireMfa,

    recordSession: policy.recordSession,
    logKeystrokes: policy.logKeystrokes,
    logClipboard: policy.logClipboard,
    logFileAccess: policy.logFileAccess,

    isActive: policy.isActive,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

// =============================================================================
// PRESET POLICIES
// =============================================================================

export const PRESET_POLICIES: Record<string, Omit<PodSecurityPolicyInput, 'name'>> = {
  /**
   * Maximum security - suitable for highly regulated environments
   */
  MAXIMUM_SECURITY: {
    description: 'Maximum security policy for highly regulated environments (HIPAA, PCI-DSS)',
    clipboardPolicy: 'BLOCKED',
    clipboardInbound: false,
    clipboardOutbound: false,
    fileDownloadPolicy: 'BLOCKED',
    fileUploadPolicy: 'APPROVAL_REQUIRED',
    blockedFileTypes: ['*'],
    printingPolicy: 'BLOCKED',
    usbPolicy: 'BLOCKED',
    screenCaptureBlocking: true,
    watermarkEnabled: true,
    watermarkConfig: {
      showUsername: true,
      showTimestamp: true,
      showIpAddress: true,
      position: 'tiled',
      opacity: 0.3,
      fontSize: 14,
      color: '#888888',
    },
    networkPolicy: 'BLOCKED',
    allowInternet: false,
    idleTimeout: 5,
    maxSessionDuration: 120,
    requireMfa: true,
    recordSession: true,
    logKeystrokes: true,
    logClipboard: true,
    logFileAccess: true,
  },

  /**
   * Standard enterprise - balanced security and usability
   */
  STANDARD_ENTERPRISE: {
    description: 'Standard enterprise policy balancing security and usability',
    clipboardPolicy: 'READ_ONLY',
    clipboardInbound: true,
    clipboardOutbound: false,
    clipboardMaxSize: 1024 * 1024, // 1MB
    fileDownloadPolicy: 'APPROVAL_REQUIRED',
    fileUploadPolicy: 'ALLOWED',
    allowedFileTypes: ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.csv'],
    blockedFileTypes: ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.zip', '.7z'],
    maxFileSize: 50 * 1024 * 1024, // 50MB
    printingPolicy: 'PDF_ONLY',
    usbPolicy: 'STORAGE_BLOCKED',
    screenCaptureBlocking: true,
    watermarkEnabled: true,
    watermarkConfig: {
      showUsername: true,
      showTimestamp: false,
      showIpAddress: false,
      position: 'corner',
      opacity: 0.2,
      fontSize: 12,
      color: '#999999',
    },
    networkPolicy: 'RESTRICTED',
    allowInternet: false,
    idleTimeout: 15,
    maxSessionDuration: 480,
    requireMfa: true,
    recordSession: true,
    logKeystrokes: false,
    logClipboard: true,
    logFileAccess: true,
  },

  /**
   * Development - relaxed for dev/test environments
   */
  DEVELOPMENT: {
    description: 'Relaxed policy for development and testing environments',
    clipboardPolicy: 'BIDIRECTIONAL',
    clipboardInbound: true,
    clipboardOutbound: true,
    fileDownloadPolicy: 'ALLOWED',
    fileUploadPolicy: 'ALLOWED',
    maxFileSize: 500 * 1024 * 1024, // 500MB
    printingPolicy: 'ALLOWED',
    usbPolicy: 'ALLOWED',
    screenCaptureBlocking: false,
    watermarkEnabled: false,
    networkPolicy: 'MONITORED',
    allowInternet: true,
    idleTimeout: 60,
    requireMfa: false,
    recordSession: false,
    logKeystrokes: false,
    logClipboard: false,
    logFileAccess: true,
  },

  /**
   * Healthcare/HIPAA - specialized for healthcare environments
   */
  HEALTHCARE: {
    description: 'HIPAA-compliant policy for healthcare environments',
    clipboardPolicy: 'BLOCKED',
    clipboardInbound: false,
    clipboardOutbound: false,
    fileDownloadPolicy: 'APPROVAL_REQUIRED',
    fileUploadPolicy: 'APPROVAL_REQUIRED',
    allowedFileTypes: ['.pdf', '.hl7', '.cda', '.fhir'],
    blockedFileTypes: ['*'],
    printingPolicy: 'BLOCKED',
    usbPolicy: 'BLOCKED',
    screenCaptureBlocking: true,
    watermarkEnabled: true,
    watermarkConfig: {
      text: 'CONFIDENTIAL PHI',
      showUsername: true,
      showTimestamp: true,
      showIpAddress: true,
      position: 'tiled',
      opacity: 0.25,
      fontSize: 16,
      color: '#cc0000',
    },
    networkPolicy: 'RESTRICTED',
    allowInternet: false,
    idleTimeout: 5,
    maxSessionDuration: 60,
    requireMfa: true,
    recordSession: true,
    logKeystrokes: true,
    logClipboard: true,
    logFileAccess: true,
  },

  /**
   * Financial services - specialized for finance environments
   */
  FINANCIAL: {
    description: 'PCI-DSS compliant policy for financial services',
    clipboardPolicy: 'BLOCKED',
    clipboardInbound: false,
    clipboardOutbound: false,
    fileDownloadPolicy: 'BLOCKED',
    fileUploadPolicy: 'APPROVAL_REQUIRED',
    printingPolicy: 'BLOCKED',
    usbPolicy: 'BLOCKED',
    screenCaptureBlocking: true,
    watermarkEnabled: true,
    watermarkConfig: {
      text: 'CONFIDENTIAL FINANCIAL DATA',
      showUsername: true,
      showTimestamp: true,
      showIpAddress: true,
      position: 'tiled',
      opacity: 0.2,
      fontSize: 14,
      color: '#0066cc',
    },
    networkPolicy: 'RESTRICTED',
    allowInternet: false,
    idleTimeout: 10,
    maxSessionDuration: 240,
    requireMfa: true,
    recordSession: true,
    logKeystrokes: true,
    logClipboard: true,
    logFileAccess: true,
  },
};
