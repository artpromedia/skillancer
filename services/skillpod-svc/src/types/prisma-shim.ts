/**
 * Prisma Types Shim for SkillPod Service
 *
 * This file provides type definitions for Prisma models when the Prisma client
 * hasn't been generated with the skillpod schema (e.g., offline builds).
 */

// Re-export PrismaClient from actual prisma
export { PrismaClient } from '@prisma/client';

// =============================================================================
// ENUMS (as string literal types)
// =============================================================================

export type TemplateCategory =
  | 'DEVELOPMENT'
  | 'DATA_SCIENCE'
  | 'DESIGN'
  | 'CLOUD'
  | 'SECURITY'
  | 'AI_ML'
  | 'DEVOPS'
  | 'CUSTOM';

export type PodStatus =
  | 'PENDING'
  | 'STARTING'
  | 'RUNNING'
  | 'PAUSED'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED'
  | 'TERMINATED';

export type SessionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'TERMINATED' | 'FAILED';

export type ScalingEventType = 'SCALE_UP' | 'SCALE_DOWN' | 'SCALE_OUT' | 'SCALE_IN';

export type OsType = 'LINUX' | 'WINDOWS' | 'MACOS';

export type RegistryType = 'DOCKER_HUB' | 'ECR' | 'GCR' | 'ACR' | 'PRIVATE';

export type KillSwitchStatus = 'ACTIVE' | 'TRIGGERED' | 'RESOLVED' | 'DISABLED';

export type KillSwitchReason =
  | 'POLICY_VIOLATION'
  | 'SECURITY_BREACH'
  | 'MANUAL_OVERRIDE'
  | 'SYSTEM_ERROR'
  | 'DATA_LEAK'
  | 'UNAUTHORIZED_ACCESS';

export type WatermarkType = 'VISIBLE' | 'INVISIBLE' | 'HYBRID';

export type SecurityPolicyType =
  | 'DATA_TRANSFER'
  | 'SCREENSHOT'
  | 'CLIPBOARD'
  | 'RECORDING'
  | 'USB'
  | 'NETWORK';

export type PolicyAction = 'ALLOW' | 'DENY' | 'PROMPT' | 'LOG';

export type TransferDirection = 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';

export type RecordingStatus =
  | 'PENDING'
  | 'RECORDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'DELETED';

export type LearningPathStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export type RecommendationType = 'SKILL_GAP' | 'CAREER_PATH' | 'MARKET_DEMAND' | 'LEARNING_PATH';

export type SignalType = 'JOB_POSTING' | 'SKILL_DEMAND' | 'SALARY_TREND' | 'CERTIFICATION';

// =============================================================================
// ENUM VALUE OBJECTS (for using enums as values)
// =============================================================================

export const TemplateCategory = {
  DEVELOPMENT: 'DEVELOPMENT' as const,
  DATA_SCIENCE: 'DATA_SCIENCE' as const,
  DESIGN: 'DESIGN' as const,
  CLOUD: 'CLOUD' as const,
  SECURITY: 'SECURITY' as const,
  AI_ML: 'AI_ML' as const,
  DEVOPS: 'DEVOPS' as const,
  CUSTOM: 'CUSTOM' as const,
};

export const PodStatus = {
  PENDING: 'PENDING' as const,
  STARTING: 'STARTING' as const,
  RUNNING: 'RUNNING' as const,
  PAUSED: 'PAUSED' as const,
  STOPPING: 'STOPPING' as const,
  STOPPED: 'STOPPED' as const,
  FAILED: 'FAILED' as const,
  TERMINATED: 'TERMINATED' as const,
};

export const SessionStatus = {
  PENDING: 'PENDING' as const,
  ACTIVE: 'ACTIVE' as const,
  PAUSED: 'PAUSED' as const,
  COMPLETED: 'COMPLETED' as const,
  TERMINATED: 'TERMINATED' as const,
  FAILED: 'FAILED' as const,
};

