/**
 * @module @skillancer/market-svc/types/compliance
 * Compliance-Aware Matching System types and interfaces
 */

// =============================================================================
// ENUMS (matching Prisma schema)
// =============================================================================

export type ComplianceType =
  | 'HIPAA'
  | 'SOC2'
  | 'PCI_DSS'
  | 'GDPR'
  | 'ISO_27001'
  | 'FEDRAMP'
  | 'NIST'
  | 'CCPA'
  | 'FERPA'
  | 'GLBA'
  | 'CUSTOM';

export type ComplianceCategory =
  | 'HEALTHCARE'
  | 'FINANCE'
  | 'GOVERNMENT'
  | 'PRIVACY'
  | 'SECURITY'
  | 'INDUSTRY_SPECIFIC'
  | 'CUSTOM';

export type ClearanceLevel =
  | 'PUBLIC_TRUST'
  | 'CONFIDENTIAL'
  | 'SECRET'
  | 'TOP_SECRET'
  | 'TOP_SECRET_SCI';

export type ComplianceVerificationStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'VERIFIED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVOKED';

export type ExperienceLevel = 'ENTRY' | 'INTERMEDIATE' | 'EXPERT' | 'ANY';

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface AddComplianceInput {
  complianceType: ComplianceType;
  certificationName?: string;
  certificationId?: string;
  issuingOrganization?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  documentUrl?: string;
  selfAttested?: boolean;
  trainingCompleted?: boolean;
  trainingProvider?: string;
}

export interface AddClearanceInput {
  level: ClearanceLevel;
  grantedBy: string;
  investigationType?: string;
  investigationDate?: Date | string;
  grantedDate: Date | string;
  expirationDate?: Date | string;
  polygraphCompleted?: boolean;
  polygraphDate?: Date | string;
}

export interface AddAttestationInput {
  requirementId: string;
  tenantRequirementId?: string;
  answers: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  signature?: string;
  validUntil?: Date | string;
}

export interface CheckEligibilityInput {
  requirements: string[];
}

export interface MatchingCriteria {
  projectId?: string;
  requiredCompliance: string[];
  requiredClearance?: ClearanceLevel;
  preferredCompliance?: string[];
  skills: string[];
  budgetMin?: number;
  budgetMax?: number;
  experienceLevel?: ExperienceLevel;
  minTrustScore?: number;
  excludeUserIds?: string[];
}

export interface MatchingOptions {
  page?: number;
  limit?: number;
  sortBy?: 'score' | 'rate' | 'trust';
}

// =============================================================================
// VERIFICATION TYPES
// =============================================================================

export interface VerificationRequest {
  provider: string;
  complianceType: ComplianceType;
  certificationId?: string | null;
  issuingOrganization?: string | null;
  documentUrl?: string | null;
}

export interface ComplianceVerificationResult {
  verified: boolean;
  status: ComplianceVerificationStatus;
  details?: Record<string, unknown>;
  failureReason?: string;
}

// =============================================================================
// PROFILE TYPES
// =============================================================================

export interface ComplianceInfo {
  type: ComplianceType;
  status: string;
  verificationStatus: ComplianceVerificationStatus;
  certificationName?: string | null;
  expiresAt?: Date | null;
  isExpiringSoon: boolean;
}

export interface ClearanceInfo {
  level: ClearanceLevel;
  status: string;
  verificationStatus: ComplianceVerificationStatus;
  grantedAt: Date;
  expiresAt?: Date | null;
}

export interface AttestationInfo {
  requirementCode: string;
  attestedAt: Date;
  expiresAt?: Date | null;
}

export interface FreelancerComplianceProfile {
  userId: string;
  compliances: ComplianceInfo[];
  clearances: ClearanceInfo[];
  attestations: AttestationInfo[];
  complianceTypes: ComplianceType[];
  clearanceLevels: ClearanceLevel[];
  lastUpdated: Date;
}

// =============================================================================
// ELIGIBILITY TYPES
// =============================================================================

export interface RemediationResource {
  name: string;
  url: string;
}

export interface RemediationPath {
  steps: string[];
  estimatedTime: string;
  estimatedCost?: string;
  resources: RemediationResource[];
}

export interface ComplianceCheckResult {
  requirement: string;
  met: boolean;
  status: string;
  expiringSoon: boolean;
  expiresAt?: Date | null;
  remediation?: RemediationPath;
}

