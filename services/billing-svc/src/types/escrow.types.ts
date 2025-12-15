/**
 * @module @skillancer/billing-svc/types/escrow
 * Type definitions for the escrow system
 */

// Decimal type from Prisma (using number for compatibility)
type Decimal = number | { toNumber(): number };

// =============================================================================
// ENUMS (Mirror Prisma enums for use in TypeScript)
// =============================================================================

export type EscrowTransactionType =
  | 'FUND'
  | 'RELEASE'
  | 'REFUND'
  | 'PARTIAL_RELEASE'
  | 'PARTIAL_REFUND'
  | 'FEE_DEDUCTION';

export type EscrowTransactionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'REQUIRES_CAPTURE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type EscrowBalanceStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export type MilestoneStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'RELEASED'
  | 'PAID'
  | 'DISPUTED'
  | 'CANCELLED';

export type ContractStatus =
  | 'PENDING'
  | 'PENDING_FUNDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type TimeLogStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BILLED' | 'DISPUTED';

export type DisputeReason =
  | 'QUALITY_ISSUES'
  | 'MISSED_DEADLINE'
  | 'SCOPE_DISAGREEMENT'
  | 'COMMUNICATION_ISSUES'
  | 'NON_DELIVERY'
  | 'PAYMENT_ISSUE'
  | 'WORK_NOT_AS_DESCRIBED'
  | 'OTHER';

export type DisputeStatus =
  | 'OPEN'
  | 'RESPONDED'
  | 'UNDER_REVIEW'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED';

export type DisputeResolution =
  | 'FULL_REFUND'
  | 'PARTIAL_REFUND'
  | 'FULL_RELEASE'
  | 'PARTIAL_RELEASE'
  | 'SPLIT'
  | 'CANCELLED';

export type DisputeRole = 'CLIENT' | 'FREELANCER' | 'MEDIATOR' | 'SYSTEM';

// =============================================================================
// FEE CALCULATION
// =============================================================================

export interface FeeCalculation {
  grossAmount: number;
  platformFee: number;
  platformFeePercent: number;
  secureModeAmount: number;
  processingFee: number;
  netAmount: number;
  totalCharge: number;
}

export interface FeeBreakdownItem {
  label: string;
  amount: number;
  description?: string;
}

export interface FeePreview extends FeeCalculation {
  breakdown: FeeBreakdownItem[];
}

export interface DisputeSplitCalculation {
  clientRefund: number;
  freelancerPayout: number;
  platformFee: number;
}

export interface HourlyBillingCalculation {
  grossAmount: number;
  platformFee: number;
  netAmount: number;
}

// =============================================================================
// ESCROW SERVICE
// =============================================================================

export interface FundEscrowParams {
  contractId: string;
  milestoneId?: string;
  amount: number;
  paymentMethodId: string;
  clientUserId: string;
}

export interface ReleaseEscrowParams {
  contractId: string;
  milestoneId?: string;
  amount?: number;
  clientUserId: string;
}

export interface RefundEscrowParams {
  contractId: string;
  milestoneId?: string;
  amount?: number;
  reason: string;
  initiatedBy: string;
}

export interface FreezeEscrowParams {
  contractId: string;
  disputeId: string;
  amount?: number;
}

export interface UnfreezeEscrowParams {
  contractId: string;
  amount?: number;
}

export interface EscrowSummary {
  contract: {
    id: string;
    title: string;
    totalAmount: number;
    currency: string;
    status: ContractStatus;
  };
  balance: {
    totalFunded: number;
    totalReleased: number;
    totalRefunded: number;
    currentBalance: number;
    frozenAmount: number;
    availableBalance: number;
  };
  milestones: Array<{
    id: string;
    title: string;
    amount: number;
    status: MilestoneStatus;
    escrowFunded: boolean;
  }>;
  recentTransactions: EscrowTransactionSummary[];
}

export interface EscrowTransactionSummary {
  id: string;
  type: EscrowTransactionType;
  status: EscrowTransactionStatus;
  grossAmount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  currency: string;
  description?: string;
  createdAt: Date;
  processedAt?: Date;
}

// =============================================================================
// MILESTONE SERVICE
// =============================================================================

export interface CreateMilestoneParams {
  contractId: string;
  title: string;
  description?: string;
  amount: number;
  dueDate?: Date;
  sortOrder?: number;
  maxRevisions?: number;
}

export interface UpdateMilestoneParams {
  title?: string;
  description?: string;
  amount?: number;
  dueDate?: Date;
  maxRevisions?: number;
}

export interface SubmitMilestoneParams {
  milestoneId: string;
  freelancerUserId: string;
  deliverables: string;
  deliverableUrls?: string[];
}

export interface ApproveMilestoneParams {
  milestoneId: string;
  clientUserId: string;
}

export interface RequestRevisionParams {
  milestoneId: string;
  clientUserId: string;
  feedback: string;
}

