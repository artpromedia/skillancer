/**
 * @module @skillancer/skillpod-svc/repositories/policy
 * Security policy repository for database operations
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/require-await */

import { Prisma } from '@/types/prisma-shim.js';

import type { PrismaClient, PodSecurityPolicy } from '@/types/prisma-shim.js';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Assigns a value to the target object only if the value is not undefined.
 * This reduces cognitive complexity by avoiding many if statements.
 */
function assignIfDefined<T extends Record<string, unknown>, K extends string, V>(
  target: T,
  key: K,
  value: V | undefined,
  transform?: (v: V) => unknown
): void {
  if (value !== undefined) {
    (target as Record<string, unknown>)[key] = transform ? transform(value) : value;
  }
}
// =============================================================================
// TYPES
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

export type NetworkPolicy = 'BLOCKED' | 'RESTRICTED' | 'MONITORED' | 'UNRESTRICTED';

export interface CreatePolicyInput {
  tenantId: string;
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

  // Screen capture controls
  screenCaptureBlocking?: boolean;
  watermarkEnabled?: boolean;
  watermarkConfig?: Record<string, unknown>;

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

export interface UpdatePolicyInput extends Partial<Omit<CreatePolicyInput, 'tenantId'>> {}

export interface PolicyListFilter {
  tenantId: string;
  isActive?: boolean;
  isDefault?: boolean;
}

// =============================================================================
// REPOSITORY INTERFACE
// =============================================================================

export interface PolicyRepository {
  create(input: CreatePolicyInput): Promise<PodSecurityPolicy>;
  findById(id: string): Promise<PodSecurityPolicy | null>;
  findByName(tenantId: string, name: string): Promise<PodSecurityPolicy | null>;
  findDefault(tenantId: string): Promise<PodSecurityPolicy | null>;
  findForPod(podId: string): Promise<PodSecurityPolicy | null>;
  findMany(filter: PolicyListFilter): Promise<PodSecurityPolicy[]>;
  update(id: string, input: UpdatePolicyInput): Promise<PodSecurityPolicy>;
  delete(id: string): Promise<void>;
  setDefault(tenantId: string, policyId: string): Promise<PodSecurityPolicy>;
  clone(id: string, newName: string): Promise<PodSecurityPolicy>;
  countByTenant(tenantId: string): Promise<number>;
  countPodsUsingPolicy(policyId: string): Promise<number>;
}

// =============================================================================
// REPOSITORY IMPLEMENTATION
// =============================================================================

export function createPolicyRepository(prisma: PrismaClient): PolicyRepository {
  async function create(input: CreatePolicyInput): Promise<PodSecurityPolicy> {
    // If setting as default, unset existing defaults
    if (input.isDefault) {
      await prisma.podSecurityPolicy.updateMany({
        where: { tenantId: input.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.podSecurityPolicy.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        description: input.description ?? null,
        isDefault: input.isDefault ?? false,

        // Clipboard controls
        clipboardPolicy: input.clipboardPolicy ?? 'BLOCKED',
        clipboardInbound: input.clipboardInbound ?? false,
        clipboardOutbound: input.clipboardOutbound ?? false,
        clipboardMaxSize: input.clipboardMaxSize ?? null,
        clipboardAllowedTypes: input.clipboardAllowedTypes ?? [],

        // File transfer controls
        fileDownloadPolicy: input.fileDownloadPolicy ?? 'BLOCKED',
        fileUploadPolicy: input.fileUploadPolicy ?? 'ALLOWED',
        allowedFileTypes: input.allowedFileTypes ?? [],
        blockedFileTypes: input.blockedFileTypes ?? ['.exe', '.bat', '.cmd', '.ps1', '.sh'],
        maxFileSize: input.maxFileSize ?? null,

        // Printing controls
        printingPolicy: input.printingPolicy ?? 'BLOCKED',
        allowLocalPrinting: input.allowLocalPrinting ?? false,
        allowPdfExport: input.allowPdfExport ?? false,

        // Peripheral controls
        usbPolicy: input.usbPolicy ?? 'BLOCKED',
        allowedUsbDevices: input.allowedUsbDevices ?? [],
        webcamPolicy: 'ALLOWED',
        microphonePolicy: 'ALLOWED',

        // Screen capture controls
        screenCaptureBlocking: input.screenCaptureBlocking ?? true,
        watermarkEnabled: input.watermarkEnabled ?? true,
        watermarkConfig: input.watermarkConfig
          ? (input.watermarkConfig as Prisma.InputJsonValue)
          : Prisma.DbNull,

        // Network controls
        networkPolicy: input.networkPolicy ?? 'RESTRICTED',
        allowedDomains: input.allowedDomains ?? [],
        blockedDomains: input.blockedDomains ?? [],
        allowInternet: input.allowInternet ?? false,

        // Session controls
        idleTimeout: input.idleTimeout ?? 15,
        maxSessionDuration: input.maxSessionDuration ?? null,
        requireMfa: input.requireMfa ?? true,

        // Audit settings
        recordSession: input.recordSession ?? true,
        logKeystrokes: input.logKeystrokes ?? false,
        logClipboard: input.logClipboard ?? true,
        logFileAccess: input.logFileAccess ?? true,

        isActive: true,
      },
    });
  }

  async function findById(id: string): Promise<PodSecurityPolicy | null> {
    return prisma.podSecurityPolicy.findUnique({
      where: { id },
    });
  }

  async function findByName(tenantId: string, name: string): Promise<PodSecurityPolicy | null> {
    return prisma.podSecurityPolicy.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });
  }