export interface ComplianceEligibility {
  eligible: boolean;
  results: ComplianceCheckResult[];
  missingRequirements: string[];
  expiringRequirements: string[];
}

// =============================================================================
// GAP ANALYSIS TYPES
// =============================================================================

export interface ComplianceGap {
  requirement: string;
  requirementName: string;
  category: string;
  remediation: RemediationPath;
  priority: number;
}

export interface ComplianceGapAnalysis {
  userId: string;
  eligible: boolean;
  gaps: ComplianceGap[];
  estimatedTimeToCompliance: string;
  estimatedCostToCompliance: string;
}

// =============================================================================
// MATCHING TYPES
// =============================================================================

export interface FreelancerProfileSummary {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  headline?: string | null;
  skills: string[];
  hourlyRate?: number | null;
  avgRating?: number | null;
  reviewCount: number;
  totalProjects: number;
  verificationLevel: string;
}

export interface ComplianceStatus {
  allRequirementsMet: boolean;
  metRequirements: string[];
  missingRequirements: string[];
  expiringRequirements: string[];
}

export interface MatchedFreelancer {
  userId: string;
  matchScore: number;
  complianceScore: number;
  skillsScore: number;
  trustScore: number;
  rateScore: number;
  complianceStatus: ComplianceStatus;
  profile: FreelancerProfileSummary;
}

export interface MatchingResult {
  freelancers: MatchedFreelancer[];
  total: number;
}

// =============================================================================
// REQUIREMENT TYPES
// =============================================================================

export interface ComplianceRequirementInfo {
  code: string;
  name: string;
  description: string;
  category: ComplianceCategory;
  requiresCertification: boolean;
  requiresTraining: boolean;
  requiresAttestation: boolean;
  requiresBackgroundCheck: boolean;
  validityPeriodDays?: number | null;
  verificationRequired: boolean;
  verificationProviders: string[];
  trainingUrl?: string | null;
  trainingDurationHours?: number | null;
  certificationUrl?: string | null;
  certificationCost?: number | null;
  regulatoryBody?: string | null;
  jurisdiction: string[];
}

export interface TenantRequirementInfo {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  requiresCertification: boolean;
  requiresTraining: boolean;
  requiresAttestation: boolean;
  attestationQuestions?: AttestationQuestion[] | null;
  validityPeriodDays?: number | null;
}

export interface AttestationQuestion {
  question: string;
  type: 'YES_NO' | 'TEXT';
  requiredAnswer?: string;
}

// =============================================================================
// RESPONSE TYPES
// =============================================================================

export interface ComplianceRecord {
  id: string;
  userId: string;
  complianceType: ComplianceType;
  certificationName?: string | null;
  certificationId?: string | null;
  issuingOrganization?: string | null;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  verificationStatus: ComplianceVerificationStatus;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  documentUrl?: string | null;
  selfAttested: boolean;
  trainingCompleted: boolean;
  trainingProvider?: string | null;
  isActive: boolean;
  renewalReminderSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClearanceRecord {
  id: string;
  userId: string;
  clearanceLevel: ClearanceLevel;
  grantedBy: string;
  investigationType?: string | null;
  investigationDate?: Date | null;
  grantedAt: Date;
  expiresAt?: Date | null;
  lastReinvestigation?: Date | null;
  verificationStatus: ComplianceVerificationStatus;
  verifiedAt?: Date | null;
  polygraphCompleted: boolean;
  polygraphDate?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttestationRecord {
  id: string;
  userId: string;
  requirementCode: string;
  tenantRequirementId?: string | null;
  attestedAt: Date;
  answers: Record<string, unknown>;
  expiresAt?: Date | null;
  isActive: boolean;
  createdAt: Date;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export interface ComplianceNotificationData {
  complianceType?: ComplianceType;
  certificationName?: string | null;
  expiresAt?: Date | null;
  daysUntilExpiry?: number;
  reason?: string;
}

// =============================================================================
// SCORING WEIGHTS
// =============================================================================

export interface MatchingWeights {
  compliance: number;
  skills: number;
  trust: number;
  rate: number;
  experience: number;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  compliance: 0.35,
  skills: 0.25,
  trust: 0.2,
  rate: 0.1,
  experience: 0.1,
};
