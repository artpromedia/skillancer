/**
 * @skillancer/types - SkillPod: Pod Types
 * Virtual Desktop Infrastructure (VDI) pod schemas
 */

import { z } from 'zod';
import {
  uuidSchema,
  dateSchema,
  timestampsSchema,
} from '../common/base';

// =============================================================================
// Pod Enums
// =============================================================================

/**
 * Pod instance status
 */
export const podStatusSchema = z.enum([
  'CREATING',
  'STARTING',
  'RUNNING',
  'STOPPING',
  'STOPPED',
  'SUSPENDING',
  'SUSPENDED',
  'FAILED',
  'TERMINATED',
  'MAINTENANCE',
]);
export type PodStatus = z.infer<typeof podStatusSchema>;

/**
 * Pod tier/size
 */
export const podTierSchema = z.enum([
  'BASIC',       // 2 vCPU, 4GB RAM
  'STANDARD',    // 4 vCPU, 8GB RAM
  'PROFESSIONAL', // 8 vCPU, 16GB RAM
  'ENTERPRISE',  // 16 vCPU, 32GB RAM
  'CUSTOM',
]);
export type PodTier = z.infer<typeof podTierSchema>;

/**
 * Pod operating system
 */
export const podOsSchema = z.enum([
  'UBUNTU_22_04',
  'UBUNTU_24_04',
  'DEBIAN_12',
  'WINDOWS_11',
  'WINDOWS_SERVER_2022',
  'MACOS_SONOMA', // Future
  'CUSTOM',
]);
export type PodOs = z.infer<typeof podOsSchema>;

/**
 * Pod template category
 */
export const podTemplateCategory = z.enum([
  'DEVELOPMENT',
  'DESIGN',
  'DATA_SCIENCE',
  'VIDEO_EDITING',
  'GENERAL',
  'COMPLIANCE', // Pre-configured for regulated industries
  'CUSTOM',
]);
export type PodTemplateCategory = z.infer<typeof podTemplateCategory>;

// =============================================================================
// Pod Sub-schemas
// =============================================================================

/**
 * Pod hardware specifications
 */
export const podSpecsSchema = z.object({
  vcpus: z.number().int().positive(),
  memoryGb: z.number().positive(),
  storageGb: z.number().positive(),
  storageType: z.enum(['SSD', 'NVME', 'HDD']).default('SSD'),
  gpuEnabled: z.boolean().default(false),
  gpuType: z.string().optional(), // e.g., "NVIDIA T4", "A100"
  gpuMemoryGb: z.number().positive().optional(),
  networkBandwidthMbps: z.number().positive().default(1000),
});
export type PodSpecs = z.infer<typeof podSpecsSchema>;

/**
 * Pod software configuration
 */
export const podSoftwareSchema = z.object({
  os: podOsSchema,
  osVersion: z.string().optional(),
  preInstalledTools: z.array(z.string()).optional(),
  devEnvironments: z.array(z.enum([
    'NODEJS',
    'PYTHON',
    'JAVA',
    'DOTNET',
    'GO',
    'RUST',
    'PHP',
    'RUBY',
  ])).optional(),
  ides: z.array(z.enum([
    'VSCODE',
    'JETBRAINS',
    'SUBLIME',
    'VIM',
    'EMACS',
  ])).optional(),
  customSoftware: z.array(z.object({
    name: z.string(),
    version: z.string().optional(),
    installScript: z.string().optional(),
  })).optional(),
});
export type PodSoftware = z.infer<typeof podSoftwareSchema>;

/**
 * Pod network configuration
 */
export const podNetworkSchema = z.object({
  publicIpEnabled: z.boolean().default(false),
  publicIp: z.string().ip().optional(),
  privateIp: z.string().ip().optional(),
  vpnEnabled: z.boolean().default(false),
  vpnConfig: z.object({
    type: z.enum(['WIREGUARD', 'OPENVPN']),
    serverAddress: z.string().optional(),
  }).optional(),
  firewallRules: z.array(z.object({
    direction: z.enum(['INBOUND', 'OUTBOUND']),
    protocol: z.enum(['TCP', 'UDP', 'ICMP', 'ALL']),
    port: z.number().int().min(1).max(65535).optional(),
    portRange: z.object({
      from: z.number().int().min(1).max(65535),
      to: z.number().int().min(1).max(65535),
    }).optional(),
    cidr: z.string().default('0.0.0.0/0'),
    action: z.enum(['ALLOW', 'DENY']),
  })).optional(),
  allowedDomains: z.array(z.string()).optional(),
  blockedDomains: z.array(z.string()).optional(),
});
export type PodNetwork = z.infer<typeof podNetworkSchema>;

// =============================================================================
// Pod Template Schema
// =============================================================================

/**
 * Pod template (reusable configurations)
 */
