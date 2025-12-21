/**
 * @skillancer/types - SkillPod: Policy Types
 * Security and compliance policy schemas for VDI pods
 */

import { z } from 'zod';

import {
  uuidSchema,
  dateSchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Policy Enums
// =============================================================================

/**
 * Policy type
 */
export const policyTypeSchema = z.enum([
  'SECURITY',
  'COMPLIANCE',
  'MONITORING',
  'ACCESS',
  'DATA_PROTECTION',
  'NETWORK',
  'CUSTOM',
]);
export type PolicyType = z.infer<typeof policyTypeSchema>;

/**
 * Compliance framework
 */
export const complianceFrameworkSchema = z.enum([
  'HIPAA',
  'SOC2',
  'PCI_DSS',
  'GDPR',
  'ISO_27001',
  'NIST',
  'FedRAMP',
  'CCPA',
  'CUSTOM',
]);
export type ComplianceFramework = z.infer<typeof complianceFrameworkSchema>;

/**
 * Data classification level
 */
export const dataClassificationSchema = z.enum([
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
  'TOP_SECRET',
]);
export type DataClassification = z.infer<typeof dataClassificationSchema>;

/**
 * Policy enforcement mode
 */
export const enforcementModeSchema = z.enum([
  'AUDIT',      // Log only, don't enforce
  'WARN',       // Warn user but allow
  'ENFORCE',    // Block non-compliant actions
  'STRICT',     // Terminate session on violation
]);
export type EnforcementMode = z.infer<typeof enforcementModeSchema>;

// =============================================================================
// Policy Rule Schemas
// =============================================================================

/**
 * Screenshot policy
 */
export const screenshotPolicySchema = z.object({
  enabled: z.boolean().default(true),
  frequencyMinutes: z.number().int().min(1).max(60).default(10),
  blurEnabled: z.boolean().default(false),
  excludeApps: z.array(z.string()).optional(), // Apps to exclude from screenshots
  retentionDays: z.number().int().positive().default(30),
  clientCanView: z.boolean().default(true),
  freelancerCanView: z.boolean().default(false),
});
export type ScreenshotPolicy = z.infer<typeof screenshotPolicySchema>;

/**
 * Activity tracking policy
 */
export const activityTrackingPolicySchema = z.object({
  enabled: z.boolean().default(true),
  trackKeystrokes: z.boolean().default(true),
  trackMouseActivity: z.boolean().default(true),
  trackActiveWindow: z.boolean().default(false),
  trackApplications: z.boolean().default(false),
  idleTimeoutMinutes: z.number().int().positive().default(15),
  minimumActivityPercent: z.number().int().min(0).max(100).default(20),
});
export type ActivityTrackingPolicy = z.infer<typeof activityTrackingPolicySchema>;

/**
 * Clipboard policy
 */
export const clipboardPolicySchema = z.object({
  enabled: z.boolean().default(true),
  copyToLocal: z.boolean().default(true),
  copyFromLocal: z.boolean().default(true),
  maxSizeKb: z.number().int().positive().default(1024),
  allowedTypes: z.array(z.enum(['TEXT', 'IMAGE', 'FILE', 'HTML'])).default(['TEXT']),
  auditClipboard: z.boolean().default(false),
});
export type ClipboardPolicy = z.infer<typeof clipboardPolicySchema>;

/**
 * File transfer policy
 */
export const fileTransferPolicySchema = z.object({
  enabled: z.boolean().default(true),
  uploadEnabled: z.boolean().default(true),
  downloadEnabled: z.boolean().default(true),
  maxFileSizeMb: z.number().int().positive().default(100),
  allowedExtensions: z.array(z.string()).optional(),
  blockedExtensions: z.array(z.string()).default(['.exe', '.bat', '.sh', '.ps1']),
  scanForMalware: z.boolean().default(true),
  auditTransfers: z.boolean().default(true),
});
export type FileTransferPolicy = z.infer<typeof fileTransferPolicySchema>;

/**
 * Network policy
 */
export const networkPolicySchema = z.object({
  internetAccess: z.boolean().default(true),
  allowedDomains: z.array(z.string()).optional(),
  blockedDomains: z.array(z.string()).optional(),
  blockedCategories: z.array(z.enum([
    'MALWARE',
    'PHISHING',
    'ADULT',
    'GAMBLING',
    'SOCIAL_MEDIA',
    'STREAMING',
    'GAMING',
    'CRYPTO',
  ])).optional(),
  vpnRequired: z.boolean().default(false),
  proxyEnabled: z.boolean().default(false),
  proxyUrl: z.string().url().optional(),
  dnsServers: z.array(z.string().ip()).optional(),
  auditTraffic: z.boolean().default(false),
});
export type NetworkPolicy = z.infer<typeof networkPolicySchema>;

/**
 * Print policy
 */
export const printPolicySchema = z.object({
  enabled: z.boolean().default(false),
  localPrinting: z.boolean().default(false),
  pdfExport: z.boolean().default(true),
  watermarkEnabled: z.boolean().default(true),
  watermarkText: z.string().max(100).optional(),
  auditPrints: z.boolean().default(true),
});
export type PrintPolicy = z.infer<typeof printPolicySchema>;

/**
 * USB/device policy
 */
export const devicePolicySchema = z.object({
  usbRedirectionEnabled: z.boolean().default(false),
  allowedDeviceTypes: z.array(z.enum([
    'KEYBOARD',
    'MOUSE',
    'STORAGE',
    'AUDIO',
    'VIDEO',
    'SMART_CARD',
    'PRINTER',
  ])).optional(),
  blockedDeviceTypes: z.array(z.enum([
    'STORAGE',
    'SMART_CARD',
  ])).default(['STORAGE']),
  auditDevices: z.boolean().default(true),
});
export type DevicePolicy = z.infer<typeof devicePolicySchema>;

/**
 * Session policy
 */
export const sessionPolicySchema = z.object({
  maxDurationHours: z.number().int().positive().optional(),
  maxIdleMinutes: z.number().int().positive().default(30),
  forceLogoutOnIdle: z.boolean().default(false),
  requireMfa: z.boolean().default(false),
  allowMultipleSessions: z.boolean().default(false),
  allowReconnection: z.boolean().default(true),
  reconnectionWindowMinutes: z.number().int().positive().default(5),
});
export type SessionPolicy = z.infer<typeof sessionPolicySchema>;

/**
 * Watermark policy
 */
export const watermarkPolicySchema = z.object({
  enabled: z.boolean().default(false),
  displayUserInfo: z.boolean().default(true),
  displayTimestamp: z.boolean().default(true),
  displayIp: z.boolean().default(false),
  customText: z.string().max(200).optional(),
  opacity: z.number().min(0).max(1).default(0.3),
  position: z.enum(['TOP_LEFT', 'TOP_RIGHT', 'CENTER', 'BOTTOM_LEFT', 'BOTTOM_RIGHT', 'TILED']).default('TILED'),
});
export type WatermarkPolicy = z.infer<typeof watermarkPolicySchema>;

// =============================================================================
// Main Policy Schema
// =============================================================================

/**
 * Complete policy schema
 */
export const policySchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  
  // Context
  tenantId: uuidSchema.optional(),
  createdByUserId: uuidSchema,
  
  // Type and compliance
  type: policyTypeSchema,
  complianceFrameworks: z.array(complianceFrameworkSchema).optional(),
  dataClassification: dataClassificationSchema.default('INTERNAL'),
  enforcementMode: enforcementModeSchema.default('ENFORCE'),
  
  // Policy rules
  screenshot: screenshotPolicySchema.optional(),
  activityTracking: activityTrackingPolicySchema.optional(),
  clipboard: clipboardPolicySchema.optional(),
  fileTransfer: fileTransferPolicySchema.optional(),
  network: networkPolicySchema.optional(),
  print: printPolicySchema.optional(),
  device: devicePolicySchema.optional(),
  session: sessionPolicySchema.optional(),
  watermark: watermarkPolicySchema.optional(),
  
  // Status
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  
  // Versioning
  version: z.number().int().positive().default(1),
  previousVersionId: uuidSchema.optional(),
  
  // Application
  appliedToPods: z.array(uuidSchema).optional(),
  appliedToContracts: z.array(uuidSchema).optional(),
  appliedToUsers: z.array(uuidSchema).optional(),
  appliedToTenants: z.array(uuidSchema).optional(),
  
  ...timestampsSchema.shape,
});
export type Policy = z.infer<typeof policySchema>;

