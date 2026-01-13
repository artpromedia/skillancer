/**
 * Prisma Types Shim for Market Service
 *
 * This file provides type definitions for Prisma models when the Prisma client
 * hasn't been generated with the market schema (e.g., offline builds).
 */

// Re-export PrismaClient from actual prisma
export { PrismaClient } from '@prisma/client';

// =============================================================================
// ENUMS (as string literal types)
// =============================================================================

export type ContractSourceType =
  | 'JOB'
  | 'SERVICE'
  | 'DIRECT'
  | 'REFERRAL';

export type ContractTypeV2 =
  | 'FIXED_PRICE'
  | 'HOURLY'
  | 'RETAINER'
  | 'MILESTONE'
  | 'TIME_AND_MATERIALS';

export type RateTypeV2 =
  | 'HOURLY'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'FIXED';

export type ContractStatusV2 =
  | 'DRAFT'
  | 'PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'TERMINATED'
  | 'CANCELLED'
  | 'DISPUTED';

export type MilestoneStatusV2 =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID';

export type TimeEntryStatusV2 =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID';

export type EvidenceType =
  | 'IMAGE'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'LINK'
  | 'CODE'
  | 'OTHER';

export type AmendmentStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type TerminationType =
  | 'MUTUAL'
  | 'CLIENT_INITIATED'
  | 'FREELANCER_INITIATED'
  | 'BREACH'
  | 'DISPUTE_RESOLUTION';

export type ContractActivityType =
  | 'CREATED'
  | 'UPDATED'
  | 'STATUS_CHANGED'
  | 'MILESTONE_ADDED'
  | 'MILESTONE_UPDATED'
  | 'TIME_ENTRY_ADDED'
  | 'TIME_ENTRY_APPROVED'
  | 'PAYMENT_PROCESSED'
  | 'SIGNED'
  | 'AMENDED'
  | 'MESSAGE_SENT'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED';

export type SignatureType =
  | 'ELECTRONIC'
  | 'DIGITAL'
  | 'HANDWRITTEN';

export type ContractDisputeStatus =
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'WITHDRAWN';

export type ContractDisputeReason =
  | 'QUALITY'
  | 'PAYMENT'
  | 'TIMELINE'
  | 'COMMUNICATION'
  | 'SCOPE'
  | 'OTHER';

export type ContractDisputeResolution =
  | 'IN_FAVOR_CLIENT'
  | 'IN_FAVOR_FREELANCER'
  | 'SPLIT'
  | 'MUTUAL_AGREEMENT'
  | 'NO_RESOLUTION';

export type ContractInvoiceStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SENT'
  | 'VIEWED'
  | 'PAID'
  | 'PARTIAL'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'DISPUTED';

export type InvoiceLineItemType =
  | 'HOURLY'
  | 'FIXED'
  | 'MILESTONE'
  | 'EXPENSE'
  | 'ADJUSTMENT'
  | 'DISCOUNT';

export type EscrowAccountStatusV2 =
  | 'PENDING'
  | 'ACTIVE'
  | 'FUNDED'
  | 'PARTIALLY_RELEASED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'CLOSED';

export type EscrowTransactionTypeV2 =
  | 'FUNDING'
  | 'RELEASE'
  | 'PARTIAL_RELEASE'
  | 'REFUND'
  | 'DISPUTE_HOLD'
  | 'FEE';

export type EscrowTransactionStatusV2 =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type ExperienceLevel =
  | 'ENTRY'
  | 'JUNIOR'
  | 'MID'
  | 'SENIOR'
  | 'EXPERT'
  | 'PRINCIPAL';

export type RateSourceType =
  | 'JOB_POSTING'
  | 'BID'
  | 'CONTRACT'
  | 'SURVEY'
  | 'EXTERNAL';

export type RateType =
  | 'HOURLY'
  | 'FIXED'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY';

export type PeriodType =
  | 'DAY'
  | 'DAILY'
  | 'WEEK'
  | 'WEEKLY'
  | 'MONTH'
  | 'MONTHLY'
  | 'QUARTER'
  | 'QUARTERLY'
  | 'YEAR';

export type RecommendationType =
  | 'RATE_INCREASE'
  | 'RATE_DECREASE'
  | 'SKILL_PREMIUM'
  | 'EXPERIENCE_ADJUSTMENT'
  | 'MARKET_POSITIONING'
  | 'COMPETITIVE_ANALYSIS';

