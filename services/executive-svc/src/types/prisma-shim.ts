/**
 * Prisma Types Shim
 *
 * This file provides type definitions for Prisma models when the Prisma client
 * hasn't been generated with the executive schema (e.g., offline builds).
 *
 * These types mirror the executive.prisma schema definitions.
 */

// Re-export PrismaClient from actual prisma
export { PrismaClient } from '@prisma/client';

// =============================================================================
// ENUMS (as string literal types for compatibility with code using string literals)
// =============================================================================

export type ExecutiveType =
  | 'FRACTIONAL_CTO'
  | 'FRACTIONAL_CFO'
  | 'FRACTIONAL_CMO'
  | 'FRACTIONAL_CISO'
  | 'FRACTIONAL_COO'
  | 'FRACTIONAL_CHRO'
  | 'FRACTIONAL_CPO'
  | 'FRACTIONAL_CRO'
  | 'FRACTIONAL_CLO'
  | 'FRACTIONAL_CDO'
  | 'BOARD_ADVISOR'
  | 'INTERIM_EXECUTIVE';

export type VettingStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'WITHDRAWN';

export type VettingStage =
  | 'APPLICATION'
  | 'AUTOMATED_SCREENING'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'REFERENCE_CHECK'
  | 'BACKGROUND_CHECK'
  | 'FINAL_REVIEW'
  | 'COMPLETE';

export type BackgroundCheckStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PASSED'
  | 'FAILED'
  | 'REQUIRES_REVIEW';

export type CompanyStage =
  | 'PRE_SEED'
  | 'SEED'
  | 'SERIES_A'
  | 'SERIES_B'
  | 'SERIES_C_PLUS'
  | 'GROWTH'
  | 'PUBLIC'
  | 'ENTERPRISE';

export type ReferenceRelationship =
  | 'REPORTED_TO'
  | 'PEER'
  | 'DIRECT_REPORT'
  | 'CLIENT'
  | 'BOARD_MEMBER'
  | 'INVESTOR';

export type ReferenceStatus =
  | 'PENDING'
  | 'REQUESTED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED';

export type InterviewType =
  | 'SCREENING'
  | 'COMPETENCY'
  | 'FINAL';

export type InterviewStatus =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'RESCHEDULED'
  | 'CANCELLED';

export type InterviewRecommendation =
  | 'STRONG_YES'
  | 'YES'
  | 'MAYBE'
  | 'NO'
  | 'STRONG_NO';

export type EngagementStatus =
  | 'PROPOSAL'
  | 'NEGOTIATING'
  | 'CONTRACT_SENT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'RENEWAL'
  | 'COMPLETED'
  | 'TERMINATED';

export type BillingModel =
  | 'RETAINER'
  | 'HOURLY'
  | 'HYBRID'
  | 'PROJECT';

export type EngagementBillingCycle =
  | 'WEEKLY'
  | 'BI_WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY';

export type ExecutiveTimeCategory =
  | 'ADVISORY'
  | 'MEETINGS'
  | 'EXECUTION'
  | 'DOCUMENTATION'
  | 'RESEARCH'
  | 'TRAVEL'
  | 'OTHER';

export type TimeEntryStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'INVOICED';

export type InitiativeStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED';

export type OKRStatus =
  | 'NOT_STARTED'
  | 'ON_TRACK'
  | 'AT_RISK'
  | 'BEHIND'
  | 'ACHIEVED'
  | 'CANCELLED';

export type RACIRole =
  | 'RESPONSIBLE'
  | 'ACCOUNTABLE'
  | 'CONSULTED'
  | 'INFORMED';

export type PRDStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'IN_DEVELOPMENT'
  | 'SHIPPED'
  | 'ARCHIVED';

export type PrioritizationFramework =
  | 'RICE'
  | 'ICE'
  | 'VALUE_EFFORT'
  | 'KANO'
  | 'MOSCOW'
  | 'CUSTOM';