// =============================================================================
// Policy CRUD Schemas
// =============================================================================

/**
 * Create policy input
 */
export const createPolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  type: policyTypeSchema,
  complianceFrameworks: z.array(complianceFrameworkSchema).optional(),
  dataClassification: dataClassificationSchema.default('INTERNAL'),
  enforcementMode: enforcementModeSchema.default('ENFORCE'),
  screenshot: screenshotPolicySchema.optional(),
  activityTracking: activityTrackingPolicySchema.optional(),
  clipboard: clipboardPolicySchema.optional(),
  fileTransfer: fileTransferPolicySchema.optional(),
  network: networkPolicySchema.optional(),
  print: printPolicySchema.optional(),
  device: devicePolicySchema.optional(),
  session: sessionPolicySchema.optional(),
  watermark: watermarkPolicySchema.optional(),
  isDefault: z.boolean().default(false),
});
export type CreatePolicy = z.infer<typeof createPolicySchema>;

/**
 * Update policy input
 */
export const updatePolicySchema = createPolicySchema.partial();
export type UpdatePolicy = z.infer<typeof updatePolicySchema>;

/**
 * Apply policy input
 */
export const applyPolicySchema = z.object({
  policyId: uuidSchema,
  podIds: z.array(uuidSchema).optional(),
  contractIds: z.array(uuidSchema).optional(),
  userIds: z.array(uuidSchema).optional(),
  tenantIds: z.array(uuidSchema).optional(),
});
export type ApplyPolicy = z.infer<typeof applyPolicySchema>;