export interface MilestoneWithContract {
  id: string;
  contractId: string;
  title: string;
  description: string | null;
  amount: Decimal;
  status: MilestoneStatus;
  sortOrder: number;
  deliverables: string | null;
  deliverableUrls: string[];
  escrowFunded: boolean;
  escrowFundedAt: Date | null;
  escrowReleasedAt: Date | null;
  revisionCount: number;
  maxRevisions: number;
  dueDate: Date | null;
  startedAt: Date | null;
  submittedAt: Date | null;
  completedAt: Date | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contract: {
    id: string;
    clientId: string;
    freelancerId: string;
    title: string;
    status: ContractStatus;
    platformFeePercent: Decimal;
    secureModeFeePercent: Decimal | null;
    secureMode: boolean;
    currency: string;
  };
}

// =============================================================================
// TIME LOG SERVICE
// =============================================================================

export interface CreateTimeLogParams {
  contractId: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  hourlyRate: number;
  skillpodSessionId?: string;
  isVerified?: boolean;
}

export interface ApproveTimeLogParams {
  timeLogId: string;
  clientUserId: string;
}

export interface RejectTimeLogParams {
  timeLogId: string;
  clientUserId: string;
  reason: string;
}

export interface TimeLogSummary {
  contractId: string;
  totalHours: number;
  totalAmount: number;
  pendingHours: number;
  pendingAmount: number;
  approvedHours: number;
  approvedAmount: number;
  billedHours: number;
  billedAmount: number;
  logs: TimeLogEntry[];
}

export interface TimeLogEntry {
  id: string;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  duration: number | null;
  hourlyRate: number;
  amount: number | null;
  status: TimeLogStatus;
  isVerified: boolean;
  createdAt: Date;
}

// =============================================================================
// DISPUTE SERVICE
// =============================================================================

export interface CreateDisputeParams {
  contractId: string;
  milestoneId?: string;
  raisedBy: string;
  reason: DisputeReason;
  description: string;
  evidenceUrls?: string[];
  disputedAmount: number;
}

export interface RespondToDisputeParams {
  disputeId: string;
  responderId: string;
  message: string;
  attachmentUrls?: string[];
  proposedResolution?: {
    type: DisputeResolution;
    clientAmount?: number;
    freelancerAmount?: number;
  };
}

export interface ResolveDisputeParams {
  disputeId: string;
  resolution: DisputeResolution;
  clientRefundAmount?: number;
  freelancerPayoutAmount?: number;
  resolvedBy: string;
  resolutionNotes: string;
}

export interface EscalateDisputeParams {
  disputeId: string;
  userId: string;
  reason: string;
}

export interface AcceptResolutionParams {
  disputeId: string;
  userId: string;
  messageId: string;
}

export interface DisputeWithMessages {
  id: string;
  contractId: string;
  milestoneId: string | null;
  raisedBy: string;
  reason: DisputeReason;
  description: string;
  evidenceUrls: string[];
  disputedAmount: Decimal;
  currency: string;
  status: DisputeStatus;
  resolvedBy: string | null;
  resolution: DisputeResolution | null;
  resolutionNotes: string | null;
  clientRefundAmount: Decimal | null;
  freelancerPayoutAmount: Decimal | null;
  respondBy: Date | null;
  respondedAt: Date | null;
  escalatedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    senderId: string;
    senderRole: DisputeRole;
    message: string;
    attachmentUrls: string[];
    proposedResolution: DisputeResolution | null;
    proposedClientAmount: Decimal | null;
    proposedFreelancerAmount: Decimal | null;
    createdAt: Date;
  }>;
  contract: {
    id: string;
    clientId: string;
    freelancerId: string;
    title: string;
  };
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface FundEscrowRequest {
  contractId: string;
  milestoneId?: string;
  amount: number;
  paymentMethodId: string;
}

export interface FundEscrowResponse {
  transaction: EscrowTransactionSummary;
  escrowBalance: {
    currentBalance: number;
    availableBalance: number;
  };
  clientSecret?: string;
}

export interface ReleaseEscrowRequest {
  contractId: string;
  milestoneId?: string;
  amount?: number;
}

export interface ReleaseEscrowResponse {
  transaction: EscrowTransactionSummary;
  escrowBalance: {
    currentBalance: number;
    totalReleased: number;
  };
}

export interface PreviewFeesRequest {
  amount: number;
  contractId: string;
}

export interface SubmitMilestoneRequest {
  deliverables: string;
  deliverableUrls?: string[];
}

export interface RequestRevisionRequest {
  feedback: string;
}

export interface CreateDisputeRequest {
  contractId: string;
  milestoneId?: string;
  reason: DisputeReason;
  description: string;
  evidenceUrls?: string[];
  disputedAmount: number;
}

export interface RespondToDisputeRequest {
  message: string;
  attachmentUrls?: string[];
  proposedResolution?: {
    type: DisputeResolution;
    clientAmount?: number;
    freelancerAmount?: number;
  };
}

export interface ResolveDisputeRequest {
  resolution: DisputeResolution;
  clientRefundAmount?: number;
  freelancerPayoutAmount?: number;
  resolutionNotes: string;
}

export interface EscalateDisputeRequest {
  reason: string;
}

export interface AcceptResolutionRequest {
  messageId: string;
}

// =============================================================================
// WEBHOOK EVENT DATA
// =============================================================================

export interface EscrowPaymentIntentMetadata {
  contract_id: string;
  milestone_id?: string;
  type: 'escrow_fund' | 'escrow_release';
}

export interface EscrowTransferMetadata {
  contract_id: string;
  milestone_id?: string;
  type: 'escrow_release' | 'dispute_resolution';
}
