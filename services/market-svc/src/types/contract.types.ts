/* eslint-disable @typescript-eslint/consistent-type-imports */
/**
 * @module @skillancer/market-svc/types/contract
 * Contract Management System types - Aligned with existing repository interfaces
 */

import type {
  ContractSignature,
  ContractInvoice,
  ContractDispute,
  ContractDisputeMessage,
  ContractTemplate,
  User,
  Tenant,
  Job,
  ContractSourceType,
  ContractTypeV2,
  RateTypeV2,
  ContractStatusV2,
  MilestoneStatusV2,
  TimeEntryStatusV2,
  EvidenceType,
  AmendmentStatus,
  TerminationType,
  ContractActivityType,
  SignatureType,
  ContractInvoiceStatus,
  ContractDisputeReason,
  ContractDisputeStatus,
  ContractDisputeResolution,
  Prisma,
} from './prisma-shim.js';

// Import actual Prisma models from database (may not be available in offline builds)
import type {
  ContractV2,
  ContractMilestoneV2,
  TimeEntryV2,
  ContractAmendment,
  ContractActivity,
} from '@skillancer/database';

// Re-export enums for convenience
export {
  ContractSourceType,
  ContractTypeV2,
  RateTypeV2,
  ContractStatusV2,
  MilestoneStatusV2,
  TimeEntryStatusV2,
  EvidenceType,
  AmendmentStatus,
  TerminationType,
  ContractActivityType,
  SignatureType,
  ContractInvoiceStatus,
  ContractDisputeReason,
  ContractDisputeStatus,
  ContractDisputeResolution,
} from './prisma-shim.js';

// =============================================
// Common User Type Aliases
// =============================================

/** User info with full profile for contracts */
type UserContractInfo = Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'>;

/** User info with basic profile */
type UserBasicInfo = Pick<User, 'id' | 'displayName' | 'avatarUrl'>;

/** User info with email for notifications */
type UserWithEmail = Pick<User, 'id' | 'email' | 'displayName'>;

/** User info with just name */
type UserMinimalInfo = Pick<User, 'id' | 'displayName'>;

// =============================================
// Contract Types (for contract.repository.ts)
// =============================================

/** Contract with all related entities */
export interface ContractWithDetails extends ContractV2 {
  client: UserContractInfo;
  freelancer: UserContractInfo;
  tenant: Pick<Tenant, 'id' | 'name' | 'slug'> | null;
  job: Pick<Job, 'id' | 'title' | 'status'> | null;
  milestones: ContractMilestoneV2[];
  _count: {
    timeEntries: number;
    amendments: number;
    activities: number;
    invoices: number;
    disputes: number;
  };
}

/** Contract summary for dashboard lists */
export interface ContractSummary {
  id: string;
  title: string;
  contractNumber: string;
  status: ContractStatusV2;
  contractType: import('./prisma-shim.js').ContractTypeV2;
  rateType: import('./prisma-shim.js').RateTypeV2;
  totalBilled: number;
  totalPaid: number;
  totalInEscrow: number;
  startDate: Date;
  endDate: Date | null;
  client: { id: string; displayName: string | null; avatarUrl: string | null };
  freelancer: { id: string; displayName: string | null; avatarUrl: string | null };
  progressPercent: number;
  daysRemaining: number | null;
  hasActiveDispute: boolean;
  pendingAmendments: number;
}

/** Milestone input for contract creation */
export interface ContractMilestoneInput {
  title: string;
  description?: string;
  amount: number;
  dueDate?: Date;
  orderIndex?: number;
  deliverables?: Array<{ title: string; description?: string; required?: boolean }>;
}