export type RecommendationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'IMPLEMENTED';

export type DemandLevel =
  | 'VERY_LOW'
  | 'LOW'
  | 'MODERATE'
  | 'MEDIUM'
  | 'HIGH'
  | 'VERY_HIGH';

export type RateChangeReason =
  | 'MARKET_TREND'
  | 'SKILL_ACQUISITION'
  | 'EXPERIENCE_GAIN'
  | 'CLIENT_FEEDBACK'
  | 'COMPETITIVE_PRESSURE'
  | 'INFLATION'
  | 'MANUAL';

// =============================================================================
// ENUM VALUE OBJECTS (for using enums as values)
// =============================================================================

export const ContractSourceType = {
  JOB: 'JOB' as const,
  SERVICE: 'SERVICE' as const,
  DIRECT: 'DIRECT' as const,
  REFERRAL: 'REFERRAL' as const,
};

export const ContractTypeV2 = {
  FIXED_PRICE: 'FIXED_PRICE' as const,
  HOURLY: 'HOURLY' as const,
  RETAINER: 'RETAINER' as const,
  MILESTONE: 'MILESTONE' as const,
  TIME_AND_MATERIALS: 'TIME_AND_MATERIALS' as const,
};

export const RateTypeV2 = {
  HOURLY: 'HOURLY' as const,
  DAILY: 'DAILY' as const,
  WEEKLY: 'WEEKLY' as const,
  MONTHLY: 'MONTHLY' as const,
  FIXED: 'FIXED' as const,
};

export const ContractStatusV2 = {
  DRAFT: 'DRAFT' as const,
  PENDING: 'PENDING' as const,
  ACTIVE: 'ACTIVE' as const,
  PAUSED: 'PAUSED' as const,
  COMPLETED: 'COMPLETED' as const,
  TERMINATED: 'TERMINATED' as const,
  CANCELLED: 'CANCELLED' as const,
  DISPUTED: 'DISPUTED' as const,
};

export const MilestoneStatusV2 = {
  PENDING: 'PENDING' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  SUBMITTED: 'SUBMITTED' as const,
  IN_REVIEW: 'IN_REVIEW' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  PAID: 'PAID' as const,
};

export const TimeEntryStatusV2 = {
  DRAFT: 'DRAFT' as const,
  SUBMITTED: 'SUBMITTED' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  PAID: 'PAID' as const,
};

export const EvidenceType = {
  IMAGE: 'IMAGE' as const,
  VIDEO: 'VIDEO' as const,
  DOCUMENT: 'DOCUMENT' as const,
  LINK: 'LINK' as const,
  CODE: 'CODE' as const,
  OTHER: 'OTHER' as const,
};

