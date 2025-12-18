/**
 * @module @skillancer/skillpod-svc/types/environment
 * Type definitions for environment management
 */

import type {
  TemplateCategory,
  PodStatus,
  ScalingEventType,
  OsType,
  RegistryType,
} from '@prisma/client';

// =============================================================================
// RESOURCE SPECIFICATIONS
// =============================================================================

export interface ResourceSpec {
  cpu: number; // vCPUs
  memory: number; // MB
  storage: number; // GB
  gpus?: number;
  gpu?: boolean;
  gpuType?: string;
  // Extended fields for resource pools
  totalCpu?: number;
  totalMemory?: number;
  totalStorage?: number;
  totalGpus?: number;
  activePods?: number;
}

export interface ResourceUtilization {
  cpuPercent: number;
  memoryPercent: number;
  storagePercent: number;
  networkRxBytes?: number;
  networkTxBytes?: number;
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export type ToolCategory =
  | 'IDE'
  | 'LANGUAGE'
  | 'DATABASE'
  | 'TOOL'
  | 'FRAMEWORK'
  | 'OTHER'
  // Extended categories for template tools
  | 'version-control'
  | 'editor'
  | 'runtime'
  | 'package-manager'
  | 'container'
  | 'database'
  | 'cloud'
  | 'infrastructure'
  | 'data-science'
  | 'design'
  | 'security'
  | 'utility';

export interface ToolDefinition {
  name: string;
  version: string;
  category: ToolCategory;
  description?: string;
  installCommand?: string;
  verifyCommand?: string;
  configPath?: string;
}

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

export interface CreateTemplateParams {
  tenantId?: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  category: TemplateCategory;
  tags?: string[];
  baseImageId: string;
  installedTools: ToolDefinition[];
  defaultConfig?: Record<string, unknown>;
  defaultResources: ResourceSpec;
  minResources?: ResourceSpec;
  maxResources?: ResourceSpec;
  startupScript?: string;
  environmentVars?: Record<string, string>;
  iconUrl?: string;
  screenshotUrls?: string[];
  documentationUrl?: string;
  isPublic?: boolean;
}

export interface UpdateTemplateParams {
  name?: string;
  description?: string;
  shortDescription?: string;
  category?: TemplateCategory;
  tags?: string[];
  baseImageId?: string;
  installedTools?: ToolDefinition[];
  defaultConfig?: Record<string, unknown>;
  defaultResources?: ResourceSpec;
  minResources?: ResourceSpec;
  maxResources?: ResourceSpec;
  startupScript?: string;
  environmentVars?: Record<string, string>;
  iconUrl?: string;
  screenshotUrls?: string[];
  documentationUrl?: string;
  isPublic?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  ecrImageUri?: string;
  kasmImageId?: string;
}

export interface ListTemplatesParams {
  tenantId?: string;
  category?: TemplateCategory;
  tags?: string[];
  search?: string;
  includeGlobal?: boolean;
  page?: number;
  limit?: number;
}

export interface CloneTemplateParams {
  tenantId: string;
  name: string;
  slug: string;
  customizations?: {
    additionalTools?: ToolDefinition[];
    removeTools?: string[];
    overrideConfig?: Record<string, unknown>;
    overrideResources?: Partial<ResourceSpec>;
  };
}

export interface RateTemplateParams {
  templateId: string;
  userId: string;
  rating: number;
  review?: string;
}

// =============================================================================
// POD TYPES
// =============================================================================

export interface AutoScalingConfig {
  enabled: boolean;
  minResources: ResourceSpec;
  maxResources: ResourceSpec;
  cpuThreshold?: number; // For backward compat
  memoryThreshold?: number; // For backward compat
  cpuScaleUpThreshold: number; // percentage
  cpuScaleDownThreshold: number;
  memoryScaleUpThreshold: number;
  memoryScaleDownThreshold: number;
  scaleUpCooldownSeconds: number;
  scaleDownCooldownSeconds: number;
}

export interface CreatePodParams {
  tenantId: string;
  ownerId: string;
  userId?: string; // Alias for ownerId
  templateId?: string;
  name: string;
  description?: string;
  resources?: Partial<ResourceSpec>;
  securityPolicyId?: string;
  autoScalingEnabled?: boolean;
  autoScaling?: AutoScalingConfig;
  autoScalingConfig?: AutoScalingConfig;
  persistentStorage?: boolean;
  expiresAt?: Date;
  environmentVars?: Record<string, string>;
  sessionDurationMinutes?: number;
}

export interface UpdatePodParams {
  name?: string;
  description?: string;
  autoScalingEnabled?: boolean;
  autoScalingConfig?: AutoScalingConfig;
  securityPolicyId?: string;
  expiresAt?: Date;
}

export interface ListPodsParams {
  tenantId: string;
  ownerId?: string;
  status?: PodStatus;
  templateId?: string;
  page?: number;
  limit?: number;
}

export interface PodConnectionInfo {
  connectionUrl: string;
  connectionToken: string;
  expiresAt: Date;
}

export interface PodConnectionDetails {
  connectionUrl: string;
  connectionToken: string;
  expiresAt: Date;
  kasmSessionId?: string;
}

export interface ResizePodParams {
  cpu?: number;
  memory?: number;
  storage?: number;
  gpu?: boolean;
  gpuType?: string;
  reason?: string;
  triggeredBy?: string;
}

// =============================================================================
// BASE IMAGE TYPES
// =============================================================================

export interface CreateBaseImageParams {
  name: string;
  osType: OsType;
  osVersion: string;
  registryType: RegistryType;
  registryUri: string;
  imageTag: string;
  imageDigest?: string;
  sizeBytes: bigint;
  architecture?: string;
  kasmCompatible?: boolean;
  kasmImageId?: string;
  preInstalledTools: ToolDefinition[];
}

export interface UpdateBaseImageParams {
  name?: string;
  imageTag?: string;
  imageDigest?: string;
  sizeBytes?: bigint;
  kasmImageId?: string;
  preInstalledTools?: ToolDefinition[];
  isActive?: boolean;
}

// =============================================================================
// RESOURCE POOL TYPES
// =============================================================================

export interface CreateResourcePoolParams {
  tenantId?: string;
  name: string;
  description?: string;
  instanceType: string;
  minInstances: number;
  maxInstances: number;
  warmPoolSize?: number;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  scaleUpCooldown?: number;
  scaleDownCooldown?: number;
  hourlyRateCents: number;
}

export interface UpdateResourcePoolParams {
  name?: string;
  description?: string;
  minInstances?: number;
  maxInstances?: number;
  warmPoolSize?: number;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  scaleUpCooldown?: number;
  scaleDownCooldown?: number;
  hourlyRateCents?: number;
  isActive?: boolean;
}

export interface TenantQuota {
  tenantId?: string;
  maxCpu: number;
  usedCpu: number;
  maxMemory: number;
  usedMemory: number;
  maxStorage: number;
  usedStorage: number;
  maxPods: number;
  maxConcurrentPods?: number;
  activePods: number;
  maxGpus: number;
  usedGpus: number;
}

export interface TenantUsage {
  cpu: number;
  memory: number;
  storage: number;
  gpus: number;
  activePods: number;
}

// =============================================================================
// SCALING TYPES
// =============================================================================

export interface ScalingDecision {
  podId?: string;
  shouldScale?: boolean;
  action?: 'SCALE_UP' | 'SCALE_DOWN' | 'NONE';
  direction?: 'up' | 'down';
  newCpu?: number;
  newMemory?: number;
  reason?: string;
  currentResources?: ResourceSpec;
  targetResources?: ResourceSpec;
  currentMetrics?: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    networkIn: number;
    networkOut: number;
  };
}

