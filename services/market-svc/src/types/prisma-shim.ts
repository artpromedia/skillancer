/* eslint-disable n/no-extraneous-import */
/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Prisma Types Shim for Market Service
 *
 * This file provides type definitions for Prisma models when the Prisma client
 * hasn't been generated with the market schema (e.g., offline builds).
 */

// Re-export PrismaClient from actual prisma
import { PrismaClient as _PrismaClientClass } from '@prisma/client';
export const PrismaClient = _PrismaClientClass;
export type PrismaClient = InstanceType<typeof _PrismaClientClass>;

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
  | 'PAID'
  | 'FUNDED'
  | 'CANCELLED';

export type TimeEntryStatusV2 =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'INVOICED';

export type EvidenceType =
  | 'IMAGE'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'LINK'
  | 'CODE'
  | 'OTHER';

export type AmendmentStatus =
  | 'PENDING'
  | 'PENDING_CLIENT'
  | 'PENDING_FREELANCER'
  | 'PROPOSED'
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
  | 'DISPUTE_RESOLVED'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_SENT'
  | 'CONTRACT_SIGNED'
  | 'CONTRACT_ACTIVATED'
  | 'CONTRACT_PAUSED'
  | 'CONTRACT_RESUMED'
  | 'CONTRACT_COMPLETED'
  | 'CONTRACT_TERMINATED'
  | 'MILESTONE_CREATED'
  | 'MILESTONE_SUBMITTED'
  | 'MILESTONE_APPROVED'
  | 'MILESTONE_REJECTED'
  | 'MILESTONE_FUNDED'
  | 'MILESTONE_PAID'
  | 'MILESTONE_CANCELLED'
  | 'TIME_LOGGED'
  | 'TIME_APPROVED'
  | 'INVOICE_CREATED'
  | 'INVOICE_SENT'
  | 'INVOICE_PAID'
  | 'AMENDMENT_PROPOSED'
  | 'AMENDMENT_APPROVED';

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
  | 'NO_RESOLUTION'
  | 'PARTIAL_REFUND'
  | 'FULL_REFUND_TO_CLIENT'
  | 'FULL_PAYMENT_TO_FREELANCER'
  | 'SPLIT_PAYMENT'
  | 'MUTUAL_CANCELLATION'
  | 'NO_ACTION';

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
  | 'DISCOUNT'
  | 'TIME_ENTRY';

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
  | 'FUND'
  | 'RELEASE'
  | 'PARTIAL_RELEASE'
  | 'REFUND'
  | 'DISPUTE_HOLD'
  | 'HOLD'
  | 'UNHOLD'
  | 'FEE';

export type EscrowTransactionStatusV2 =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CAPTURED'
  | 'REQUIRES_CAPTURE'
  | 'FAILED'
  | 'CANCELLED';

export type ExperienceLevel =
  | 'ENTRY'
  | 'JUNIOR'
  | 'INTERMEDIATE'
  | 'MID'
  | 'SENIOR'
  | 'EXPERT'
  | 'PRINCIPAL';

export type RateSourceType =
  | 'JOB_POSTING'
  | 'BID'
  | 'CONTRACT'
  | 'SURVEY'
  | 'EXTERNAL'
  | 'SERVICE_ORDER'
  | 'PROFILE_RATE';

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
  | 'COMPETITIVE_ANALYSIS'
  | 'DEMAND_BASED_ADJUSTMENT';

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
  | 'MANUAL'
  | 'MARKET_ADJUSTMENT'
  | 'EXPERIENCE_INCREASE'
  | 'SKILL_ADDITION'
  | 'DEMAND_BASED'
  | 'RECOMMENDATION_FOLLOWED'
  | 'MANUAL_CHANGE';

// Review-related types
export type ReviewStatus =
  | 'PENDING'
  | 'PUBLISHED'
  | 'HIDDEN'
  | 'FLAGGED'
  | 'REMOVED'
  | 'REVEALED';

export type ReviewType =
  | 'CLIENT_TO_FREELANCER'
  | 'FREELANCER_TO_CLIENT'
  | 'PROJECT'
  | 'SERVICE';

export type ReportStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'DISMISSED';

// Payout-related types
export type PayoutAccountStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'CLOSED'
  | 'RESTRICTED'
  | 'ONBOARDING';

