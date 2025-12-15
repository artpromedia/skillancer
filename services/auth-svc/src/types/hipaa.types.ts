/**
 * @module @skillancer/auth-svc/types/hipaa
 * HIPAA Compliance type definitions
 */

import type {
  HipaaComplianceLevel,
  BaaStatus,
  PhiAccessType,
  PhiCategory,
  HipaaTrainingType,
  TrainingStatus,
  BreachIncidentType,
  BreachSeverity,
  BreachStatus,
  PhiFieldType,
} from '@skillancer/database';

// Re-export types for convenience
export type {
  HipaaComplianceLevel,
  BaaStatus,
  PhiAccessType,
  PhiCategory,
  HipaaTrainingType,
  TrainingStatus,
  BreachIncidentType,
  BreachSeverity,
  BreachStatus,
  PhiFieldType,
};

// =============================================================================
// HIPAA COMPLIANCE TYPES
// =============================================================================

export interface HipaaComplianceOptions {
  mfaRequired?: boolean | undefined;
  sessionTimeout?: number | undefined;
  ipWhitelist?: string[] | undefined;
  auditRetentionYears?: number | undefined;
}

export interface EnableHipaaComplianceParams {
  tenantId: string;
  adminUserId: string;
  options?: HipaaComplianceOptions | undefined;
}

export interface HipaaComplianceStatus {
  id: string;
  hipaaEnabled: boolean;
  complianceLevel: HipaaComplianceLevel;
  baaStatus: BaaStatus;
  baaSignedAt: Date | null;
  baaExpiresAt: Date | null;
  mfaRequired: boolean;
  sessionTimeout: number;
  encryptionEnabled: boolean;
  encryptionKeyId: string | null;
  assessmentScore: number | null;
  lastAssessmentAt: Date | null;
  nextAssessmentDue: Date | null;
  trainingRequired: boolean;
  enhancedAuditEnabled: boolean;
  auditRetentionYears: number;
  ipWhitelist: string[];
}

// =============================================================================
// PHI ACCESS TYPES
// =============================================================================

export interface AccessCheck {
  check: string;
  passed: boolean;
  message: string;
}

export interface PhiAccessCheckResult {
  allowed: boolean;
  reason?: string;
  failedChecks?: AccessCheck[];
  requiresAction?: string;
  actionUrl?: string;
  accessId?: string;
  expiresAt?: Date;
}

export interface CheckPhiAccessParams {
  userId: string;
  tenantId: string;
  accessType: PhiAccessType;
  phiCategory: PhiCategory;
  purpose: string;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
}

export interface LogPhiAccessParams {
  hipaaComplianceId: string;
  userId: string;
  accessType: PhiAccessType;
  phiCategory: PhiCategory;
  purpose: string;
  resourceType: string;
  resourceId?: string | undefined;
  recordCount?: number | undefined;
  skillpodSessionId?: string | undefined;
  ipAddress?: string | undefined;
}

// =============================================================================
// BAA TYPES
// =============================================================================

export interface BaaContactInfo {
  name: string;
  email: string;
  title: string;
  company: string;
  address: string;
}

export interface RequestBaaParams {
  tenantId: string;
  requestedBy: string;
  contactInfo: BaaContactInfo;
}

export interface CompleteBaaSigningParams {
  tenantId: string;
  documentUrl: string;
  signedAt: Date;
  expiresAt: Date;
  adminUserId: string;
}

// =============================================================================
// TRAINING TYPES
// =============================================================================

export interface TrainingRequirement {
  type: HipaaTrainingType;
  status: TrainingStatus;
  completed: boolean;
  expired: boolean;
  expiresAt: Date | null;
  certificateUrl: string | null;
}

export interface TrainingRequirements {
  required: boolean;
  allCompleted?: boolean;
  trainings?: TrainingRequirement[];
  nextDue?: HipaaTrainingType;
}