export type FeatureStatus =
  | 'IDEA'
  | 'BACKLOG'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'SHIPPED'
  | 'DEPRECATED';

// =============================================================================
// ENUM VALUE OBJECTS (for using enums as values)
// =============================================================================

export const ExecutiveType = {
  FRACTIONAL_CTO: 'FRACTIONAL_CTO' as const,
  FRACTIONAL_CFO: 'FRACTIONAL_CFO' as const,
  FRACTIONAL_CMO: 'FRACTIONAL_CMO' as const,
  FRACTIONAL_CISO: 'FRACTIONAL_CISO' as const,
  FRACTIONAL_COO: 'FRACTIONAL_COO' as const,
  FRACTIONAL_CHRO: 'FRACTIONAL_CHRO' as const,
  FRACTIONAL_CPO: 'FRACTIONAL_CPO' as const,
  FRACTIONAL_CRO: 'FRACTIONAL_CRO' as const,
  FRACTIONAL_CLO: 'FRACTIONAL_CLO' as const,
  FRACTIONAL_CDO: 'FRACTIONAL_CDO' as const,
  BOARD_ADVISOR: 'BOARD_ADVISOR' as const,
  INTERIM_EXECUTIVE: 'INTERIM_EXECUTIVE' as const,
};

export const VettingStatus = {
  PENDING: 'PENDING' as const,
  IN_REVIEW: 'IN_REVIEW' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  SUSPENDED: 'SUSPENDED' as const,
  WITHDRAWN: 'WITHDRAWN' as const,
};

export const VettingStage = {
  APPLICATION: 'APPLICATION' as const,
  AUTOMATED_SCREENING: 'AUTOMATED_SCREENING' as const,
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED' as const,
  INTERVIEW_COMPLETED: 'INTERVIEW_COMPLETED' as const,
  REFERENCE_CHECK: 'REFERENCE_CHECK' as const,
  BACKGROUND_CHECK: 'BACKGROUND_CHECK' as const,
  FINAL_REVIEW: 'FINAL_REVIEW' as const,
  COMPLETE: 'COMPLETE' as const,
};

export const BackgroundCheckStatus = {
  NOT_STARTED: 'NOT_STARTED' as const,
  PENDING: 'PENDING' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  PASSED: 'PASSED' as const,
  FAILED: 'FAILED' as const,
  REQUIRES_REVIEW: 'REQUIRES_REVIEW' as const,
};

export const CompanyStage = {
  PRE_SEED: 'PRE_SEED' as const,
  SEED: 'SEED' as const,
  SERIES_A: 'SERIES_A' as const,
  SERIES_B: 'SERIES_B' as const,
  SERIES_C_PLUS: 'SERIES_C_PLUS' as const,
  GROWTH: 'GROWTH' as const,
  PUBLIC: 'PUBLIC' as const,
  ENTERPRISE: 'ENTERPRISE' as const,
};

export const ReferenceRelationship = {
  REPORTED_TO: 'REPORTED_TO' as const,
  PEER: 'PEER' as const,
  DIRECT_REPORT: 'DIRECT_REPORT' as const,
  CLIENT: 'CLIENT' as const,
  BOARD_MEMBER: 'BOARD_MEMBER' as const,
  INVESTOR: 'INVESTOR' as const,
};

export const ReferenceStatus = {
  PENDING: 'PENDING' as const,
  REQUESTED: 'REQUESTED' as const,
  COMPLETED: 'COMPLETED' as const,
  DECLINED: 'DECLINED' as const,
  EXPIRED: 'EXPIRED' as const,
};

export const InterviewType = {
  SCREENING: 'SCREENING' as const,
  COMPETENCY: 'COMPETENCY' as const,
  FINAL: 'FINAL' as const,
};