/** Input for creating a contract */
export interface CreateContractInput {
  tenantId?: string | null;
  clientUserId: string;
  freelancerUserId: string;
  projectId?: string | null;
  bidId?: string | null;
  serviceOrderId?: string | null;
  sourceType: ContractSourceType;
  contractType: import('./prisma-shim.js').ContractTypeV2;
  rateType: import('./prisma-shim.js').RateTypeV2;
  title: string;
  description?: string;
  scope: string;
  hourlyRate?: number;
  weeklyHoursMin?: number;
  weeklyHoursMax?: number;
  fixedAmount?: number;
  retainerAmount?: number;
  currency?: string;
  startDate: Date;
  endDate?: Date;
  estimatedDurationDays?: number;
  paymentTermsDays?: number;
  noticePeriodDays?: number;
  includesNda?: boolean;
  includesIpAssignment?: boolean;
  includesNonCompete?: boolean;
  customTerms?: string;
  complianceRequirements?: string[];
  skillpodRequired?: boolean;
  skillpodPodId?: string;
  milestones?: ContractMilestoneInput[];
}

/** Input for updating a contract */
export interface UpdateContractInput {
  title?: string;
  description?: string;
  scope?: string;
  hourlyRate?: number;
  weeklyHoursMin?: number;
  weeklyHoursMax?: number;
  fixedAmount?: number;
  retainerAmount?: number;
  startDate?: Date;
  endDate?: Date;
  paymentTermsDays?: number;
  noticePeriodDays?: number;
  includesNda?: boolean;
  includesIpAssignment?: boolean;
  includesNonCompete?: boolean;
  customTerms?: string;
  complianceRequirements?: string[];
  documentUrl?: string;
}

/** Options for listing contracts */
export interface ContractListOptions {
  tenantId?: string;
  clientId?: string;
  freelancerId?: string;
  userId?: string;
  jobId?: string;
  status?:
    | ContractStatusV2
    | ContractStatusV2[];
  contractType?:
    | import('./prisma-shim.js').ContractTypeV2
    | import('./prisma-shim.js').ContractTypeV2[];
  rateType?:
    | import('./prisma-shim.js').RateTypeV2
    | import('./prisma-shim.js').RateTypeV2[];
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  hasActiveDispute?: boolean;
  hasPendingAmendments?: boolean;
  search?: string;
  sortBy?: 'createdAt' | 'startDate' | 'endDate' | 'totalContractValue' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// =============================================
// Milestone Types (for contract-milestone.repository.ts)
// =============================================

/** Milestone with contract info */
export interface MilestoneWithDetails extends ContractMilestoneV2 {
  contract: {
    id: string;
    title: string;
    contractNumber: string;
    clientId: string;
    freelancerId: string;
  };
}

/** Input for creating a milestone */
export interface CreateContractMilestoneInput {
  title: string;
  description?: string;
  amount: number;
  dueDate?: Date;
  orderIndex?: number;
  deliverables?: Array<{ title: string; description?: string; required?: boolean }>;
}

/** Input for updating a milestone */
export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  amount?: number;
  dueDate?: Date;
  orderIndex?: number;
  deliverables?: Array<{ title: string; description?: string; required?: boolean }>;
}