export const podTemplateSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  category: podTemplateCategory,
  
  // Configuration
  tier: podTierSchema,
  specs: podSpecsSchema,
  software: podSoftwareSchema,
  network: podNetworkSchema.optional(),
  
  // Template metadata
  isPublic: z.boolean().default(false),
  isOfficial: z.boolean().default(false), // Skillancer official templates
  createdByUserId: uuidSchema.optional(),
  tenantId: uuidSchema.optional(),
  
  // Pricing
  hourlyRate: z.number().nonnegative().optional(),
  currency: z.string().default('USD'),
  
  // Usage stats
  usageCount: z.number().int().nonnegative().default(0),
  
  ...timestampsSchema.shape,
});
export type PodTemplate = z.infer<typeof podTemplateSchema>;

// =============================================================================
// Main Pod Schema
// =============================================================================

/**
 * Complete pod instance schema
 */
export const podSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  
  // Ownership
  ownerUserId: uuidSchema,
  tenantId: uuidSchema.optional(),
  contractId: uuidSchema.optional(), // Associated contract
  
  // Template reference
  templateId: uuidSchema.optional(),
  
  // Status
  status: podStatusSchema,
  statusMessage: z.string().max(500).optional(),
  healthStatus: z.enum(['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN']).default('UNKNOWN'),
  
  // Configuration
  tier: podTierSchema,
  specs: podSpecsSchema,
  software: podSoftwareSchema,
  network: podNetworkSchema.optional(),
  
  // Access
  accessUrl: z.string().url().optional(),
  webRtcUrl: z.string().url().optional(),
  sshHost: z.string().optional(),
  sshPort: z.number().int().min(1).max(65535).default(22),
  
  // Region/availability
  region: z.string(),
  availabilityZone: z.string().optional(),
  
  // Runtime info
  hostNodeId: z.string().optional(),
  containerId: z.string().optional(),
  
  // Lifecycle
  startedAt: dateSchema.optional(),
  stoppedAt: dateSchema.optional(),
  lastActiveAt: dateSchema.optional(),
  expiresAt: dateSchema.optional(), // Auto-termination
  
  // Usage tracking
  totalRuntimeMinutes: z.number().int().nonnegative().default(0),
  currentSessionMinutes: z.number().int().nonnegative().default(0),
  
  // Auto-scaling
  autoSuspend: z.boolean().default(true),
  autoSuspendMinutes: z.number().int().positive().default(30),
  autoTerminate: z.boolean().default(false),
  autoTerminateHours: z.number().int().positive().optional(),
  
  // Snapshots
  lastSnapshotId: uuidSchema.optional(),
  lastSnapshotAt: dateSchema.optional(),
  autoSnapshotEnabled: z.boolean().default(false),
  
  // Billing
  billingAccountId: uuidSchema.optional(),
  hourlyRate: z.number().nonnegative(),
  totalCost: z.number().nonnegative().default(0),
  
  ...timestampsSchema.shape,
});
export type Pod = z.infer<typeof podSchema>;

// =============================================================================
// Pod CRUD Schemas
// =============================================================================

/**
 * Create pod input
 */
export const createPodSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  contractId: uuidSchema.optional(),
  templateId: uuidSchema.optional(),
  tier: podTierSchema.default('STANDARD'),
  specs: podSpecsSchema.optional(),
  software: podSoftwareSchema.optional(),
  network: podNetworkSchema.optional(),
  region: z.string(),
  autoSuspend: z.boolean().default(true),
  autoSuspendMinutes: z.number().int().positive().default(30),
  autoTerminate: z.boolean().default(false),
  autoTerminateHours: z.number().int().positive().optional(),
  autoSnapshotEnabled: z.boolean().default(false),
});
export type CreatePod = z.infer<typeof createPodSchema>;

/**
 * Update pod input
 */
export const updatePodSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  autoSuspend: z.boolean().optional(),
  autoSuspendMinutes: z.number().int().positive().optional(),
  autoTerminate: z.boolean().optional(),
  autoTerminateHours: z.number().int().positive().optional(),
  autoSnapshotEnabled: z.boolean().optional(),
  expiresAt: dateSchema.optional(),
});
export type UpdatePod = z.infer<typeof updatePodSchema>;

/**
 * Pod action input
 */
export const podActionSchema = z.object({
  action: z.enum(['START', 'STOP', 'RESTART', 'SUSPEND', 'RESUME', 'TERMINATE', 'SNAPSHOT']),
  force: z.boolean().default(false),
  snapshotName: z.string().max(100).optional(), // For snapshot action
});
export type PodAction = z.infer<typeof podActionSchema>;

/**
 * Pod filter parameters
 */
export const podFilterSchema = z.object({
  ownerUserId: uuidSchema.optional(),
  tenantId: uuidSchema.optional(),
  contractId: uuidSchema.optional(),
  status: z.array(podStatusSchema).optional(),
  tier: z.array(podTierSchema).optional(),
  region: z.string().optional(),
  search: z.string().optional(),
});
export type PodFilter = z.infer<typeof podFilterSchema>;