export type PayoutStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// Service-related types
export type PackageTier =
  | 'BASIC'
  | 'STANDARD'
  | 'PREMIUM';

export type ServiceMessageType =
  | 'TEXT'
  | 'FILE'
  | 'IMAGE'
  | 'SYSTEM'
  | 'DELIVERY'
  | 'REVISION_REQUEST';

export type ServiceOrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type ServicePaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type ServiceEscrowStatus =
  | 'PENDING'
  | 'FUNDED'
  | 'RELEASED'
  | 'REFUNDED';

export type JobDuration =
  | 'LESS_THAN_1_MONTH'
  | '1_TO_3_MONTHS'
  | '3_TO_6_MONTHS'
  | 'MORE_THAN_6_MONTHS';

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
  FUNDED: 'FUNDED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const TimeEntryStatusV2 = {
  DRAFT: 'DRAFT' as const,
  SUBMITTED: 'SUBMITTED' as const,
  APPROVED: 'APPROVED' as const,
  REJECTED: 'REJECTED' as const,
  PAID: 'PAID' as const,
  INVOICED: 'INVOICED' as const,
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
  PENDING_CLIENT: 'PENDING_CLIENT' as const,
  PENDING_FREELANCER: 'PENDING_FREELANCER' as const,
  PROPOSED: 'PROPOSED' as const,
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
  CONTRACT_CREATED: 'CONTRACT_CREATED' as const,
  CONTRACT_SENT: 'CONTRACT_SENT' as const,
  CONTRACT_SIGNED: 'CONTRACT_SIGNED' as const,
  CONTRACT_ACTIVATED: 'CONTRACT_ACTIVATED' as const,
  CONTRACT_PAUSED: 'CONTRACT_PAUSED' as const,
  CONTRACT_RESUMED: 'CONTRACT_RESUMED' as const,
  CONTRACT_COMPLETED: 'CONTRACT_COMPLETED' as const,
  CONTRACT_TERMINATED: 'CONTRACT_TERMINATED' as const,
  MILESTONE_CREATED: 'MILESTONE_CREATED' as const,
  MILESTONE_SUBMITTED: 'MILESTONE_SUBMITTED' as const,
  MILESTONE_APPROVED: 'MILESTONE_APPROVED' as const,
  MILESTONE_REJECTED: 'MILESTONE_REJECTED' as const,
  MILESTONE_FUNDED: 'MILESTONE_FUNDED' as const,
  MILESTONE_PAID: 'MILESTONE_PAID' as const,
  MILESTONE_CANCELLED: 'MILESTONE_CANCELLED' as const,
  TIME_LOGGED: 'TIME_LOGGED' as const,
  TIME_APPROVED: 'TIME_APPROVED' as const,
  INVOICE_CREATED: 'INVOICE_CREATED' as const,
  INVOICE_SENT: 'INVOICE_SENT' as const,
  INVOICE_PAID: 'INVOICE_PAID' as const,
  AMENDMENT_PROPOSED: 'AMENDMENT_PROPOSED' as const,
  AMENDMENT_APPROVED: 'AMENDMENT_APPROVED' as const,
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
  PARTIAL_REFUND: 'PARTIAL_REFUND' as const,
  FULL_REFUND_TO_CLIENT: 'FULL_REFUND_TO_CLIENT' as const,
  FULL_PAYMENT_TO_FREELANCER: 'FULL_PAYMENT_TO_FREELANCER' as const,
  SPLIT_PAYMENT: 'SPLIT_PAYMENT' as const,
  MUTUAL_CANCELLATION: 'MUTUAL_CANCELLATION' as const,
  NO_ACTION: 'NO_ACTION' as const,
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
  TIME_ENTRY: 'TIME_ENTRY' as const,
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
  FUND: 'FUND' as const,
  RELEASE: 'RELEASE' as const,
  PARTIAL_RELEASE: 'PARTIAL_RELEASE' as const,
  REFUND: 'REFUND' as const,
  DISPUTE_HOLD: 'DISPUTE_HOLD' as const,
  HOLD: 'HOLD' as const,
  UNHOLD: 'UNHOLD' as const,
  FEE: 'FEE' as const,
};

