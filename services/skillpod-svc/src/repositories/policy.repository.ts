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

import { Prisma } from '@prisma/client';

import type { PrismaClient, PodSecurityPolicy } from '@prisma/client';

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

    return prisma.podSecurityPolicy.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        isDefault: input.isDefault,

        clipboardPolicy: input.clipboardPolicy,
        clipboardInbound: input.clipboardInbound,
        clipboardOutbound: input.clipboardOutbound,
        clipboardMaxSize: input.clipboardMaxSize,
        clipboardAllowedTypes: input.clipboardAllowedTypes,

        fileDownloadPolicy: input.fileDownloadPolicy,
        fileUploadPolicy: input.fileUploadPolicy,
        allowedFileTypes: input.allowedFileTypes,
        blockedFileTypes: input.blockedFileTypes,
        maxFileSize: input.maxFileSize,

        printingPolicy: input.printingPolicy,
        allowLocalPrinting: input.allowLocalPrinting,
        allowPdfExport: input.allowPdfExport,

        usbPolicy: input.usbPolicy,
        allowedUsbDevices: input.allowedUsbDevices,

        screenCaptureBlocking: input.screenCaptureBlocking,
        watermarkEnabled: input.watermarkEnabled,
        watermarkConfig: input.watermarkConfig
          ? (input.watermarkConfig as Prisma.InputJsonValue)
          : undefined,

        networkPolicy: input.networkPolicy,
        allowedDomains: input.allowedDomains,
        blockedDomains: input.blockedDomains,
        allowInternet: input.allowInternet,

        idleTimeout: input.idleTimeout,
        maxSessionDuration: input.maxSessionDuration,
        requireMfa: input.requireMfa,

        recordSession: input.recordSession,
        logKeystrokes: input.logKeystrokes,
        logClipboard: input.logClipboard,
        logFileAccess: input.logFileAccess,
      },
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