export const AmendmentStatus = {
  PENDING: 'PENDING' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const TerminationType = {
  MUTUAL: 'MUTUAL' as const,
  CLIENT_INITIATED: 'CLIENT_INITIATED' as const,
  FREELANCER_INITIATED: 'FREELANCER_INITIATED' as const,
  BREACH: 'BREACH' as const,
  DISPUTE_RESOLUTION: 'DISPUTE_RESOLUTION' as const,
};

export const ContractActivityType = {
  CREATED: 'CREATED' as const,
  UPDATED: 'UPDATED' as const,
  STATUS_CHANGED: 'STATUS_CHANGED' as const,
  MILESTONE_ADDED: 'MILESTONE_ADDED' as const,
  MILESTONE_UPDATED: 'MILESTONE_UPDATED' as const,
  TIME_ENTRY_ADDED: 'TIME_ENTRY_ADDED' as const,
  TIME_ENTRY_APPROVED: 'TIME_ENTRY_APPROVED' as const,
  PAYMENT_PROCESSED: 'PAYMENT_PROCESSED' as const,
  SIGNED: 'SIGNED' as const,
  AMENDED: 'AMENDED' as const,
  MESSAGE_SENT: 'MESSAGE_SENT' as const,
  DISPUTE_OPENED: 'DISPUTE_OPENED' as const,
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED' as const,
};

export const SignatureType = {
  ELECTRONIC: 'ELECTRONIC' as const,
  DIGITAL: 'DIGITAL' as const,
  HANDWRITTEN: 'HANDWRITTEN' as const,
};

export const ContractDisputeStatus = {
  OPEN: 'OPEN' as const,
  UNDER_REVIEW: 'UNDER_REVIEW' as const,
  ESCALATED: 'ESCALATED' as const,
  RESOLVED: 'RESOLVED' as const,
  CLOSED: 'CLOSED' as const,
  WITHDRAWN: 'WITHDRAWN' as const,
};

export const ContractDisputeReason = {
  QUALITY: 'QUALITY' as const,
  PAYMENT: 'PAYMENT' as const,
  TIMELINE: 'TIMELINE' as const,
  COMMUNICATION: 'COMMUNICATION' as const,
  SCOPE: 'SCOPE' as const,
  OTHER: 'OTHER' as const,
};

export const ContractDisputeResolution = {
  IN_FAVOR_CLIENT: 'IN_FAVOR_CLIENT' as const,
  IN_FAVOR_FREELANCER: 'IN_FAVOR_FREELANCER' as const,
  SPLIT: 'SPLIT' as const,
  MUTUAL_AGREEMENT: 'MUTUAL_AGREEMENT' as const,
  NO_RESOLUTION: 'NO_RESOLUTION' as const,
};

export const ContractInvoiceStatus = {
  DRAFT: 'DRAFT' as const,
  PENDING: 'PENDING' as const,
  SENT: 'SENT' as const,
  VIEWED: 'VIEWED' as const,
  PAID: 'PAID' as const,
  PARTIAL: 'PARTIAL' as const,
  OVERDUE: 'OVERDUE' as const,
  CANCELLED: 'CANCELLED' as const,
  DISPUTED: 'DISPUTED' as const,
};

export const InvoiceLineItemType = {
  HOURLY: 'HOURLY' as const,
  FIXED: 'FIXED' as const,
  MILESTONE: 'MILESTONE' as const,
  EXPENSE: 'EXPENSE' as const,
  ADJUSTMENT: 'ADJUSTMENT' as const,
  DISCOUNT: 'DISCOUNT' as const,
};

export const EscrowAccountStatusV2 = {
  PENDING: 'PENDING' as const,
  ACTIVE: 'ACTIVE' as const,
  FUNDED: 'FUNDED' as const,
  PARTIALLY_RELEASED: 'PARTIALLY_RELEASED' as const,
  RELEASED: 'RELEASED' as const,
  REFUNDED: 'REFUNDED' as const,
  DISPUTED: 'DISPUTED' as const,
  CLOSED: 'CLOSED' as const,
};

export const EscrowTransactionTypeV2 = {
  FUNDING: 'FUNDING' as const,
  RELEASE: 'RELEASE' as const,
  PARTIAL_RELEASE: 'PARTIAL_RELEASE' as const,
  REFUND: 'REFUND' as const,
  DISPUTE_HOLD: 'DISPUTE_HOLD' as const,
  FEE: 'FEE' as const,
};

export const EscrowTransactionStatusV2 = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const ExperienceLevel = {
  ENTRY: 'ENTRY' as const,
  JUNIOR: 'JUNIOR' as const,
  MID: 'MID' as const,
  SENIOR: 'SENIOR' as const,
  EXPERT: 'EXPERT' as const,
  PRINCIPAL: 'PRINCIPAL' as const,
};

export const RateSourceType = {
  JOB_POSTING: 'JOB_POSTING' as const,
  BID: 'BID' as const,
  CONTRACT: 'CONTRACT' as const,
  SURVEY: 'SURVEY' as const,
  EXTERNAL: 'EXTERNAL' as const,
};

export const RateType = {
  HOURLY: 'HOURLY' as const,
  FIXED: 'FIXED' as const,
  DAILY: 'DAILY' as const,
  WEEKLY: 'WEEKLY' as const,
  MONTHLY: 'MONTHLY' as const,
};

export const PeriodType = {
  DAY: 'DAY' as const,
  DAILY: 'DAILY' as const,
  WEEK: 'WEEK' as const,
  WEEKLY: 'WEEKLY' as const,
  MONTH: 'MONTH' as const,
  MONTHLY: 'MONTHLY' as const,
  QUARTER: 'QUARTER' as const,
  QUARTERLY: 'QUARTERLY' as const,
  YEAR: 'YEAR' as const,
};

export const RecommendationType = {
  RATE_INCREASE: 'RATE_INCREASE' as const,
  RATE_DECREASE: 'RATE_DECREASE' as const,
  SKILL_PREMIUM: 'SKILL_PREMIUM' as const,
  EXPERIENCE_ADJUSTMENT: 'EXPERIENCE_ADJUSTMENT' as const,
  MARKET_POSITIONING: 'MARKET_POSITIONING' as const,
  COMPETITIVE_ANALYSIS: 'COMPETITIVE_ANALYSIS' as const,
};

export const RecommendationStatus = {
  PENDING: 'PENDING' as const,
  ACCEPTED: 'ACCEPTED' as const,
  REJECTED: 'REJECTED' as const,
  EXPIRED: 'EXPIRED' as const,
  IMPLEMENTED: 'IMPLEMENTED' as const,
};

export const DemandLevel = {
  VERY_LOW: 'VERY_LOW' as const,
  LOW: 'LOW' as const,
  MODERATE: 'MODERATE' as const,
  MEDIUM: 'MEDIUM' as const,
  HIGH: 'HIGH' as const,
  VERY_HIGH: 'VERY_HIGH' as const,
};

export const RateChangeReason = {
  MARKET_TREND: 'MARKET_TREND' as const,
  SKILL_ACQUISITION: 'SKILL_ACQUISITION' as const,
  EXPERIENCE_GAIN: 'EXPERIENCE_GAIN' as const,
  CLIENT_FEEDBACK: 'CLIENT_FEEDBACK' as const,
  COMPETITIVE_PRESSURE: 'COMPETITIVE_PRESSURE' as const,
  INFLATION: 'INFLATION' as const,
  MANUAL: 'MANUAL' as const,
};

// =============================================================================
// MODEL INTERFACES
// =============================================================================

export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  [key: string]: unknown;
}