export interface RecordTrainingCompletionParams {
  userId: string;
  tenantId: string;
  trainingType: HipaaTrainingType;
  trainingVersion: string;
  quizScore: number;
}

// =============================================================================
// BREACH TYPES
// =============================================================================

export interface ReportBreachParams {
  tenantId: string;
  reportedBy: string;
  incidentType: BreachIncidentType;
  severity: BreachSeverity;
  description: string;
  discoveredAt: Date;
  phiInvolved: boolean;
  phiCategories?: PhiCategory[] | undefined;
  affectedRecords?: number | undefined;
  affectedUsers?: number | undefined;
}

export interface UpdateBreachStatusParams {
  incidentId: string;
  status: BreachStatus;
  updatedBy: string;
  notes?: string | undefined;
  rootCause?: string | undefined;
  remediation?: string | undefined;
  preventiveMeasures?: string | undefined;
}

export interface BreachTimelineEntry {
  action: string;
  description?: string;
  performedBy: string;
  timestamp?: Date;
}

export interface BreachIncidentDetails {
  id: string;
  tenantId: string;
  incidentType: BreachIncidentType;
  severity: BreachSeverity;
  description: string;
  discoveredAt: Date;
  discoveredBy: string;
  affectedRecords: number | null;
  affectedUsers: number | null;
  phiInvolved: boolean;
  phiCategories: PhiCategory[];
  status: BreachStatus;
  containedAt: Date | null;
  resolvedAt: Date | null;
  hhsNotified: boolean;
  hhsNotifiedAt: Date | null;
  affectedNotified: boolean;
  affectedNotifiedAt: Date | null;
  rootCause: string | null;
  remediation: string | null;
  preventiveMeasures: string | null;
  reportUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  notificationDeadline?: Date | undefined;
  nextSteps?: string[] | undefined;
}

// =============================================================================
// ASSESSMENT TYPES
// =============================================================================

export type AssessmentItemStatus = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';

export interface AssessmentItem {
  category: string;
  item: string;
  status: AssessmentItemStatus;
  score: number;
  maxScore: number;
  details?: string;
  remediation?: string;
}

export type RecommendationPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Recommendation {
  priority: RecommendationPriority;
  category: string;
  item: string;
  action: string;
  impact: string;
}

export interface ComplianceAssessment {
  assessmentId: string;
  tenantId: string;
  generatedAt: Date;
  overallScore: number;
  overallStatus: AssessmentItemStatus;
  totalScore: number;
  maxScore: number;
  items: AssessmentItem[];
  recommendations: Recommendation[];
  nextAssessmentDue: Date;
}

// =============================================================================
// PHI PROTECTION TYPES
// =============================================================================

export interface EncryptedData {
  encryptedData: string;
  encryptedKey: string;
  iv: string;
  authTag: string;
  algorithm: string;
  keyId: string;
}

export interface EncryptPhiParams {
  data: string | Buffer;
  tenantId: string;
  context?: Record<string, string> | undefined;
}

export interface DecryptPhiParams {
  encryptedData: EncryptedData;
  tenantId: string;
  context?: Record<string, string> | undefined;
}

export interface TokenizePhiParams {
  value: string;
  type: PhiFieldType;
  tenantId: string;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
}

export interface SecureDeletePhiParams {
  tenantId: string;
  resourceType: string;
  resourceId: string;
}

// =============================================================================
// PHI ACCESS LOG TYPES
// =============================================================================

export interface PhiAccessLogEntry {
  id: string;
  userId: string;
  userName?: string;
  accessType: PhiAccessType;
  phiCategory: PhiCategory;
  purpose: string;
  resourceType: string;
  resourceId: string | null;
  recordCount: number;
  timestamp: Date;
  ipAddress: string | null;
  location: string | null;
}

export interface PhiAccessLogQuery {
  tenantId: string;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  userId?: string | undefined;
  phiCategory?: PhiCategory | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface PhiAccessLogResult {
  logs: PhiAccessLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}