export const EscrowTransactionStatusV2 = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  CAPTURED: 'CAPTURED' as const,
  REQUIRES_CAPTURE: 'REQUIRES_CAPTURE' as const,
  FAILED: 'FAILED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export const ExperienceLevel = {
  ENTRY: 'ENTRY' as const,
  JUNIOR: 'JUNIOR' as const,
  INTERMEDIATE: 'INTERMEDIATE' as const,
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
  SERVICE_ORDER: 'SERVICE_ORDER' as const,
  PROFILE_RATE: 'PROFILE_RATE' as const,
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
  DEMAND_BASED_ADJUSTMENT: 'DEMAND_BASED_ADJUSTMENT' as const,
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
  MARKET_ADJUSTMENT: 'MARKET_ADJUSTMENT' as const,
  EXPERIENCE_INCREASE: 'EXPERIENCE_INCREASE' as const,
  SKILL_ADDITION: 'SKILL_ADDITION' as const,
  DEMAND_BASED: 'DEMAND_BASED' as const,
  RECOMMENDATION_FOLLOWED: 'RECOMMENDATION_FOLLOWED' as const,
  MANUAL_CHANGE: 'MANUAL_CHANGE' as const,
};

export const ReviewStatus = {
  PENDING: 'PENDING' as const,
  PUBLISHED: 'PUBLISHED' as const,
  HIDDEN: 'HIDDEN' as const,
  FLAGGED: 'FLAGGED' as const,
  REMOVED: 'REMOVED' as const,
  REVEALED: 'REVEALED' as const,
};

export const ReviewType = {
  CLIENT_TO_FREELANCER: 'CLIENT_TO_FREELANCER' as const,
  FREELANCER_TO_CLIENT: 'FREELANCER_TO_CLIENT' as const,
  PROJECT: 'PROJECT' as const,
  SERVICE: 'SERVICE' as const,
};

export const ReportStatus = {
  PENDING: 'PENDING' as const,
  UNDER_REVIEW: 'UNDER_REVIEW' as const,
  RESOLVED: 'RESOLVED' as const,
  DISMISSED: 'DISMISSED' as const,
};

export const PayoutAccountStatus = {
  PENDING: 'PENDING' as const,
  ACTIVE: 'ACTIVE' as const,
  INACTIVE: 'INACTIVE' as const,
  SUSPENDED: 'SUSPENDED' as const,
  CLOSED: 'CLOSED' as const,
  RESTRICTED: 'RESTRICTED' as const,
  ONBOARDING: 'ONBOARDING' as const,
};

export const PayoutStatus = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const,
  CANCELLED: 'CANCELLED' as const,
};

// Notification-related types
export type NotificationCategory =
  | 'MESSAGES'
  | 'PROJECTS'
  | 'CONTRACTS'
  | 'PAYMENTS'
  | 'ACCOUNT'
  | 'MARKETING'
  | 'SYSTEM';

export type NotificationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT';

export const NotificationCategory = {
  MESSAGES: 'MESSAGES' as const,
  PROJECTS: 'PROJECTS' as const,
  CONTRACTS: 'CONTRACTS' as const,
  PAYMENTS: 'PAYMENTS' as const,
  ACCOUNT: 'ACCOUNT' as const,
  MARKETING: 'MARKETING' as const,
  SYSTEM: 'SYSTEM' as const,
};

export const NotificationPriority = {
  LOW: 'LOW' as const,
  NORMAL: 'NORMAL' as const,
  HIGH: 'HIGH' as const,
  URGENT: 'URGENT' as const,
};

export const PackageTier = {
  BASIC: 'BASIC' as const,
  STANDARD: 'STANDARD' as const,
  PREMIUM: 'PREMIUM' as const,
};

export const ServiceMessageType = {
  TEXT: 'TEXT' as const,
  FILE: 'FILE' as const,
  IMAGE: 'IMAGE' as const,
  SYSTEM: 'SYSTEM' as const,
  DELIVERY: 'DELIVERY' as const,
  REVISION_REQUEST: 'REVISION_REQUEST' as const,
};

export const ServiceOrderStatus = {
  PENDING: 'PENDING' as const,
  ACCEPTED: 'ACCEPTED' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  DELIVERED: 'DELIVERED' as const,
  COMPLETED: 'COMPLETED' as const,
  CANCELLED: 'CANCELLED' as const,
  DISPUTED: 'DISPUTED' as const,
};

export const ServicePaymentStatus = {
  PENDING: 'PENDING' as const,
  PAID: 'PAID' as const,
  REFUNDED: 'REFUNDED' as const,
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED' as const,
};