export interface Tenant {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Job {
  id: string;
  title: string;
  [key: string]: unknown;
}

export interface ContractSignature {
  id: string;
  contractId: string;
  userId: string;
  signatureType: SignatureType;
  signedAt: Date;
  [key: string]: unknown;
}

export interface ContractInvoice {
  id: string;
  contractId: string;
  invoiceNumber: string;
  status: ContractInvoiceStatus;
  amount: number;
  [key: string]: unknown;
}

export interface ContractDispute {
  id: string;
  contractId: string;
  status: ContractDisputeStatus;
  reason: ContractDisputeReason;
  [key: string]: unknown;
}

export interface ContractDisputeMessage {
  id: string;
  disputeId: string;
  userId: string;
  message: string;
  createdAt: Date;
  [key: string]: unknown;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description?: string | null;
  contractType: ContractTypeV2;
  rateType: RateTypeV2;
  templateContent: string;
  isActive: boolean;
  isDefault: boolean;
  [key: string]: unknown;
}

export interface RateDataPoint {
  id: string;
  sourceType: RateSourceType;
  sourceId: string;
  primarySkill: string;
  secondarySkills: string[];
  skillCategory: string;
  rateType: RateType;
  hourlyRate?: number | null;
  fixedRate?: number | null;
  projectDurationDays?: number | null;
  effectiveHourlyRate?: number | null;
  experienceLevel: ExperienceLevel;
  freelancerUserId: string;
  clientUserId: string;
  freelancerCountry?: string | null;
  freelancerRegion?: string | null;
  clientCountry?: string | null;
  wasAccepted: boolean;
  projectCompleted?: boolean | null;
  clientRating?: number | null;
  complianceRequired: string[];
  hasCompliancePremium: boolean;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

// =============================================================================
// PRISMA NAMESPACE STUBS
// =============================================================================

export namespace Prisma {
  export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
  export interface JsonObject {
    [key: string]: JsonValue;
  }
  export type JsonArray = JsonValue[];
  export type InputJsonValue = string | number | boolean | null | InputJsonObject | InputJsonArray;
  export interface InputJsonObject {
    [key: string]: InputJsonValue;
  }
  export type InputJsonArray = InputJsonValue[];

  export const DbNull: unique symbol = Symbol('DbNull');
  export const JsonNull: unique symbol = Symbol('JsonNull');
  export const AnyNull: unique symbol = Symbol('AnyNull');

  // Decimal stub
  export type Decimal = {
    d: number[];
    e: number;
    s: number;
    toNumber(): number;
    toString(): string;
  };
}
