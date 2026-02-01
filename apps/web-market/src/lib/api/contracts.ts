/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
/**
 * Contracts API Client
 *
 * Handles all contract lifecycle operations including milestones, time entries,
 * amendments, signatures, and disputes. Designed for Upwork-style contract management
 * with escrow protection and SkillPod integration.
 */

// ============================================================================
// Types
// ============================================================================

export type ContractType = 'FIXED' | 'HOURLY';
export type ContractStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type MilestoneStatus =
  | 'PENDING'
  | 'FUNDED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'REVISION_REQUESTED'
  | 'APPROVED'
  | 'RELEASED';

export type TimeEntryStatus = 'PENDING' | 'APPROVED' | 'DISPUTED' | 'PAID';

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'MEDIATION' | 'RESOLVED' | 'ESCALATED';

export type AmendmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ContractParty {
  id: string;
  userId: string;
  name: string;
  avatarUrl?: string;
  title?: string;
  company?: string;
  country?: string;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  signedAt?: string;
  signatureHash?: string;
}

export interface Milestone {
  id: string;
  contractId: string;
  title: string;
  description?: string;
  amount: number;
  dueDate?: string;
  status: MilestoneStatus;
  order: number;
  escrowFunded: boolean;
  escrowReleasedAt?: string;
  fundedAt?: string;
  completedAt?: string;
  releasedAt?: string;
  submission?: MilestoneSubmission;
  revision?: MilestoneRevision;
  revisions?: MilestoneRevision[];
  deliverables?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneSubmission {
  id: string;
  milestoneId: string;
  message: string;
  attachments: Attachment[];
  links: string[];
  submittedAt: string;
  submittedBy: string;
}

export interface MilestoneRevision {
  id: string;
  milestoneId: string;
  notes: string;
  feedback?: string;
  requestedAt: string;
  requestedBy: string;
}

export interface TimeEntry {
  id: string;
  contractId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  duration: number; // in minutes
  description: string;
  task?: string;
  status: TimeEntryStatus;
  activityLevel?: number; // 0-100 from SkillPod
  screenshot?: string;
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface Amendment {
  id: string;
  contractId: string;
  type: 'BUDGET' | 'DEADLINE' | 'SCOPE' | 'MILESTONES';
  description: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  status: AmendmentStatus;
  requestedBy: string;
  requestedAt: string;
  respondedAt?: string;
  respondedBy?: string;
  createdAt?: string;
}

export interface Dispute {
  id: string;
  contractId: string;
  reason: 'QUALITY' | 'DELIVERY' | 'PAYMENT' | 'COMMUNICATION' | 'SCOPE' | 'OTHER';
  description: string;
  desiredResolution: string;
  evidence: Attachment[];
  status: DisputeStatus;
  mediatorId?: string;
  openedBy: string;
  openedAt: string;
  resolvedAt?: string;
  resolution?: string;
  messages: DisputeMessage[];
}

export interface DisputeMessage {
  id: string;
  disputeId: string;
  senderId: string;
  senderName: string;
  senderRole: 'CLIENT' | 'FREELANCER' | 'MEDIATOR';
  content: string;
  attachments: Attachment[];
  createdAt: string;
}

export interface ContractActivity {
  id: string;
  contractId: string;
  type: string;
  description: string;
  actor: string;
  actorName: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  type: 'ESCROW_FUNDED' | 'PAYMENT_RELEASED' | 'REFUND' | 'WITHDRAWAL';
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  date: string;
  description: string;
}

export interface PaymentInfo {
  escrowBalance: number;
  totalPaid: number;
  pendingAmount: number;
  releasedAmount?: number;
  nextPaymentDate?: string;
  nextPaymentAmount?: number;
  nextPayment?: {
    amount: number;
    dueDate: string;
    milestone?: string;
  };
  transactions: PaymentTransaction[];
}

export interface Contract {
  id: string;
  title: string;
  description?: string;
  type: ContractType;
  status: ContractStatus;
  amount: number;
  budget?: number;
  hourlyRate?: number;
  weeklyLimit?: number;
  weeklyHoursLimit?: number;
  startDate: string;
  endDate?: string;
  estimatedEndDate?: string;
  terms?: string;
  paymentTerms?: string;
  noticePeriodDays?: number;
  client: ContractParty;
  freelancer: ContractParty;
  clientSignature?: {
    signedAt: string;
    signedBy: string;
  };
  freelancerSignature?: {
    signedAt: string;
    signedBy: string;
  };
  skills: { id: string; name: string }[];
  deliverables?: string[];
  milestones: Milestone[];
  progress?: {
    percentage: number;
    completed: number;
    total: number;
    completedMilestones?: number;
    totalMilestones?: number;
  };
  escrowBalance: number;
  escrowDetails?: {
    funded?: number;
    released?: number;
    pending?: number;
  };
  totalPaid: number;
  totalHours?: number;
  skillPodEnabled: boolean;
  skillPodPolicy?: string;
  proposalId?: string;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface ContractFilters {
  status?: ContractStatus | ContractStatus[];
  type?: ContractType;
  role?: 'CLIENT' | 'FREELANCER';
  search?: string;
  sortBy?: 'startDate' | 'value' | 'status' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateContractData {
  proposalId: string;
  title: string;
  description?: string;
  type: ContractType;
  amount: number;
  hourlyRate?: number;
  weeklyLimit?: number;
  startDate: string;
  endDate?: string;
  milestones?: Omit<
    Milestone,
    'id' | 'contractId' | 'status' | 'escrowFunded' | 'createdAt' | 'updatedAt'
  >[];
  skillPodEnabled?: boolean;
  terms?: string;
}

export interface SubmitMilestoneData {
  message: string;
  attachments?: File[];
  links?: string[];
  deliverables?: { id: string; completed: boolean }[];
}

export interface AddTimeEntryData {
  date: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  description: string;
  task?: string;
  memo?: string;
}

export interface RequestAmendmentData {
  type: Amendment['type'];
  proposedValue: string;
  reason: string;
}

export interface OpenDisputeData {
  reason: Dispute['reason'];
  description: string;
  desiredResolution: string;
  evidence?: File[];
}

export interface SignContractData {
  signature: string; // base64 or typed name
  signatureType: 'TYPED' | 'DRAWN';
  acceptedTerms: boolean;
}

export interface CreateMilestoneData {
  title: string;
  description?: string;
  amount: number;
  dueDate?: string;
  deliverables?: string[];
}

export interface CancelContractData {
  reason: string;
  agreedByBothParties: boolean;
}

export interface CompleteContractData {
  feedback?: {
    rating: number;
    review: string;
  };
}

export interface ContractTermsData {
  terms: string;
  acceptedAt: string;
  acceptedBy: 'CLIENT' | 'FREELANCER';
}

// ============================================================================
// API Functions
// ============================================================================

const API_BASE = '/api/v1/contracts';

/**
 * Get paginated list of contracts with filters
 */
export async function getContracts(
  filters?: ContractFilters,
  page = 1,
  pageSize = 20
): Promise<PaginatedResponse<Contract>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    statuses.forEach((s) => params.append('status', s));
  }
  if (filters?.type) params.set('type', filters.type);
  if (filters?.role) params.set('role', filters.role);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.sortBy) params.set('sortBy', filters.sortBy);
  if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