export const ScalingEventType = {
  SCALE_UP: 'SCALE_UP' as const,
  SCALE_DOWN: 'SCALE_DOWN' as const,
  SCALE_OUT: 'SCALE_OUT' as const,
  SCALE_IN: 'SCALE_IN' as const,
};

export const OsType = {
  LINUX: 'LINUX' as const,
  WINDOWS: 'WINDOWS' as const,
  MACOS: 'MACOS' as const,
};

export const RegistryType = {
  DOCKER_HUB: 'DOCKER_HUB' as const,
  ECR: 'ECR' as const,
  GCR: 'GCR' as const,
  ACR: 'ACR' as const,
  PRIVATE: 'PRIVATE' as const,
};

export const KillSwitchStatus = {
  ACTIVE: 'ACTIVE' as const,
  TRIGGERED: 'TRIGGERED' as const,
  RESOLVED: 'RESOLVED' as const,
  DISABLED: 'DISABLED' as const,
};

export const KillSwitchReason = {
  POLICY_VIOLATION: 'POLICY_VIOLATION' as const,
  SECURITY_BREACH: 'SECURITY_BREACH' as const,
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE' as const,
  SYSTEM_ERROR: 'SYSTEM_ERROR' as const,
  DATA_LEAK: 'DATA_LEAK' as const,
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS' as const,
};

export const WatermarkType = {
  VISIBLE: 'VISIBLE' as const,
  INVISIBLE: 'INVISIBLE' as const,
  HYBRID: 'HYBRID' as const,
};

export const SecurityPolicyType = {
  DATA_TRANSFER: 'DATA_TRANSFER' as const,
  SCREENSHOT: 'SCREENSHOT' as const,
  CLIPBOARD: 'CLIPBOARD' as const,
  RECORDING: 'RECORDING' as const,
  USB: 'USB' as const,
  NETWORK: 'NETWORK' as const,
};

export const PolicyAction = {
  ALLOW: 'ALLOW' as const,
  DENY: 'DENY' as const,
  PROMPT: 'PROMPT' as const,
  LOG: 'LOG' as const,
};

export const TransferDirection = {
  INBOUND: 'INBOUND' as const,
  OUTBOUND: 'OUTBOUND' as const,
  BIDIRECTIONAL: 'BIDIRECTIONAL' as const,
};

export const RecordingStatus = {
  PENDING: 'PENDING' as const,
  RECORDING: 'RECORDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  DELETED: 'DELETED' as const,
};

export const LearningPathStatus = {
  DRAFT: 'DRAFT' as const,
  ACTIVE: 'ACTIVE' as const,
  COMPLETED: 'COMPLETED' as const,
  ARCHIVED: 'ARCHIVED' as const,
};

export const RecommendationType = {
  SKILL_GAP: 'SKILL_GAP' as const,
  CAREER_PATH: 'CAREER_PATH' as const,
  MARKET_DEMAND: 'MARKET_DEMAND' as const,
  LEARNING_PATH: 'LEARNING_PATH' as const,
};

export const SignalType = {
  JOB_POSTING: 'JOB_POSTING' as const,
  SKILL_DEMAND: 'SKILL_DEMAND' as const,
  SALARY_TREND: 'SALARY_TREND' as const,
  CERTIFICATION: 'CERTIFICATION' as const,
};

// =============================================================================
// MODEL INTERFACES (minimal stubs)
// =============================================================================

export interface EnvironmentPod {
  id: string;
  name: string;
  status: PodStatus;
  templateId?: string | null;
  userId: string;
  tenantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface EnvironmentTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description?: string | null;
  isPublic: boolean;
  [key: string]: any;
}

export interface Session {
  id: string;
  podId: string;
  status: SessionStatus;
  startedAt?: Date | null;
  endedAt?: Date | null;
  [key: string]: any;
}