/** Options for listing milestones */
export interface MilestoneListOptions {
  contractId?: string;
  status?:
    | MilestoneStatusV2
    | MilestoneStatusV2[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
  page?: number;
  limit?: number;
}

/** Deliverable submission */
export interface DeliverableSubmission {
  title: string;
  url?: string;
  notes?: string;
  submittedAt?: Date;
}

// =============================================
// Time Entry Types (for time-entry.repository.ts)
// =============================================

/** Time entry with related info */
export interface TimeEntryWithDetails extends TimeEntryV2 {
  contract: {
    id: string;
    title: string;
    contractNumber: string;
    clientUserId: string;
    hourlyRate: Prisma.Decimal | null;
  };
  freelancer: UserBasicInfo;
}

/** Input for creating a time entry */
export interface CreateTimeEntryInput {
  contractId: string;
  freelancerUserId: string;
  date: Date;
  startTime?: Date;
  endTime?: Date;
  durationMinutes: number;
  description: string;
  taskCategory?: string;
  hourlyRate: number;
  currency?: string;
  evidenceType?: EvidenceType;
  evidence?: TimeEntryEvidence[];
  skillpodSessionId?: string;
  autoTracked?: boolean;
}

/** Time entry evidence */
export interface TimeEntryEvidence {
  type: 'screenshot' | 'recording' | 'file';
  url: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

/** Input for updating a time entry */
export interface UpdateTimeEntryInput {
  date?: Date;
  startTime?: Date;
  endTime?: Date;
  durationMinutes?: number;
  description?: string;
  taskCategory?: string;
  evidence?: TimeEntryEvidence[];
}

/** Options for listing time entries */
export interface TimeEntryListOptions {
  contractId?: string;
  freelancerId?: string;
  status?:
    | TimeEntryStatusV2
    | TimeEntryStatusV2[];
  dateFrom?: Date;
  dateTo?: Date;
  invoiced?: boolean;
  page?: number;
  limit?: number;
}

/** Time entry summary */
export interface TimeEntrySummary {
  totalMinutes: number;
  totalAmount: number;
  entriesCount: number;
  approvedMinutes: number;
  pendingMinutes: number;
}

// =============================================
// Activity Types (for contract-activity.repository.ts)
// =============================================

/** Activity with actor info */
export interface ActivityWithDetails extends ContractActivity {
  actor: UserBasicInfo | null;
}

/** Input for logging an activity */
export interface LogActivityInput {
  contractId: string;
  actorUserId?: string | null;
  actorType?: 'CLIENT' | 'FREELANCER' | 'SYSTEM' | 'ADMIN';
  activityType: ContractActivityType;
  description: string;
  milestoneId?: string | null;
  timeEntryId?: string | null;
  invoiceId?: string | null;
  amendmentId?: string | null;
  disputeId?: string | null;
  metadata?: Record<string, unknown> | null;
  visibleToClient?: boolean;
  visibleToFreelancer?: boolean;
}

/** Options for listing activities */
export interface ActivityListOptions {
  contractId: string;
  activityType?:
    | ContractActivityType
    | ContractActivityType[];
  actorUserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  visibleToClient?: boolean;
  visibleToFreelancer?: boolean;
  page?: number;
  limit?: number;
}

// =============================================
// Amendment Types (for contract-amendment.repository.ts)
// =============================================

/** Amendment with related info */
export interface AmendmentWithDetails extends ContractAmendment {
  contract: {
    id: string;
    title: string;
    contractNumber: string;
    clientId: string;
    freelancerId: string;
  };
  proposer: UserMinimalInfo;
}

/** Input for creating an amendment */
export interface CreateAmendmentInput {
  contractId: string;
  proposedById: string;
  title: string;
  description: string;
  reason: string;
  changes: AmendmentChange[];
  documentUrl?: string;
}

/** Amendment change record */
export interface AmendmentChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Options for listing amendments */
export interface AmendmentListOptions {
  contractId?: string;
  proposedById?: string;
  status?:
    | AmendmentStatus
    | AmendmentStatus[];
  page?: number;
  limit?: number;
}

// =============================================
// Signature Types (for contract-signature.repository.ts)
// =============================================

/** Signature with user info */
export interface SignatureWithDetails extends ContractSignature {
  user: UserWithEmail;
}

/** Input for creating a signature */
export interface CreateSignatureInput {
  contractId: string;
  userId: string;
  signerRole: 'CLIENT' | 'FREELANCER';
  signatureType: SignatureType;
  signatureImage?: string | null;
  signatureText?: string | null;
  ipAddress: string;
  userAgent: string;
  documentHash: string;
  documentVersion: number;
  termsVersion: string;
}

// =============================================
// Dispute Types (for contract-dispute.repository.ts)
// =============================================

/** Dispute with related info */
export interface DisputeWithDetails extends ContractDispute {
  contract: {
    id: string;
    title: string;
    contractNumber: string;
    clientUserId: string;
    freelancerUserId: string;
  };
  raiser: UserBasicInfo;
  messages: ContractDisputeMessage[];
}

/** Input for creating a dispute */
export interface CreateDisputeInput {
  contractId: string;
  raisedById: string;
  reason: ContractDisputeReason;
  description: string;
  milestoneId?: string;
  timeEntryId?: string;
  disputedAmount: number;
  currency?: string;
  evidenceUrls?: string[];
}

/** Options for listing disputes */
export interface DisputeListOptions {
  contractId?: string;
  raisedById?: string;
  status?:
    | import('./prisma-shim.js').ContractDisputeStatus
    | import('./prisma-shim.js').ContractDisputeStatus[];
  page?: number;
  limit?: number;
}

// =============================================
// Invoice Types (for contract-invoice.repository.ts)
// =============================================

/** Invoice with related info */
export interface InvoiceWithDetails extends ContractInvoice {
  contract: {
    id: string;
    title: string;
    contractNumber: string;
    clientUserId: string;
    freelancerUserId: string;
    client?: { id: string; displayName: string | null; email: string };
    freelancer?: { id: string; displayName: string | null; email: string };
  };
  timeEntries: TimeEntryV2[];
}

/** Invoice line item (for display/calculation purposes) */
export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  type: import('./prisma-shim.js').InvoiceLineItemType;
  milestoneId?: string;
  timeEntryId?: string;
  orderIndex?: number;
}

/** Input for creating an invoice */
export interface CreateInvoiceInput {
  contractId: string;
  periodStart?: Date;
  periodEnd?: Date;
  timeEntryIds?: string[];
  milestoneIds?: string[];
  lineItems?: Omit<InvoiceLineItem, 'amount'>[];
  notes?: string;
  dueDate?: Date;
}

/** Options for listing invoices */
export interface InvoiceListOptions {
  contractId?: string;
  clientUserId?: string;
  freelancerUserId?: string;
  status?:
    | import('./prisma-shim.js').ContractInvoiceStatus
    | import('./prisma-shim.js').ContractInvoiceStatus[];
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
  offset?: number | undefined;
}

// =============================================
// Template Types (for contract-template.repository.ts)
// =============================================

/** Template with usage count - Note: ContractTemplate doesn't have direct relation to ContractV2 */
export interface ContractTemplateWithDetails extends ContractTemplate {
  usageCount?: number;
}

/** Input for creating a template */
export interface CreateContractTemplateInput {
  tenantId?: string | null;
  name: string;
  description?: string | null;
  contractType: import('./prisma-shim.js').ContractTypeV2;
  rateType: import('./prisma-shim.js').RateTypeV2;
  templateContent: string;
  variables: unknown;
  clauses: unknown;
  isDefault?: boolean;
}

/** Input for updating a template */
export interface UpdateContractTemplateInput {
  name?: string;
  description?: string | null;
  templateContent?: string;
  variables?: unknown;
  clauses?: unknown;
  isActive?: boolean;
  isDefault?: boolean;
}

// =============================================
// Paginated Results
// =============================================

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// =============================================
// Escrow Types (for escrow.repository.ts & escrow.service.ts)
// =============================================

export {
  EscrowAccountStatusV2,
  EscrowTransactionTypeV2,
  EscrowTransactionStatusV2,
  InvoiceLineItemType,
} from './prisma-shim.js';

/** Fee calculation result */
export interface FeeCalculation {
  grossAmount: number;
  platformFee: number;
  platformFeePercent: number;
  processingFee: number;
  processingFeePercent: number;
  netAmount: number;
  totalCharge: number;
}

/** Fee breakdown item for display */
export interface FeeBreakdownItem {
  label: string;
  amount: number;
  description?: string;
}

/** Fee preview with breakdown */
export interface FeePreview extends FeeCalculation {
  breakdown: FeeBreakdownItem[];
}

/** Parameters for funding escrow */
export interface FundEscrowParams {
  contractId: string;
  clientUserId: string;
  amount: number;
  milestoneId?: string | undefined;
  paymentMethodId: string;
  idempotencyKey?: string | undefined;
}

/** Parameters for releasing escrow funds */
export interface ReleaseEscrowParams {
  contractId: string;
  clientUserId: string;
  milestoneId?: string | undefined;
  amount?: number | undefined;
  notes?: string | undefined;
}

/** Parameters for refunding escrow */
export interface RefundEscrowParams {
  contractId: string;
  initiatedBy: string;
  milestoneId?: string | undefined;
  amount?: number | undefined;
  reason: string;
}

/** Parameters for freezing escrow (dispute) */
export interface FreezeEscrowParams {
  contractId: string;
  disputeId: string;
  amount?: number | undefined;
}

/** Parameters for unfreezing escrow */
export interface UnfreezeEscrowParams {
  contractId: string;
  disputeId: string;
  amount?: number | undefined;
}

/** Parameters for resolving a dispute */
export interface ResolveDisputeParams {
  disputeId: string;
  resolution: import('./prisma-shim.js').ContractDisputeResolution;
  clientRefundAmount?: number | undefined;
  freelancerPayoutAmount?: number | undefined;
  resolvedBy: string;
  resolutionNotes?: string | undefined;
}

/** Escrow account summary */
export interface EscrowAccountSummary {
  id: string;
  contractId: string;
  balance: number;
  pendingBalance: number;
  releasedBalance: number;
  refundedBalance: number;
  disputedBalance: number;
  availableBalance: number;
  currency: string;
  status: import('./prisma-shim.js').EscrowAccountStatusV2;
  contract: {
    id: string;
    title: string;
    contractNumber: string;
    status: string;
    clientUserId: string;
    freelancerUserId: string;
  };
}

/** Escrow transaction summary */
export interface EscrowTransactionSummary {
  id: string;
  transactionType: import('./prisma-shim.js').EscrowTransactionTypeV2;
  status: import('./prisma-shim.js').EscrowTransactionStatusV2;
  amount: number;
  platformFee: number;
  processingFee: number;
  netAmount: number;
  currency: string;
  milestoneId?: string | null;
  milestoneTitle?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  description?: string | null;
  stripePaymentIntentId?: string | null;
  createdAt: Date;
  processedAt?: Date | null;
}

/** Fund escrow result */
export interface FundEscrowResult {
  transaction: EscrowTransactionSummary;
  clientSecret?: string;
  requiresAction: boolean;
  escrowAccount: EscrowAccountSummary;
}

/** Release escrow result */
export interface ReleaseEscrowResult {
  transaction: EscrowTransactionSummary;
  escrowAccount: EscrowAccountSummary;
  payoutScheduled: boolean;
}

/** Refund escrow result */
export interface RefundEscrowResult {
  transaction: EscrowTransactionSummary;
  escrowAccount: EscrowAccountSummary;
  stripeRefundId?: string;
}

// =============================================
// Invoice Line Item Types
// =============================================

/** Input for creating an invoice line item */
export interface CreateLineItemInput {
  type: import('./prisma-shim.js').InvoiceLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  milestoneId?: string;
  timeEntryId?: string;
  orderIndex?: number;
}

/** Invoice with line items */
export interface InvoiceWithLineItems extends InvoiceWithDetails {
  lineItems: Array<{
    id: string;
    type: import('./prisma-shim.js').InvoiceLineItemType;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    milestoneId?: string | null;
    timeEntryId?: string | null;
    orderIndex: number;
  }>;
}

// =============================================
// Payout Types
// =============================================

/** Payout account summary */
export interface PayoutAccountSummary {
  id: string;
  userId: string;
  stripeConnectAccountId: string | null;
  accountType: string;
  status: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  defaultCurrency: string;
  requiresVerification: boolean;
  verificationFields: string[];
}

/** Input for creating a payout */
export interface CreatePayoutInput {
  freelancerUserId: string;
  amount: number;
  currency?: string;
  invoiceId?: string;
  contractId?: string;
  description?: string;
}

/** Payout result */
export interface PayoutResult {
  id: string;
  amount: number;
  currency: string;
  status: string;
  stripeTransferId?: string | null;
  stripePayoutId?: string | null;
  estimatedArrival?: Date | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}