  async function findDefault(tenantId: string): Promise<PodSecurityPolicy | null> {
    return prisma.podSecurityPolicy.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });
  }

  async function findForPod(podId: string): Promise<PodSecurityPolicy | null> {
    const session = await prisma.session.findUnique({
      where: { id: podId },
      include: { securityPolicy: true },
    });
    return session?.securityPolicy ?? null;
  }

  async function findMany(filter: PolicyListFilter): Promise<PodSecurityPolicy[]> {
    const where: Record<string, unknown> = { tenantId: filter.tenantId };
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.isDefault !== undefined) where.isDefault = filter.isDefault;

    return prisma.podSecurityPolicy.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async function update(id: string, input: UpdatePolicyInput): Promise<PodSecurityPolicy> {
    // If setting as default, unset existing defaults
    if (input.isDefault) {
      const existing = await prisma.podSecurityPolicy.findUnique({ where: { id } });
      if (existing) {
        await prisma.podSecurityPolicy.updateMany({
          where: { tenantId: existing.tenantId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
    }

    // Build data object with only defined properties to avoid undefined in Prisma
    const data: Prisma.PodSecurityPolicyUpdateInput = {};

    // Basic info
    assignIfDefined(data, 'name', input.name);
    assignIfDefined(data, 'description', input.description);
    assignIfDefined(data, 'isDefault', input.isDefault);

    // Clipboard controls
    assignIfDefined(data, 'clipboardPolicy', input.clipboardPolicy);
    assignIfDefined(data, 'clipboardInbound', input.clipboardInbound);
    assignIfDefined(data, 'clipboardOutbound', input.clipboardOutbound);
    assignIfDefined(data, 'clipboardMaxSize', input.clipboardMaxSize);
    assignIfDefined(data, 'clipboardAllowedTypes', input.clipboardAllowedTypes);

    // File transfer controls
    assignIfDefined(data, 'fileDownloadPolicy', input.fileDownloadPolicy);
    assignIfDefined(data, 'fileUploadPolicy', input.fileUploadPolicy);
    assignIfDefined(data, 'allowedFileTypes', input.allowedFileTypes);
    assignIfDefined(data, 'blockedFileTypes', input.blockedFileTypes);
    assignIfDefined(data, 'maxFileSize', input.maxFileSize);

    // Printing controls
    assignIfDefined(data, 'printingPolicy', input.printingPolicy);
    assignIfDefined(data, 'allowLocalPrinting', input.allowLocalPrinting);
    assignIfDefined(data, 'allowPdfExport', input.allowPdfExport);

    // USB controls
    assignIfDefined(data, 'usbPolicy', input.usbPolicy);
    assignIfDefined(data, 'allowedUsbDevices', input.allowedUsbDevices);

    // Screen and watermark controls
    assignIfDefined(data, 'screenCaptureBlocking', input.screenCaptureBlocking);
    assignIfDefined(data, 'watermarkEnabled', input.watermarkEnabled);
    assignIfDefined(
      data,
      'watermarkConfig',
      input.watermarkConfig,
      (v) => v as Prisma.InputJsonValue
    );

    // Network controls
    assignIfDefined(data, 'networkPolicy', input.networkPolicy);
    assignIfDefined(data, 'allowedDomains', input.allowedDomains);
    assignIfDefined(data, 'blockedDomains', input.blockedDomains);
    assignIfDefined(data, 'allowInternet', input.allowInternet);

    // Session controls
    assignIfDefined(data, 'idleTimeout', input.idleTimeout);
    assignIfDefined(data, 'maxSessionDuration', input.maxSessionDuration);
    assignIfDefined(data, 'requireMfa', input.requireMfa);

    // Audit controls
    assignIfDefined(data, 'recordSession', input.recordSession);
    assignIfDefined(data, 'logKeystrokes', input.logKeystrokes);
    assignIfDefined(data, 'logClipboard', input.logClipboard);
    assignIfDefined(data, 'logFileAccess', input.logFileAccess);

    return prisma.podSecurityPolicy.update({
      where: { id },
      data,
    });
  }

  async function deletePolicy(id: string): Promise<void> {
    await prisma.podSecurityPolicy.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async function setDefault(tenantId: string, policyId: string): Promise<PodSecurityPolicy> {
    // Unset existing defaults
    await prisma.podSecurityPolicy.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    return prisma.podSecurityPolicy.update({
      where: { id: policyId },
      data: { isDefault: true },
    });
  }

  async function clone(id: string, newName: string): Promise<PodSecurityPolicy> {
    const original = await prisma.podSecurityPolicy.findUnique({ where: { id } });
    if (!original) {
      throw new Error('Policy not found');
    }

    return prisma.podSecurityPolicy.create({
      data: {
        tenantId: original.tenantId,
        name: newName,
        description: `Cloned from ${original.name}`,
        isDefault: false,

        clipboardPolicy: original.clipboardPolicy,
        clipboardInbound: original.clipboardInbound,
        clipboardOutbound: original.clipboardOutbound,
        clipboardMaxSize: original.clipboardMaxSize,
        clipboardAllowedTypes: original.clipboardAllowedTypes,

        fileDownloadPolicy: original.fileDownloadPolicy,
        fileUploadPolicy: original.fileUploadPolicy,
        allowedFileTypes: original.allowedFileTypes,
        blockedFileTypes: original.blockedFileTypes,
        maxFileSize: original.maxFileSize,

        printingPolicy: original.printingPolicy,
        allowLocalPrinting: original.allowLocalPrinting,
        allowPdfExport: original.allowPdfExport,

        usbPolicy: original.usbPolicy,
        allowedUsbDevices: original.allowedUsbDevices,
        webcamPolicy: original.webcamPolicy,
        microphonePolicy: original.microphonePolicy,

        screenCaptureBlocking: original.screenCaptureBlocking,
        watermarkEnabled: original.watermarkEnabled,
        watermarkConfig: original.watermarkConfig
          ? (original.watermarkConfig as Prisma.InputJsonValue)
          : Prisma.DbNull,

        networkPolicy: original.networkPolicy,
        allowedDomains: original.allowedDomains,
        blockedDomains: original.blockedDomains,
        allowInternet: original.allowInternet,

        idleTimeout: original.idleTimeout,
        maxSessionDuration: original.maxSessionDuration,
        requireMfa: original.requireMfa,

        recordSession: original.recordSession,
        logKeystrokes: original.logKeystrokes,
        logClipboard: original.logClipboard,
        logFileAccess: original.logFileAccess,

        isActive: true,
      },
    });
  }

  async function countByTenant(tenantId: string): Promise<number> {
    return prisma.podSecurityPolicy.count({ where: { tenantId, isActive: true } });
  }

  async function countPodsUsingPolicy(policyId: string): Promise<number> {
    return prisma.session.count({
      where: {
        securityPolicyId: policyId,
        status: { in: ['PROVISIONING', 'RUNNING', 'PAUSED'] },
      },
    });
  }

  return {
    create,
    findById,
    findByName,
    findDefault,
    findForPod,
    findMany,
    update,
    delete: deletePolicy,
    setDefault,
    clone,
    countByTenant,
    countPodsUsingPolicy,
  };
}