export interface DataTransferAttempt {
  id: string;
  sessionId: string;
  direction: TransferDirection;
  status: string;
  [key: string]: any;
}

export interface AccessRevocation {
  id: string;
  userId: string;
  reason: string;
  revokedAt: Date;
  [key: string]: any;
}

export interface KillSwitchEvent {
  id: string;
  status: KillSwitchStatus;
  reason: KillSwitchReason;
  triggeredAt: Date;
  [key: string]: any;
}

export interface WatermarkConfiguration {
  id: string;
  type: WatermarkType;
  enabled: boolean;
  [key: string]: any;
}

export interface WatermarkInstance {
  id: string;
  configurationId: string;
  sessionId: string;
  [key: string]: any;
}

export interface WatermarkDetection {
  id: string;
  instanceId: string;
  detectedAt: Date;
  [key: string]: any;
}

export interface SecurityPolicy {
  id: string;
  type: SecurityPolicyType;
  action: PolicyAction;
  [key: string]: any;
}

export interface Recording {
  id: string;
  sessionId: string;
  status: RecordingStatus;
  [key: string]: any;
}

export interface ResourcePool {
  id: string;
  name: string;
  [key: string]: any;
}

export interface LearningPath {
  id: string;
  userId: string;
  status: LearningPathStatus;
  [key: string]: any;
}

export interface LearningProfile {
  id: string;
  userId: string;
  [key: string]: any;
}

export interface LearningRecommendation {
  id: string;
  type: RecommendationType;
  [key: string]: any;
}

export interface MarketActivitySignal {
  id: string;
  type: SignalType;
  [key: string]: any;
}

export interface MarketTrend {
  id: string;
  skill: string;
  [key: string]: any;
}

export interface SkillGap {
  id: string;
  userId: string;
  skill: string;
  [key: string]: any;
}

export interface BaseImage {
  id: string;
  name: string;
  tag: string;
  registry: string;
  osType: OsType;
  [key: string]: any;
}

export interface PodSecurityPolicy {
  id: string;
  name: string;
  type: SecurityPolicyType;
  action: PolicyAction;
  [key: string]: any;
}

export interface TenantResourceQuota {
  id: string;
  tenantId: string;
  cpuLimit: number;
  memoryLimit: number;
  storageLimit: number;
  [key: string]: any;
}

export interface PodTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description?: string | null;
  isPublic: boolean;
  [key: string]: any;
}

export interface TemplateRating {
  id: string;
  templateId: string;
  userId: string;
  rating: number;
  [key: string]: any;
}

// =============================================================================
// PRISMA NAMESPACE STUBS
// =============================================================================

export namespace Prisma {
  export type JsonValue = any;
  export type InputJsonValue = any;
  export const DbNull: unique symbol = Symbol('DbNull');
  export const JsonNull: unique symbol = Symbol('JsonNull');
  export const AnyNull: unique symbol = Symbol('AnyNull');

  export interface EnvironmentPodWhereInput {
    [key: string]: any;
  }

  export interface EnvironmentTemplateWhereInput {
    [key: string]: any;
  }

  export interface SessionWhereInput {
    [key: string]: any;
  }

  export interface BaseImageWhereInput {
    [key: string]: any;
  }

  export interface BaseImageUpdateInput {
    [key: string]: any;
  }

  export interface PodSecurityPolicyUpdateInput {
    [key: string]: any;
  }

  export interface ResourcePoolWhereInput {
    [key: string]: any;
  }

  export interface ResourcePoolUpdateInput {
    [key: string]: any;
  }

  export interface TenantResourceQuotaUpdateInput {
    [key: string]: any;
  }

  export interface PodTemplateWhereInput {
    [key: string]: any;
  }

  export interface PodTemplateOrderByWithRelationInput {
    [key: string]: any;
  }

  export interface PodTemplateUpdateInput {
    [key: string]: any;
  }
}