export const ServiceEscrowStatus = {
  PENDING: 'PENDING' as const,
  FUNDED: 'FUNDED' as const,
  RELEASED: 'RELEASED' as const,
  REFUNDED: 'REFUNDED' as const,
};

export const JobDuration = {
  LESS_THAN_1_MONTH: 'LESS_THAN_1_MONTH' as const,
  '1_TO_3_MONTHS': '1_TO_3_MONTHS' as const,
  '3_TO_6_MONTHS': '3_TO_6_MONTHS' as const,
  MORE_THAN_6_MONTHS: 'MORE_THAN_6_MONTHS' as const,
};

// =============================================================================
// MODEL INTERFACES
// =============================================================================

export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  [key: string]: any;
}

export interface Tenant {
  id: string;
  name: string;
  [key: string]: any;
}

export interface Job {
  id: string;
  title: string;
  [key: string]: any;
}

export interface ContractSignature {
  id: string;
  contractId: string;
  userId: string;
  signatureType: SignatureType;
  signedAt: Date;
  [key: string]: any;
}

export interface ContractInvoice {
  id: string;
  contractId: string;
  invoiceNumber: string;
  status: ContractInvoiceStatus;
  amount: number;
  [key: string]: any;
}

export interface ContractDispute {
  id: string;
  contractId: string;
  status: ContractDisputeStatus;
  reason: ContractDisputeReason;
  [key: string]: any;
}

export interface ContractDisputeMessage {
  id: string;
  disputeId: string;
  userId: string;
  message: string;
  createdAt: Date;
  [key: string]: any;
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
  [key: string]: any;
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
  [key: string]: any;
}