export const InterviewStatus = {
  SCHEDULED: 'SCHEDULED' as const,
  COMPLETED: 'COMPLETED' as const,
  NO_SHOW: 'NO_SHOW' as const,
  RESCHEDULED: 'RESCHEDULED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const InterviewRecommendation = {
  STRONG_YES: 'STRONG_YES' as const,
  YES: 'YES' as const,
  MAYBE: 'MAYBE' as const,
  NO: 'NO' as const,
  STRONG_NO: 'STRONG_NO' as const,
};

export const EngagementStatus = {
  PROPOSAL: 'PROPOSAL' as const,
  NEGOTIATING: 'NEGOTIATING' as const,
  CONTRACT_SENT: 'CONTRACT_SENT' as const,
  ACTIVE: 'ACTIVE' as const,
  PAUSED: 'PAUSED' as const,
  RENEWAL: 'RENEWAL' as const,
  COMPLETED: 'COMPLETED' as const,
  TERMINATED: 'TERMINATED' as const,
};

export const BillingModel = {
  RETAINER: 'RETAINER' as const,
  HOURLY: 'HOURLY' as const,
  HYBRID: 'HYBRID' as const,
  PROJECT: 'PROJECT' as const,
};

export const EngagementBillingCycle = {
  WEEKLY: 'WEEKLY' as const,
  BI_WEEKLY: 'BI_WEEKLY' as const,
  MONTHLY: 'MONTHLY' as const,
  QUARTERLY: 'QUARTERLY' as const,
};

export const ExecutiveTimeCategory = {
  ADVISORY: 'ADVISORY' as const,
  MEETINGS: 'MEETINGS' as const,
  EXECUTION: 'EXECUTION' as const,
  DOCUMENTATION: 'DOCUMENTATION' as const,
  RESEARCH: 'RESEARCH' as const,
  TRAVEL: 'TRAVEL' as const,
  OTHER: 'OTHER' as const,
};

export const TimeEntryStatus = {
  PENDING: 'PENDING' as const,
  SUBMITTED: 'SUBMITTED' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  INVOICED: 'INVOICED' as const,
};

export const InitiativeStatus = {
  PLANNED: 'PLANNED' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  BLOCKED: 'BLOCKED' as const,
  COMPLETED: 'COMPLETED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const OKRStatus = {
  NOT_STARTED: 'NOT_STARTED' as const,
  ON_TRACK: 'ON_TRACK' as const,
  AT_RISK: 'AT_RISK' as const,
  BEHIND: 'BEHIND' as const,
  ACHIEVED: 'ACHIEVED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const RACIRole = {
  RESPONSIBLE: 'RESPONSIBLE' as const,
  ACCOUNTABLE: 'ACCOUNTABLE' as const,
  CONSULTED: 'CONSULTED' as const,
  INFORMED: 'INFORMED' as const,
};

export const PRDStatus = {
  DRAFT: 'DRAFT' as const,
  REVIEW: 'REVIEW' as const,
  APPROVED: 'APPROVED' as const,
  IN_DEVELOPMENT: 'IN_DEVELOPMENT' as const,
  SHIPPED: 'SHIPPED' as const,
  ARCHIVED: 'ARCHIVED' as const,
};

export const PrioritizationFramework = {
  RICE: 'RICE' as const,
  ICE: 'ICE' as const,
  VALUE_EFFORT: 'VALUE_EFFORT' as const,
  KANO: 'KANO' as const,
  MOSCOW: 'MOSCOW' as const,
  CUSTOM: 'CUSTOM' as const,
};

export const FeatureStatus = {
  IDEA: 'IDEA' as const,
  BACKLOG: 'BACKLOG' as const,
  PLANNED: 'PLANNED' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  SHIPPED: 'SHIPPED' as const,
  DEPRECATED: 'DEPRECATED' as const,
};

// =============================================================================
// MODEL INTERFACES
// =============================================================================