  // Mock implementation
  await new Promise((r) => setTimeout(r, 500));

  return {
    items: getMockContracts(),
    total: 12,
    page,
    pageSize,
    totalPages: 1,
  };
}

/**
 * Get contract by ID with full details
 */
export async function getContractById(contractId: string): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 300));

  const contracts = getMockContracts();
  const contract = contracts.find((c) => c.id === contractId);

  if (!contract) {
    throw new Error('Contract not found');
  }

  return contract;
}

/**
 * Create new contract from accepted proposal
 */
export async function createContract(data: CreateContractData): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 800));

  return {
    id: `contract-${Date.now()}`,
    ...data,
    status: 'PENDING_SIGNATURE',
    client: getMockClient(),
    freelancer: getMockFreelancer(),
    skills: [],
    milestones: (data.milestones || []).map((m, i) => ({
      ...m,
      id: `milestone-${i}`,
      contractId: `contract-${Date.now()}`,
      status: 'PENDING' as MilestoneStatus,
      order: i,
      escrowFunded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    escrowBalance: 0,
    totalPaid: 0,
    skillPodEnabled: data.skillPodEnabled || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update contract status
 */
export async function updateContractStatus(
  contractId: string,
  status: ContractStatus,
  reason?: string
): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 500));

  const contract = await getContractById(contractId);
  return { ...contract, status, updatedAt: new Date().toISOString() };
}

/**
 * Sign contract digitally
 */
export async function signContract(contractId: string, data: SignContractData): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 600));

  const contract = await getContractById(contractId);

  // Update based on who is signing
  const isClient = true; // Would check actual user role
  if (isClient) {
    contract.client.signedAt = new Date().toISOString();
    contract.client.signatureHash = btoa(data.signature);
  } else {
    contract.freelancer.signedAt = new Date().toISOString();
    contract.freelancer.signatureHash = btoa(data.signature);
  }

  // If both signed, activate contract
  if (contract.client.signedAt && contract.freelancer.signedAt) {
    contract.status = 'ACTIVE';
  }

  return contract;
}