// Review Models
export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  contractId?: string | null;
  serviceId?: string | null;
  type: ReviewType;
  status: ReviewStatus;
  rating: number;
  title?: string | null;
  content?: string | null;
  privateContent?: string | null;
  response?: string | null;
  respondedAt?: Date | null;
  skillRatings?: Record<string, number> | null;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface ReviewReport {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: string;
  description?: string | null;
  status: ReportStatus;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  resolution?: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface ReviewInvitation {
  id: string;
  reviewerId: string;
  revieweeId: string;
  contractId?: string | null;
  serviceId?: string | null;
  type: ReviewType;
  token: string;
  expiresAt: Date;
  sentAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  body: string;
  iconUrl?: string | null;
  imageUrl?: string | null;
  actionUrl?: string | null;
  actionLabel?: string | null;
  data?: Record<string, unknown> | null;
  groupKey?: string | null;
  groupCount: number;
  channels: string[];
  isRead: boolean;
  readAt?: Date | null;
  isDismissed: boolean;
  dismissedAt?: Date | null;
  deliveryStatus?: Record<string, string> | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

// Contract Models
export interface ContractV2 {
  id: string;
  tenantId: string;
  clientId: string;
  freelancerId: string;
  jobId?: string | null;
  serviceId?: string | null;
  bidId?: string | null;
  sourceType: ContractSourceType;
  contractType: ContractTypeV2;
  rateType: RateTypeV2;
  status: ContractStatusV2;
  title: string;
  description?: string | null;
  hourlyRate?: number | null;
  fixedPrice?: number | null;
  weeklyHourLimit?: number | null;
  estimatedDuration?: number | null;
  startDate?: Date | null;
  endDate?: Date | null;
  actualEndDate?: Date | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface ContractMilestoneV2 {
  id: string;
  contractId: string;
  title: string;
  description?: string | null;
  amount: number;
  status: MilestoneStatusV2;
  dueDate?: Date | null;
  submittedAt?: Date | null;
  approvedAt?: Date | null;
  paidAt?: Date | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface TimeEntryV2 {
  id: string;
  contractId: string;
  userId: string;
  description?: string | null;
  startTime: Date;
  endTime?: Date | null;
  duration: number;
  status: TimeEntryStatusV2;
  hourlyRate: number;
  amount: number;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface ContractAmendment {
  id: string;
  contractId: string;
  proposedBy: string;
  status: AmendmentStatus;
  changes: Record<string, unknown>;
  reason?: string | null;
  clientApprovedAt?: Date | null;
  freelancerApprovedAt?: Date | null;
  rejectedAt?: Date | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface ContractActivity {
  id: string;
  contractId: string;
  userId?: string | null;
  activityType: ContractActivityType;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  [key: string]: any;
}

// Freelancer Rate History
export interface FreelancerRateHistory {
  id: string;
  userId: string;
  primarySkill: string;
  previousRate?: number | null;
  newRate: number;
  rateType: RateType;
  changeReason: RateChangeReason;
  notes?: string | null;
  effectiveDate: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

// Rate Intelligence Models
export interface RateAggregate {
  id: string;
  primarySkill: string;
  skillCategory: string;
  experienceLevel: ExperienceLevel;
  country?: string | null;
  region?: string | null;
  rateType: RateType;
  minRate: number;
  maxRate: number;
  avgRate: number;
  medianRate: number;
  p25Rate: number;
  p75Rate: number;
  sampleSize: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface SkillDemandTrend {
  id: string;
  skill: string;
  skillCategory: string;
  period: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  demandLevel: DemandLevel;
  jobCount: number;
  bidCount: number;
  contractCount: number;
  avgResponseTime?: number | null;
  competitionLevel?: number | null;
  growthRate?: number | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
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

  // Decimal class stub with arithmetic methods
  export class Decimal {
    d: number[];
    e: number;
    s: number;
    private _value: number;

    constructor(value: string | number | Decimal) {
      if (typeof value === 'number') {
        this._value = value;
        this.d = [Math.abs(value)];
        this.e = 0;
        this.s = value < 0 ? -1 : 1;
      } else if (typeof value === 'string') {
        const num = parseFloat(value);
        this._value = num;
        this.d = [Math.abs(num)];
        this.e = 0;
        this.s = num < 0 ? -1 : 1;
      } else {
        this._value = value.toNumber();
        this.d = value.d;
        this.e = value.e;
        this.s = value.s;
      }
    }

    toNumber(): number {
      return this._value;
    }

    toString(): string {
      return this._value.toString();
    }

    add(other: Decimal | number | string): Decimal {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return new Decimal(this._value + otherVal);
    }

    sub(other: Decimal | number | string): Decimal {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return new Decimal(this._value - otherVal);
    }

    mul(other: Decimal | number | string): Decimal {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return new Decimal(this._value * otherVal);
    }

    div(other: Decimal | number | string): Decimal {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return new Decimal(this._value / otherVal);
    }

    equals(other: Decimal | number | string): boolean {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return this._value === otherVal;
    }

    gt(other: Decimal | number | string): boolean {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return this._value > otherVal;
    }

    gte(other: Decimal | number | string): boolean {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return this._value >= otherVal;
    }

    lt(other: Decimal | number | string): boolean {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return this._value < otherVal;
    }

    lte(other: Decimal | number | string): boolean {
      const otherVal = other instanceof Decimal ? other.toNumber() : parseFloat(String(other));
      return this._value <= otherVal;
    }

    static isDecimal(value: unknown): value is Decimal {
      return value instanceof Decimal;
    }
  }

  // Generic input types for Prisma operations
  // These are placeholder types that accept any structure
  // Using 'any' for flexibility in offline builds
  export type WhereInput = Record<string, any>;
  export type UpdateInput = Record<string, any>;
  export type CreateInput = Record<string, any>;
  export type OrderByInput = Record<string, any>;
  export type UncheckedCreateInput = Record<string, any>;

  // Specific model input types (all aliased to generic)
  export type BidWhereInput = WhereInput;
  export type BidUpdateInput = UpdateInput;
  export type BidOrderByWithRelationInput = OrderByInput;
  export type FreelancerComplianceWhereInput = WhereInput;
  export type SecurityClearanceWhereInput = WhereInput;
  export type FreelancerComplianceAttestationWhereInput = WhereInput;
  export type ComplianceVerificationLogWhereInput = WhereInput;
  export type UserWhereInput = WhereInput;
  export type ContractActivityWhereInput = WhereInput;
  export type ContractAmendmentWhereInput = WhereInput;
  export type ContractDisputeWhereInput = WhereInput;
  export type ContractInvoiceWhereInput = WhereInput;
  export type ContractInvoiceUncheckedCreateInput = UncheckedCreateInput;
  export type ContractMilestoneV2WhereInput = WhereInput;
  export type ContractMilestoneV2UpdateInput = UpdateInput;
  export type ContractTemplateWhereInput = WhereInput;
  export type ContractTemplateUpdateInput = UpdateInput;
  export type ContractV2WhereInput = WhereInput;
  export type ContractV2UpdateInput = UpdateInput;
  export type ContractV2OrderByWithRelationInput = OrderByInput;
  export type EscrowAccountV2UpdateInput = UpdateInput;
  export type ProjectInvitationWhereInput = WhereInput;
  export type ProjectInvitationUpdateInput = UpdateInput;
  export type NotificationWhereInput = WhereInput;
  export type NotificationUpdateInput = UpdateInput;
  export type NotificationCreateInput = CreateInput;
  export type JobWhereInput = WhereInput;
  export type TimeEntryV2WhereInput = WhereInput;
  export type TimeEntryV2UpdateInput = UpdateInput;
  export type ReviewWhereInput = WhereInput;
  export type ReviewUpdateInput = UpdateInput;
  export type ServiceOrderWhereInput = WhereInput;
  export type ServiceOrderUpdateInput = UpdateInput;
  export type RateDataPointWhereInput = WhereInput;
  export type RateDataPointOrderByWithRelationInput = OrderByInput;
  export type RateAggregateWhereInput = WhereInput;
  export type RateAggregateCreateInput = CreateInput;
  export type RateAggregateUpdateInput = UpdateInput;
  export type MessageWhereInput = WhereInput;
  export type ConversationWhereInput = WhereInput;
  export type JobOrderByWithRelationInput = OrderByInput;
  export type JobUpdateInput = UpdateInput;
  export type ProjectQuestionWhereInput = WhereInput;
  export type ServiceWhereInput = WhereInput;
  export type ServiceUpdateInput = UpdateInput;
  export type ServiceOrderByWithRelationInput = OrderByInput;
  export type ServiceReviewWhereInput = WhereInput;
  export type ServiceReviewOrderByWithRelationInput = OrderByInput;
  export type MatchingEventWhereInput = WhereInput;
  export type ServicePackageWhereInput = WhereInput;
  export type ServiceAddOnWhereInput = WhereInput;
  export type ServiceDeliveryWhereInput = WhereInput;
  export type ServiceRevisionRequestWhereInput = WhereInput;
  export type ServiceOrderMessageWhereInput = WhereInput;
  export type PayoutWhereInput = WhereInput;
  export type RateAggregateWhereUniqueInput = WhereInput;
  export type UserRatingAggregationUpdateInput = UpdateInput;
  export type FreelancerRateHistoryWhereInput = WhereInput;
  export type FreelancerRateHistoryCreateInput = CreateInput;
}

// Type alias for PrismaClient when used as a type (alias for compatibility)
export type PrismaClientType = PrismaClient;

// =============================================================================
// CONVERSATION & MESSAGING TYPES
// =============================================================================

export type ParticipantRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MEMBER'
  | 'GUEST';

export const ParticipantRole = {
  OWNER: 'OWNER' as const,
  ADMIN: 'ADMIN' as const,
  MEMBER: 'MEMBER' as const,
  GUEST: 'GUEST' as const,
};

export type ConversationContentType =
  | 'TEXT'
  | 'HTML'
  | 'MARKDOWN'
  | 'RICH';

export const ConversationContentType = {
  TEXT: 'TEXT' as const,
  HTML: 'HTML' as const,
  MARKDOWN: 'MARKDOWN' as const,
  RICH: 'RICH' as const,
};

export type ConversationMessageType =
  | 'USER'
  | 'SYSTEM'
  | 'BOT';

export const ConversationMessageType = {
  USER: 'USER' as const,
  SYSTEM: 'SYSTEM' as const,
  BOT: 'BOT' as const,
};

export type SystemMessageEventType =
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'PARTICIPANT_REMOVED'
  | 'TITLE_CHANGED'
  | 'SETTINGS_CHANGED'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_SIGNED'
  | 'MILESTONE_COMPLETED'
  | 'PAYMENT_SENT'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED';

export const SystemMessageEventType = {
  PARTICIPANT_JOINED: 'PARTICIPANT_JOINED' as const,
  PARTICIPANT_LEFT: 'PARTICIPANT_LEFT' as const,
  PARTICIPANT_REMOVED: 'PARTICIPANT_REMOVED' as const,
  TITLE_CHANGED: 'TITLE_CHANGED' as const,
  SETTINGS_CHANGED: 'SETTINGS_CHANGED' as const,
  CONTRACT_CREATED: 'CONTRACT_CREATED' as const,
  CONTRACT_SIGNED: 'CONTRACT_SIGNED' as const,
  MILESTONE_COMPLETED: 'MILESTONE_COMPLETED' as const,
  PAYMENT_SENT: 'PAYMENT_SENT' as const,
  DISPUTE_OPENED: 'DISPUTE_OPENED' as const,
  DISPUTE_RESOLVED: 'DISPUTE_RESOLVED' as const,
};

export interface Conversation {
  id: string;
  type: string;
  title?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  contractId?: string | null;
  jobId?: string | null;
  bidId?: string | null;
  serviceOrderId?: string | null;
  disputeId?: string | null;
  lastMessageId?: string | null;
  lastMessageAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  role: ParticipantRole;
  canSendMessages: boolean;
  canAddParticipants: boolean;
  canRemoveParticipants: boolean;
  canEditSettings: boolean;
  lastReadMessageId?: string | null;
  lastReadAt?: Date | null;
  joinedAt: Date;
  leftAt?: Date | null;
  notificationsEnabled: boolean;
  isPinned: boolean;
  pinnedAt?: Date | null;
  isArchivedByUser: boolean;
  isActive: boolean;
  removedAt?: Date | null;
  removedBy?: string | null;
  unreadCount: number;
  mutedUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  content?: string | null;
  contentType: ConversationContentType;
  richContent?: Record<string, unknown> | null;
  attachments?: Record<string, unknown>[] | null;
  parentMessageId?: string | null;
  threadCount: number;
  mentions: string[];
  messageType: ConversationMessageType;
  systemEventType?: SystemMessageEventType | null;
  systemEventData?: Record<string, unknown> | null;
  isEdited: boolean;
  editedAt?: Date | null;
  isDeleted: boolean;
  deletedAt?: Date | null;
  isPinned: boolean;
  pinnedAt?: Date | null;
  pinnedBy?: string | null;
  deliveredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface ConversationMessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
  [key: string]: any;
}

export interface ConversationMessageReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
  [key: string]: any;
}

// =============================================================================
// NOTIFICATION TYPES
// =============================================================================

export type UnsubscribeType =
  | 'ALL'
  | 'CATEGORY'
  | 'TYPE';

export const UnsubscribeType = {
  ALL: 'ALL' as const,
  CATEGORY: 'CATEGORY' as const,
  TYPE: 'TYPE' as const,
};

export type DigestType =
  | 'HOURLY'
  | 'DAILY'
  | 'WEEKLY';

export const DigestType = {
  HOURLY: 'HOURLY' as const,
  DAILY: 'DAILY' as const,
  WEEKLY: 'WEEKLY' as const,
};

export type DigestStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED';

export const DigestStatus = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  SENT: 'SENT' as const,
  FAILED: 'FAILED' as const,
};

export type EmailFrequency =
  | 'INSTANT'
  | 'HOURLY'
  | 'DAILY'
  | 'WEEKLY'
  | 'NEVER';

export const EmailFrequency = {
  INSTANT: 'INSTANT' as const,
  HOURLY: 'HOURLY' as const,
  DAILY: 'DAILY' as const,
  WEEKLY: 'WEEKLY' as const,
  NEVER: 'NEVER' as const,
};

export interface EmailUnsubscribe {
  id: string;
  email: string;
  userId?: string | null;
  unsubscribeType: UnsubscribeType;
  category?: NotificationCategory | null;
  notificationType?: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface NotificationDigest {
  id: string;
  userId: string;
  digestType: DigestType;
  periodStart: Date;
  periodEnd: Date;
  notificationIds: string[];
  summary: Record<string, unknown>;
  status: DigestStatus;
  scheduledFor: Date;
  sentAt?: Date | null;
  emailId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  notificationType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailFrequency: EmailFrequency;
  quietHoursEnabled: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  quietHoursTimezone?: string | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

export interface NotificationTemplate {
  id: string;
  type: string;
  name: string;
  description?: string | null;
  category: NotificationCategory;
  inAppTitle: string;
  inAppBody: string;
  emailSubject?: string | null;
  emailHtmlTemplate?: string | null;
  emailTextTemplate?: string | null;
  pushTitle?: string | null;
  pushBody?: string | null;
  smsTemplate?: string | null;
  defaultPriority: NotificationPriority;
  defaultChannels: string[];
  isGroupable: boolean;
  groupKeyTemplate?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}