export interface ExecutiveProfile {
  id: string;
  userId: string;
  executiveType: ExecutiveType;
  headline: string;
  bio?: string | null;
  yearsExecutiveExp: number;
  totalYearsExp: number;
  industries: string[];
  specializations: string[];
  companyStages: CompanyStage[];
  companySizes: string[];
  vettingStatus: VettingStatus;
  vettingStage: VettingStage;
  vettingStartedAt?: Date | null;
  vettingCompletedAt?: Date | null;
  vettingNotes?: string | null;
  vettingScore?: number | null;
  backgroundCheckStatus: BackgroundCheckStatus;
  backgroundCheckId?: string | null;
  backgroundCheckDate?: Date | null;
  referencesRequired: number;
  referencesVerified: number;
  linkedinUrl?: string | null;
  linkedinVerified: boolean;
  linkedinData?: any;
  linkedinAccessToken?: string | null;
  linkedinTokenExpiry?: Date | null;
  linkedinLastVerified?: Date | null;
  maxClients: number;
  currentClients: number;
  hoursPerWeekMin: number;
  hoursPerWeekMax: number;
  availableFrom?: Date | null;
  timezone?: string | null;
  monthlyRetainerMin?: number | null;
  monthlyRetainerMax?: number | null;
  hourlyRateMin?: number | null;
  hourlyRateMax?: number | null;
  currency: string;
  featuredExecutive: boolean;
  featuredOrder?: number | null;
  profileCompleteness: number;
  searchable: boolean;
  profilePhotoUrl?: string | null;
  resumeUrl?: string | null;
  assignedReviewer?: string | null;
  lastActivityAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutiveHistory {
  id: string;
  executiveId: string;
  title: string;
  company: string;
  companyLinkedinUrl?: string | null;
  companyWebsite?: string | null;
  companyVerified: boolean;
  startDate: Date;
  endDate?: Date | null;
  isCurrent: boolean;
  companyStage?: CompanyStage | null;
  companySize?: string | null;
  industry?: string | null;
  description?: string | null;
  achievements: string[];
  teamSize?: number | null;
  budgetManaged?: number | null;
  verified: boolean;
  verificationMethod?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutiveReference {
  id: string;
  executiveId: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone?: string | null;
  linkedinUrl?: string | null;
  relationship: ReferenceRelationship;
  yearsKnown: number;
  workedTogetherAt?: string | null;
  status: ReferenceStatus;
  requestToken?: string | null;
  requestTokenExpiry?: Date | null;
  requestSentAt?: Date | null;
  reminderSentAt?: Date | null;
  reminderCount: number;
  completedAt?: Date | null;
  rating?: number | null;
  wouldRecommend?: boolean | null;
  leadershipRating?: number | null;
  technicalRating?: number | null;
  communicationRating?: number | null;
  strategicRating?: number | null;
  strengths: string[];
  areasForGrowth: string[];
  comments?: string | null;
  additionalContext?: string | null;
  referenceScore?: number | null;
  verified: boolean;
  verifiedBy?: string | null;
  verificationNotes?: string | null;
  flagged: boolean;
  flagReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VettingInterview {
  id: string;
  executiveId: string;
  scheduledAt: Date;
  duration: number;
  interviewer: string;
  interviewerName?: string | null;
  interviewType: InterviewType;
  meetingUrl?: string | null;
  calendlyEventId?: string | null;
  status: InterviewStatus;
  conductedAt?: Date | null;
  actualDuration?: number | null;
  recordingUrl?: string | null;
  transcriptUrl?: string | null;
  communicationScore?: number | null;
  leadershipScore?: number | null;
  technicalExpertiseScore?: number | null;
  strategicThinkingScore?: number | null;
  cultureFitScore?: number | null;
  executivePresenceScore?: number | null;
  overallScore?: number | null;
  recommendation?: InterviewRecommendation | null;
  notes?: string | null;
  strengthsObserved: string[];
  concernsNoted: string[];
  followUpRequired: boolean;
  followUpNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutiveEngagement {
  id: string;
  executiveId: string;
  clientTenantId: string;
  clientContactId: string;
  title: string;
  role: ExecutiveType;
  description?: string | null;
  isMarketplaceEngagement: boolean;
  status: EngagementStatus;
  proposalSentAt?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  renewalDate?: Date | null;
  terminatedAt?: Date | null;
  terminationReason?: string | null;
  hoursPerWeek: number;
  hoursPerWeekMin?: number | null;
  hoursPerWeekMax?: number | null;
  billingModel: BillingModel;
  monthlyRetainer?: number | null;
  hourlyRate?: number | null;
  currency: string;
  billingCycle: EngagementBillingCycle;
  paymentTerms: number;
  contractId?: string | null;
  scopeOfWork?: string | null;
  totalHoursLogged: number;
  lastActivityAt?: Date | null;
  meetingCadence?: string | null;
  communicationChannels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutiveWorkspace {
  id: string;
  engagementId: string;
  dashboardLayout?: any;
  enabledWidgets: string[];
  widgetConfigs?: any;
  skillpodEnabled: boolean;
  skillpodPolicyId?: string | null;
  clientLogo?: string | null;
  primaryColor?: string | null;
  workspaceName?: string | null;
  pinnedDocuments: any[];
  pinnedLinks: any[];
  favoriteActions: string[];
  executiveNotes?: string | null;
  clientContext?: string | null;
  recentFiles: any[];
  recentTools: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutiveTimeEntry {
  id: string;
  engagementId: string;
  executiveId: string;
  date: Date;
  hours: number;
  description: string;
  category: ExecutiveTimeCategory;
  billable: boolean;
  skillpodSessionId?: string | null;
  status: TimeEntryStatus;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  rejectionReason?: string | null;
  invoiceId?: string | null;
  invoicedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TechnicalRoadmap {
  id: string;
  engagementId: string;
  title: string;
  description?: string | null;
  timeframe: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoadmapInitiative {
  id: string;
  roadmapId: string;
  title: string;
  description?: string | null;
  quarter?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  status: InitiativeStatus;
  progress: number;
  category?: string | null;
  priority: number;
  sortOrder: number;
  ownerId?: string | null;
  ownerName?: string | null;
  jiraEpicKey?: string | null;
  jiraEpicUrl?: string | null;
  githubIssueUrl?: string | null;
  dependsOn: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InitiativeMilestone {
  id: string;
  initiativeId: string;
  title: string;
  dueDate?: Date | null;
  completed: boolean;
  completedAt?: Date | null;
  createdAt: Date;
}

export interface PRD {
  id: string;
  engagementId: string;
  title: string;
  status: PRDStatus;
  overview?: string | null;
  problemStatement?: string | null;
  goals: any;
  userStories: any;
  requirements: any;
  successMetrics: any;
  timeline?: any;
  openQuestions: string[];
  appendix?: string | null;
  ownerId?: string | null;
  reviewers: string[];
  templateId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PRDComment {
  id: string;
  prdId: string;
  section: string;
  content: string;
  authorId: string;
  resolved: boolean;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  parentId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PRDVersion {
  id: string;
  prdId: string;
  version: number;
  content: any;
  changedBy: string;
  changeNote?: string | null;
  changes?: any;
  createdAt: Date;
}

export interface PRDTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  content: any;
  isSystem: boolean;
  createdBy?: string | null;
  isPublic: boolean;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeaturePrioritization {
  id: string;
  engagementId: string;
  framework: PrioritizationFramework;
  customWeights?: any;
  impactLevels?: any;
  effortLevels?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrioritizedFeature {
  id: string;
  prioritizationId: string;
  title: string;
  description?: string | null;
  category?: string | null;
  reach?: number | null;
  impact?: number | null;
  confidence?: number | null;
  effort?: number | null;
  iceImpact?: number | null;
  iceConfidence?: number | null;
  iceEase?: number | null;
  valueScore?: number | null;
  effortScore?: number | null;
  customScores?: any;
  score?: number | null;
  rank?: number | null;
  tier?: string | null;
  externalId?: string | null;
  externalSource?: string | null;
  externalUrl?: string | null;
  status: FeatureStatus;
  roadmapQuarter?: string | null;
  relatedPrdId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// PRISMA NAMESPACE STUBS
// =============================================================================

export namespace Prisma {
  export type JsonValue = any;

  export interface ExecutiveProfileWhereInput {
    id?: string | { equals?: string; in?: string[] };
    userId?: string | { equals?: string };
    executiveType?: ExecutiveType | { equals?: ExecutiveType; in?: ExecutiveType[] };
    vettingStatus?: VettingStatus | { equals?: VettingStatus; in?: VettingStatus[] };
    searchable?: boolean | { equals?: boolean };
    industries?: { has?: string; hasEvery?: string[]; hasSome?: string[] };
    specializations?: { has?: string; hasEvery?: string[]; hasSome?: string[] };
    companyStages?: { has?: CompanyStage; hasEvery?: CompanyStage[]; hasSome?: CompanyStage[] };
    AND?: ExecutiveProfileWhereInput | ExecutiveProfileWhereInput[];
    OR?: ExecutiveProfileWhereInput[];
    NOT?: ExecutiveProfileWhereInput | ExecutiveProfileWhereInput[];
    [key: string]: any;
  }

  export interface ExecutiveSubscriptionUpdateInput {
    tier?: any;
    billingCycle?: any;
    monthlyPrice?: any;
    stripeSubscriptionId?: any;
    stripeCustomerId?: any;
    maxClients?: any;
    skillpodHoursIncluded?: any;
    skillpodHoursUsed?: any;
    teamMembersIncluded?: any;
    teamMembersUsed?: any;
    status?: any;
    currentPeriodStart?: any;
    currentPeriodEnd?: any;
    cancelAtPeriodEnd?: any;
    cancelledAt?: any;
    cancelReason?: any;
    trialStart?: any;
    trialEnd?: any;
    [key: string]: any;
  }

  export interface PRDWhereInput {
    id?: string | { equals?: string; in?: string[] };
    engagementId?: string | { equals?: string };
    status?: PRDStatus | { equals?: PRDStatus; in?: PRDStatus[] };
    ownerId?: string | { equals?: string };
    AND?: PRDWhereInput | PRDWhereInput[];
    OR?: PRDWhereInput[];
    NOT?: PRDWhereInput | PRDWhereInput[];
    [key: string]: any;
  }

  export interface PRDTemplateWhereInput {
    id?: string | { equals?: string; in?: string[] };
    isSystem?: boolean | { equals?: boolean };
    createdBy?: string | { equals?: string };
    isPublic?: boolean | { equals?: boolean };
    category?: string | { equals?: string; contains?: string };
    AND?: PRDTemplateWhereInput | PRDTemplateWhereInput[];
    OR?: PRDTemplateWhereInput[];
    NOT?: PRDTemplateWhereInput | PRDTemplateWhereInput[];
    [key: string]: any;
  }

  export interface PRDCommentWhereInput {
    id?: string | { equals?: string; in?: string[] };
    prdId?: string | { equals?: string };
    section?: string | { equals?: string };
    resolved?: boolean | { equals?: boolean };
    authorId?: string | { equals?: string };
    AND?: PRDCommentWhereInput | PRDCommentWhereInput[];
    OR?: PRDCommentWhereInput[];
    NOT?: PRDCommentWhereInput | PRDCommentWhereInput[];
    [key: string]: any;
  }

  export interface PrioritizedFeatureWhereInput {
    id?: string | { equals?: string; in?: string[] };
    prioritizationId?: string | { equals?: string };
    status?: FeatureStatus | { equals?: FeatureStatus; in?: FeatureStatus[] };
    category?: string | { equals?: string; contains?: string };
    AND?: PrioritizedFeatureWhereInput | PrioritizedFeatureWhereInput[];
    OR?: PrioritizedFeatureWhereInput[];
    NOT?: PrioritizedFeatureWhereInput | PrioritizedFeatureWhereInput[];
    [key: string]: any;
  }
}