export interface ScalingEvent {
  podId: string;
  scalingEvent: ScalingEventType;
  previousResources: ResourceSpec;
  newResources: ResourceSpec;
  utilization?: ResourceUtilization;
  reason: string;
  timestamp: Date;
}

// =============================================================================
// ECR TYPES
// =============================================================================

export interface ECRBuildParams {
  repositoryName: string;
  imageTag: string;
  dockerfile: string;
  buildArgs?: Record<string, string>;
  context?: string;
}

export interface ECRPushResult {
  imageUri: string;
  imageDigest: string;
  sizeBytes: number;
}

// =============================================================================
// KASM EXTENDED TYPES
// =============================================================================

export interface KasmWorkspaceConfig {
  imageId: string;
  userId: string;
  environment?: Record<string, string>;
  volumeMounts?: {
    volumeId: string;
    mountPath: string;
  }[];
  resourceLimits?: {
    cpu: number;
    memory: number; // bytes
    gpu?: boolean;
  };
}

export interface KasmResizeParams {
  cpu: number;
  memory: number; // bytes
  gpu?: boolean;
}

// =============================================================================
// STORAGE TYPES
// =============================================================================

export interface CreateVolumeParams {
  tenantId: string;
  name: string;
  sizeGb: number;
  type?: 'gp3' | 'io2';
}

export interface VolumeInfo {
  volumeId: string;
  name: string;
  sizeGb: number;
  status: 'creating' | 'available' | 'in-use' | 'deleting' | 'deleted';
  createdAt: Date;
}

// =============================================================================
// ERROR TYPES
// =============================================================================

export type TemplateErrorCode =
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_EXISTS'
  | 'SLUG_EXISTS'
  | 'BASE_IMAGE_NOT_FOUND'
  | 'INVALID_TOOLS'
  | 'INVALID_RESOURCES'
  | 'INVALID_RATING'
  | 'BUILD_FAILED'
  | 'KASM_REGISTRATION_FAILED';

export type PodErrorCode =
  | 'POD_NOT_FOUND'
  | 'TEMPLATE_NOT_FOUND'
  | 'INVALID_RESOURCES'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_POD_STATE'
  | 'INVALID_STATUS'
  | 'INVALID_DURATION'
  | 'UNAUTHORIZED'
  | 'POD_NOT_RUNNING'
  | 'ACCESS_DENIED'
  | 'PROVISION_FAILED'
  | 'KASM_ERROR';

export type ResourcePoolErrorCode =
  | 'POOL_NOT_FOUND'
  | 'POOL_EXISTS'
  | 'INVALID_CAPACITY'
  | 'SCALING_IN_PROGRESS';