/**
 * Get milestones for a contract
 */
export async function getMilestones(contractId: string): Promise<Milestone[]> {
  await new Promise((r) => setTimeout(r, 300));

  const contract = await getContractById(contractId);
  return contract.milestones;
}

/**
 * Submit work for a milestone
 */
export async function submitMilestone(
  milestoneId: string,
  data: SubmitMilestoneData
): Promise<Milestone> {
  await new Promise((r) => setTimeout(r, 600));

  return {
    id: milestoneId,
    contractId: 'contract-1',
    title: 'Milestone',
    amount: 500,
    status: 'SUBMITTED',
    order: 0,
    escrowFunded: true,
    submission: {
      id: `submission-${Date.now()}`,
      milestoneId,
      message: data.message,
      attachments: [],
      links: data.links || [],
      submittedAt: new Date().toISOString(),
      submittedBy: 'current-user',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Approve milestone and release payment
 */
export async function approveMilestone(
  milestoneId: string,
  bonusAmount?: number
): Promise<Milestone> {
  await new Promise((r) => setTimeout(r, 500));

  return {
    id: milestoneId,
    contractId: 'contract-1',
    title: 'Milestone',
    amount: 500 + (bonusAmount || 0),
    status: 'RELEASED',
    order: 0,
    escrowFunded: true,
    escrowReleasedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Request revision on submitted milestone
 */
export async function requestRevision(milestoneId: string, notes: string): Promise<Milestone> {
  await new Promise((r) => setTimeout(r, 400));

  return {
    id: milestoneId,
    contractId: 'contract-1',
    title: 'Milestone',
    amount: 500,
    status: 'REVISION_REQUESTED',
    order: 0,
    escrowFunded: true,
    revision: {
      id: `revision-${Date.now()}`,
      milestoneId,
      notes,
      requestedAt: new Date().toISOString(),
      requestedBy: 'current-user',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Fund a milestone (client escrow deposit)
 */
export async function fundMilestone(milestoneId: string): Promise<Milestone> {
  await new Promise((r) => setTimeout(r, 600));

  return {
    id: milestoneId,
    contractId: 'contract-1',
    title: 'Milestone',
    amount: 500,
    status: 'FUNDED',
    order: 0,
    escrowFunded: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Release payment for approved milestone
 */
export async function releaseMilestonePayment(milestoneId: string): Promise<Milestone> {
  await new Promise((r) => setTimeout(r, 500));

  return {
    id: milestoneId,
    contractId: 'contract-1',
    title: 'Milestone',
    amount: 500,
    status: 'RELEASED',
    order: 0,
    escrowFunded: true,
    escrowReleasedAt: new Date().toISOString(),
    releasedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Pause an active contract
 */
export async function pauseContract(contractId: string): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 400));
  const contract = await getContractById(contractId);
  return { ...contract, status: 'PAUSED', updatedAt: new Date().toISOString() };
}

/**
 * Resume a paused contract
 */
export async function resumeContract(contractId: string): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 400));
  const contract = await getContractById(contractId);
  return { ...contract, status: 'ACTIVE', updatedAt: new Date().toISOString() };
}

/**
 * Get payment information for a contract
 */
export async function getContractPayments(contractId: string): Promise<PaymentInfo> {
  await new Promise((r) => setTimeout(r, 300));

  return {
    escrowBalance: 3000,
    totalPaid: 9000,
    pendingAmount: 3000,
    releasedAmount: 9000,
    nextPaymentDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    nextPaymentAmount: 3000,
    transactions: [
      {
        id: 'tx-1',
        type: 'ESCROW_FUNDED',
        amount: 5000,
        status: 'COMPLETED',
        date: new Date(Date.now() - 30 * 86400000).toISOString(),
        description: 'Milestone 1 - Initial escrow deposit',
      },
      {
        id: 'tx-2',
        type: 'PAYMENT_RELEASED',
        amount: 5000,
        status: 'COMPLETED',
        date: new Date(Date.now() - 14 * 86400000).toISOString(),
        description: 'Milestone 1 - Payment released',
      },
      {
        id: 'tx-3',
        type: 'ESCROW_FUNDED',
        amount: 4000,
        status: 'COMPLETED',
        date: new Date(Date.now() - 7 * 86400000).toISOString(),
        description: 'Milestone 2 - Escrow deposit',
      },
      {
        id: 'tx-4',
        type: 'PAYMENT_RELEASED',
        amount: 4000,
        status: 'COMPLETED',
        date: new Date(Date.now() - 3 * 86400000).toISOString(),
        description: 'Milestone 2 - Payment released',
      },
      {
        id: 'tx-5',
        type: 'ESCROW_FUNDED',
        amount: 3000,
        status: 'PENDING',
        date: new Date().toISOString(),
        description: 'Milestone 3 - Pending',
      },
    ],
  };
}

/**
 * Get contract statistics summary
 */
export async function getContractStats(): Promise<{
  totalActive: number;
  totalEarnings: number;
  totalHoursThisWeek: number;
  pendingMilestones: number;
  escrowBalance: number;
  completedContracts: number;
}> {
  await new Promise((r) => setTimeout(r, 200));

  return {
    totalActive: 3,
    totalEarnings: 45000,
    totalHoursThisWeek: 24,
    pendingMilestones: 4,
    escrowBalance: 6000,
    completedContracts: 12,
  };
}

/**
 * Get time entries for hourly contract
 */
export async function getTimeEntries(
  contractId: string,
  startDate?: string,
  endDate?: string
): Promise<TimeEntry[]> {
  await new Promise((r) => setTimeout(r, 300));

  return getMockTimeEntries(contractId);
}

/**
 * Add manual time entry
 */
export async function addTimeEntry(contractId: string, data: AddTimeEntryData): Promise<TimeEntry> {
  await new Promise((r) => setTimeout(r, 400));

  return {
    id: `time-${Date.now()}`,
    contractId,
    ...data,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Approve time entries (client action)
 */
export async function approveTimeEntries(entryIds: string[]): Promise<TimeEntry[]> {
  await new Promise((r) => setTimeout(r, 400));

  return entryIds.map((id) => ({
    id,
    contractId: 'contract-1',
    date: new Date().toISOString(),
    duration: 60,
    description: 'Work done',
    status: 'APPROVED' as TimeEntryStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Request contract amendment
 */
export async function requestAmendment(
  contractId: string,
  data: RequestAmendmentData
): Promise<Amendment> {
  await new Promise((r) => setTimeout(r, 500));

  return {
    id: `amendment-${Date.now()}`,
    contractId,
    type: data.type,
    description: getAmendmentDescription(data.type),
    currentValue: 'Current value',
    proposedValue: data.proposedValue,
    reason: data.reason,
    status: 'PENDING',
    requestedBy: 'current-user',
    requestedAt: new Date().toISOString(),
  };
}

/**
 * Approve or reject amendment
 */
export async function respondToAmendment(
  amendmentId: string,
  approved: boolean,
  notes?: string
): Promise<Amendment> {
  await new Promise((r) => setTimeout(r, 400));

  return {
    id: amendmentId,
    contractId: 'contract-1',
    type: 'BUDGET',
    description: 'Budget change',
    currentValue: '$1,000',
    proposedValue: '$1,500',
    reason: 'Scope increased',
    status: approved ? 'APPROVED' : 'REJECTED',
    requestedBy: 'other-user',
    requestedAt: new Date(Date.now() - 86400000).toISOString(),
    respondedAt: new Date().toISOString(),
    respondedBy: 'current-user',
  };
}

/**
 * Get amendment history for contract
 */
export async function getAmendments(contractId: string): Promise<Amendment[]> {
  await new Promise((r) => setTimeout(r, 300));

  return [
    {
      id: 'amendment-1',
      contractId,
      type: 'DEADLINE',
      description: 'Deadline extension',
      currentValue: '2024-01-15',
      proposedValue: '2024-01-30',
      reason: 'Additional research required',
      status: 'APPROVED',
      requestedBy: 'freelancer-1',
      requestedAt: new Date(Date.now() - 604800000).toISOString(),
      respondedAt: new Date(Date.now() - 518400000).toISOString(),
      respondedBy: 'client-1',
    },
  ];
}

/**
 * Open a dispute on contract
 */
export async function openDispute(contractId: string, data: OpenDisputeData): Promise<Dispute> {
  await new Promise((r) => setTimeout(r, 600));

  return {
    id: `dispute-${Date.now()}`,
    contractId,
    reason: data.reason,
    description: data.description,
    desiredResolution: data.desiredResolution,
    evidence: [],
    status: 'OPEN',
    openedBy: 'current-user',
    openedAt: new Date().toISOString(),
    messages: [],
  };
}

/**
 * Get dispute details
 */
export async function getDispute(disputeId: string): Promise<Dispute> {
  await new Promise((r) => setTimeout(r, 300));

  return {
    id: disputeId,
    contractId: 'contract-1',
    reason: 'QUALITY',
    description: 'Work does not meet requirements',
    desiredResolution: 'Revision or partial refund',
    evidence: [],
    status: 'UNDER_REVIEW',
    mediatorId: 'mediator-1',
    openedBy: 'client-1',
    openedAt: new Date(Date.now() - 172800000).toISOString(),
    messages: [
      {
        id: 'msg-1',
        disputeId,
        senderId: 'mediator-1',
        senderName: 'Skillancer Support',
        senderRole: 'MEDIATOR',
        content: "I have reviewed the case. Let's work together to find a resolution.",
        attachments: [],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  };
}

/**
 * Add message to dispute thread
 */
export async function addDisputeMessage(
  disputeId: string,
  content: string,
  attachments?: File[]
): Promise<DisputeMessage> {
  await new Promise((r) => setTimeout(r, 400));

  return {
    id: `msg-${Date.now()}`,
    disputeId,
    senderId: 'current-user',
    senderName: 'You',
    senderRole: 'CLIENT',
    content,
    attachments: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * End contract
 */
export async function endContract(
  contractId: string,
  reason: string,
  feedback?: { rating: number; review: string }
): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 500));

  const contract = await getContractById(contractId);
  return {
    ...contract,
    status: 'COMPLETED',
    endDate: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Cancel a contract (mutual agreement required)
 */
export async function cancelContract(
  contractId: string,
  data: CancelContractData
): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 500));

  const contract = await getContractById(contractId);
  return {
    ...contract,
    status: 'CANCELLED',
    endDate: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mark a contract as completed
 */
export async function completeContract(
  contractId: string,
  data?: CompleteContractData
): Promise<Contract> {
  // Delegates to endContract with optional feedback
  return endContract(contractId, 'Contract completed', data?.feedback);
}

/**
 * Create a new milestone on a contract
 */
export async function createMilestone(
  contractId: string,
  data: CreateMilestoneData
): Promise<Milestone> {
  await new Promise((r) => setTimeout(r, 500));

  const contract = await getContractById(contractId);
  const nextOrder = (contract.milestones?.length ?? 0) + 1;

  return {
    id: `milestone-${Date.now()}`,
    contractId,
    title: data.title,
    description: data.description,
    amount: data.amount,
    dueDate: data.dueDate,
    status: 'PENDING',
    order: nextOrder,
    escrowFunded: false,
    deliverables: data.deliverables,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Update milestone details
 */
export async function updateMilestone(
  milestoneId: string,
  data: Partial<CreateMilestoneData>
): Promise<Milestone> {
  await new Promise((r) => setTimeout(r, 400));

  return {
    id: milestoneId,
    contractId: 'contract-1',
    title: data.title ?? 'Updated Milestone',
    description: data.description,
    amount: data.amount ?? 500,
    dueDate: data.dueDate,
    status: 'PENDING',
    order: 1,
    escrowFunded: false,
    deliverables: data.deliverables,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Delete a pending milestone
 */
export async function deleteMilestone(milestoneId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 300));
  // In real implementation, would delete from database
}

/**
 * Accept contract terms (both parties must accept)
 */
export async function acceptContractTerms(
  contractId: string,
  role: 'CLIENT' | 'FREELANCER'
): Promise<Contract> {
  await new Promise((r) => setTimeout(r, 400));

  const contract = await getContractById(contractId);

  // Check if both parties have now accepted
  const bothAccepted = true; // In real impl, check database

  return {
    ...contract,
    status: bothAccepted ? 'PENDING_SIGNATURE' : 'DRAFT',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get contract activity log
 */
export async function getContractActivity(contractId: string): Promise<ContractActivity[]> {
  await new Promise((r) => setTimeout(r, 300));

  return [
    {
      id: 'activity-1',
      contractId,
      type: 'MILESTONE_SUBMITTED',
      description: 'Milestone "Design Phase" was submitted',
      actor: 'freelancer-1',
      actorName: 'Sarah Johnson',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'activity-2',
      contractId,
      type: 'MESSAGE_SENT',
      description: 'New message in contract chat',
      actor: 'client-1',
      actorName: 'John Smith',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'activity-3',
      contractId,
      type: 'CONTRACT_SIGNED',
      description: 'Contract was signed by freelancer',
      actor: 'freelancer-1',
      actorName: 'Sarah Johnson',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'activity-4',
      contractId,
      type: 'CONTRACT_CREATED',
      description: 'Contract was created',
      actor: 'client-1',
      actorName: 'John Smith',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ];
}

/**
 * Subscribe to contract updates via WebSocket
 */
export function subscribeToContractUpdates(
  contractId: string,
  callback: (event: ContractEvent) => void
): () => void {
  // Mock WebSocket subscription
  const interval = setInterval(() => {
    // Simulate random updates
    if (Math.random() > 0.95) {
      callback({
        type: 'MILESTONE_UPDATED',
        contractId,
        data: { milestoneId: 'milestone-1' },
      });
    }
  }, 5000);

  return () => clearInterval(interval);
}

export type ContractEvent =
  | { type: 'MILESTONE_UPDATED'; contractId: string; data: { milestoneId: string } }
  | { type: 'MILESTONE_SUBMITTED'; contractId: string; data: { milestoneId: string } }
  | { type: 'PAYMENT_RELEASED'; contractId: string; data: { amount: number } }
  | { type: 'MESSAGE_RECEIVED'; contractId: string; data: { messageId: string } }
  | { type: 'STATUS_CHANGED'; contractId: string; data: { status: ContractStatus } }
  | { type: 'AMENDMENT_REQUESTED'; contractId: string; data: { amendmentId: string } };

// ============================================================================
// Helper Functions
// ============================================================================

function getAmendmentDescription(type: Amendment['type']): string {
  const descriptions: Record<Amendment['type'], string> = {
    BUDGET: 'Budget change',
    DEADLINE: 'Deadline extension',
    SCOPE: 'Scope modification',
    MILESTONES: 'Milestone changes',
  };
  return descriptions[type];
}

export function getContractStatusInfo(status: ContractStatus): {
  label: string;
  color: string;
  description: string;
} {
  const statusMap: Record<ContractStatus, { label: string; color: string; description: string }> = {
    DRAFT: { label: 'Draft', color: 'gray', description: 'Contract is being prepared' },
    PENDING_SIGNATURE: {
      label: 'Awaiting Signature',
      color: 'yellow',
      description: 'Waiting for signatures',
    },
    ACTIVE: { label: 'Active', color: 'green', description: 'Contract is in progress' },
    PAUSED: { label: 'Paused', color: 'orange', description: 'Contract is temporarily paused' },
    COMPLETED: { label: 'Completed', color: 'blue', description: 'Contract has been completed' },
    CANCELLED: { label: 'Cancelled', color: 'red', description: 'Contract was cancelled' },
    DISPUTED: { label: 'In Dispute', color: 'red', description: 'Contract is under dispute' },
  };
  return statusMap[status];
}

export function getMilestoneStatusInfo(status: MilestoneStatus): {
  label: string;
  color: string;
  icon: string;
} {
  const statusMap: Record<MilestoneStatus, { label: string; color: string; icon: string }> = {
    PENDING: { label: 'Pending', color: 'gray', icon: 'clock' },
    FUNDED: { label: 'Funded', color: 'blue', icon: 'dollar' },
    IN_PROGRESS: { label: 'In Progress', color: 'yellow', icon: 'play' },
    SUBMITTED: { label: 'Submitted', color: 'purple', icon: 'upload' },
    REVISION_REQUESTED: { label: 'Revision Requested', color: 'orange', icon: 'refresh' },
    APPROVED: { label: 'Approved', color: 'green', icon: 'check' },
    RELEASED: { label: 'Payment Released', color: 'green', icon: 'check-circle' },
  };
  return statusMap[status];
}

export function calculateContractProgress(contract: Contract): {
  percentage: number;
  completed: number;
  total: number;
  completedMilestones: number;
  totalMilestones: number;
} {
  if (contract.type === 'FIXED') {
    const completed = contract.milestones.filter((m) =>
      ['APPROVED', 'RELEASED'].includes(m.status)
    ).length;
    const total = contract.milestones.length;
    return {
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      completed,
      total,
      completedMilestones: completed,
      totalMilestones: total,
    };
  } else {
    // For hourly, calculate based on budget vs spent
    const spent = contract.totalPaid;
    const budget = contract.amount;
    return {
      percentage: budget > 0 ? Math.round((spent / budget) * 100) : 0,
      completed: Math.round(contract.totalHours || 0),
      total: contract.weeklyLimit ? contract.weeklyLimit * 4 : 160,
      completedMilestones: 0,
      totalMilestones: 0,
    };
  }
}

// ============================================================================
// Mock Data
// ============================================================================

function getMockClient(): ContractParty {
  return {
    id: 'client-1',
    userId: 'user-client-1',
    name: 'TechStart Inc.',
    avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=TS',
    title: 'CEO',
    country: 'United States',
    rating: 4.9,
    reviewCount: 47,
    isVerified: true,
    signedAt: new Date(Date.now() - 604800000).toISOString(),
    signatureHash: 'abc123',
  };
}

function getMockFreelancer(): ContractParty {
  return {
    id: 'freelancer-1',
    userId: 'user-freelancer-1',
    name: 'Sarah Johnson',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    title: 'Senior Full-Stack Developer',
    country: 'Canada',
    rating: 4.95,
    reviewCount: 89,
    isVerified: true,
    signedAt: new Date(Date.now() - 518400000).toISOString(),
    signatureHash: 'def456',
  };
}

function getMockContracts(): Contract[] {
  return [
    {
      id: 'contract-1',
      title: 'E-commerce Platform Development',
      description: 'Build a complete e-commerce platform with React and Node.js',
      type: 'FIXED',
      status: 'ACTIVE',
      amount: 15000,
      startDate: new Date(Date.now() - 2592000000).toISOString(),
      estimatedEndDate: new Date(Date.now() + 2592000000).toISOString(),
      client: getMockClient(),
      freelancer: getMockFreelancer(),
      skills: [
        { id: '1', name: 'React' },
        { id: '2', name: 'Node.js' },
        { id: '3', name: 'PostgreSQL' },
      ],
      deliverables: [
        'User authentication system',
        'Product catalog',
        'Shopping cart',
        'Payment integration',
        'Admin dashboard',
      ],
      milestones: [
        {
          id: 'milestone-1',
          contractId: 'contract-1',
          title: 'Project Setup & Authentication',
          description: 'Set up project infrastructure and implement user auth',
          amount: 3000,
          dueDate: new Date(Date.now() - 1728000000).toISOString(),
          status: 'RELEASED',
          order: 0,
          escrowFunded: true,
          escrowReleasedAt: new Date(Date.now() - 1296000000).toISOString(),
          createdAt: new Date(Date.now() - 2592000000).toISOString(),
          updatedAt: new Date(Date.now() - 1296000000).toISOString(),
        },
        {
          id: 'milestone-2',
          contractId: 'contract-1',
          title: 'Product Catalog & Cart',
          description: 'Implement product listing and shopping cart functionality',
          amount: 5000,
          dueDate: new Date(Date.now() + 432000000).toISOString(),
          status: 'SUBMITTED',
          order: 1,
          escrowFunded: true,
          submission: {
            id: 'submission-1',
            milestoneId: 'milestone-2',
            message: 'Completed the product catalog and cart. Please review.',
            attachments: [],
            links: ['https://staging.example.com'],
            submittedAt: new Date(Date.now() - 86400000).toISOString(),
            submittedBy: 'freelancer-1',
          },
          createdAt: new Date(Date.now() - 2592000000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'milestone-3',
          contractId: 'contract-1',
          title: 'Payment & Checkout',
          description: 'Integrate payment gateway and checkout flow',
          amount: 4000,
          dueDate: new Date(Date.now() + 1296000000).toISOString(),
          status: 'FUNDED',
          order: 2,
          escrowFunded: true,
          createdAt: new Date(Date.now() - 2592000000).toISOString(),
          updatedAt: new Date(Date.now() - 2592000000).toISOString(),
        },
        {
          id: 'milestone-4',
          contractId: 'contract-1',
          title: 'Admin Dashboard',
          description: 'Build admin panel for managing products and orders',
          amount: 3000,
          dueDate: new Date(Date.now() + 2160000000).toISOString(),
          status: 'PENDING',
          order: 3,
          escrowFunded: false,
          createdAt: new Date(Date.now() - 2592000000).toISOString(),
          updatedAt: new Date(Date.now() - 2592000000).toISOString(),
        },
      ],
      escrowBalance: 9000,
      totalPaid: 3000,
      skillPodEnabled: true,
      skillPodPolicy: 'SCREENSHOTS_ENABLED',
      proposalId: 'proposal-1',
      jobId: 'job-1',
      createdAt: new Date(Date.now() - 2592000000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'contract-2',
      title: 'Mobile App UI/UX Design',
      type: 'HOURLY',
      status: 'ACTIVE',
      amount: 8000,
      hourlyRate: 75,
      weeklyLimit: 30,
      startDate: new Date(Date.now() - 1296000000).toISOString(),
      client: {
        ...getMockClient(),
        id: 'client-2',
        name: 'DesignHub',
      },
      freelancer: getMockFreelancer(),
      skills: [
        { id: '4', name: 'UI/UX Design' },
        { id: '5', name: 'Figma' },
      ],
      milestones: [],
      escrowBalance: 2250,
      totalPaid: 1875,
      totalHours: 25,
      skillPodEnabled: false,
      createdAt: new Date(Date.now() - 1296000000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'contract-3',
      title: 'API Integration Project',
      type: 'FIXED',
      status: 'PENDING_SIGNATURE',
      amount: 3500,
      startDate: new Date().toISOString(),
      client: {
        ...getMockClient(),
        id: 'client-3',
        name: 'DataFlow Inc.',
        signedAt: new Date().toISOString(),
      },
      freelancer: {
        ...getMockFreelancer(),
        signedAt: undefined,
        signatureHash: undefined,
      },
      skills: [
        { id: '6', name: 'REST APIs' },
        { id: '7', name: 'Python' },
      ],
      milestones: [
        {
          id: 'milestone-5',
          contractId: 'contract-3',
          title: 'API Development',
          amount: 3500,
          status: 'PENDING',
          order: 0,
          escrowFunded: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      escrowBalance: 0,
      totalPaid: 0,
      skillPodEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'contract-4',
      title: 'Website Redesign',
      type: 'FIXED',
      status: 'COMPLETED',
      amount: 5000,
      startDate: new Date(Date.now() - 5184000000).toISOString(),
      endDate: new Date(Date.now() - 864000000).toISOString(),
      client: {
        ...getMockClient(),
        id: 'client-4',
        name: 'ModernCorp',
      },
      freelancer: getMockFreelancer(),
      skills: [
        { id: '8', name: 'Web Design' },
        { id: '9', name: 'WordPress' },
      ],
      milestones: [
        {
          id: 'milestone-6',
          contractId: 'contract-4',
          title: 'Design & Development',
          amount: 5000,
          status: 'RELEASED',
          order: 0,
          escrowFunded: true,
          escrowReleasedAt: new Date(Date.now() - 864000000).toISOString(),
          createdAt: new Date(Date.now() - 5184000000).toISOString(),
          updatedAt: new Date(Date.now() - 864000000).toISOString(),
        },
      ],
      escrowBalance: 0,
      totalPaid: 5000,
      skillPodEnabled: false,
      createdAt: new Date(Date.now() - 5184000000).toISOString(),
      updatedAt: new Date(Date.now() - 864000000).toISOString(),
    },
  ];
}

function getMockTimeEntries(contractId: string): TimeEntry[] {
  const now = new Date();
  const entries: TimeEntry[] = [];

  // Generate entries for the past week
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayEntries = generateDayEntries(contractId, date, i);
    entries.push(...dayEntries);
  }

  return entries;
}

function generateDayEntries(contractId: string, date: Date, dayOffset: number): TimeEntry[] {
  // 70% chance of having entries
  if (Math.random() <= 0.3) {
    return [];
  }

  const entries: TimeEntry[] = [];
  const numEntries = Math.floor(Math.random() * 3) + 1;

  for (let j = 0; j < numEntries; j++) {
    entries.push(createTimeEntry(contractId, date, dayOffset, j));
  }

  return entries;
}

function createTimeEntry(
  contractId: string,
  date: Date,
  dayOffset: number,
  index: number
): TimeEntry {
  return {
    id: `time-${dayOffset}-${index}`,
    contractId,
    date: date.toISOString().split('T')[0],
    startTime: `${9 + index * 3}:00`,
    endTime: `${11 + index * 3}:30`,
    duration: 150, // 2.5 hours
    description: getRandomWorkDescription(),
    task: Math.random() > 0.5 ? getRandomTask() : undefined,
    status: dayOffset > 2 ? 'APPROVED' : 'PENDING',
    activityLevel: Math.floor(Math.random() * 40) + 60,
    memo: Math.random() > 0.7 ? 'Good progress today' : undefined,
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
  };
}

function getRandomWorkDescription(): string {
  const descriptions = [
    'Implemented new feature components',
    'Bug fixes and code review',
    'API integration work',
    'Database schema updates',
    'Testing and QA',
    'Documentation updates',
    'Design implementation',
    'Performance optimization',
  ];
  return descriptions[Math.floor(Math.random() * descriptions.length)];
}

function getRandomTask(): string {
  const tasks = [
    'User Authentication',
    'Product Catalog',
    'Shopping Cart',
    'Checkout Flow',
    'Admin Panel',
    'API Development',
    'Testing',
  ];
  return tasks[Math.floor(Math.random() * tasks.length)];
}