/**
 * Policy filter parameters
 */
export const policyFilterSchema = z.object({
  tenantId: uuidSchema.optional(),
  type: z.array(policyTypeSchema).optional(),
  complianceFramework: z.array(complianceFrameworkSchema).optional(),
  dataClassification: z.array(dataClassificationSchema).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  search: z.string().optional(),
});
export type PolicyFilter = z.infer<typeof policyFilterSchema>;

// =============================================================================
// Policy Violation Schema
// =============================================================================

/**
 * Policy violation record
 */
export const policyViolationSchema = z.object({
  id: uuidSchema,
  policyId: uuidSchema,
  podId: uuidSchema,
  sessionId: uuidSchema.optional(),
  userId: uuidSchema,
  
  // Violation details
  violationType: z.enum([
    'CLIPBOARD_VIOLATION',
    'FILE_TRANSFER_VIOLATION',
    'NETWORK_VIOLATION',
    'PRINT_VIOLATION',
    'DEVICE_VIOLATION',
    'SESSION_VIOLATION',
    'ACTIVITY_VIOLATION',
    'CUSTOM',
  ]),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string().max(1000),
  
  // Context
  details: z.record(z.unknown()).optional(),
  
  // Action taken
  actionTaken: z.enum(['LOGGED', 'WARNED', 'BLOCKED', 'SESSION_TERMINATED']),
  
  // Resolution
  resolved: z.boolean().default(false),
  resolvedAt: dateSchema.optional(),
  resolvedByUserId: uuidSchema.optional(),
  resolutionNotes: z.string().max(1000).optional(),
  
  ...timestampsSchema.shape,
});
export type PolicyViolation = z.infer<typeof policyViolationSchema>;
