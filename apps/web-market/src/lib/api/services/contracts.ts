/**
 * Contracts Service Module
 *
 * Type-safe API methods for contract operations using the shared API client.
 */

import {
  type ApiResponse,
  type PaginatedResponse,
  MARKET_ENDPOINTS,
} from '@skillancer/shared-api-client';

import { getApiClient } from '../api-client';

// =============================================================================
// Types
// =============================================================================

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

export interface MilestoneSubmission {
  id: string;
  milestoneId: string;
  message: string;
  attachments: ContractAttachment[];
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

export interface ContractMilestone {
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
  revisions?: MilestoneRevision[];
  deliverables?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface TimeEntry {
  id: string;
  contractId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  description: string;
  task?: string;
  status: 'PENDING' | 'APPROVED' | 'DISPUTED' | 'PAID';
  activityLevel?: number;
  screenshot?: string;
  memo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Contract {
  id: string;
  proposalId: string;
  jobId: string;
  job: {
    id: string;
    title: string;
    slug: string;
  };
  client: ContractParty;
  freelancer: ContractParty;
  type: ContractType;
  title: string;
  description?: string;
  terms?: string;
  totalAmount: number;
  hourlyRate?: number;
  weeklyLimit?: number;
  startDate?: string;
  endDate?: string;
  status: ContractStatus;
  milestones: ContractMilestone[];
  escrowBalance: number;
  totalPaid: number;
  totalHoursWorked?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContractInput {
  proposalId: string;
  title: string;
  description?: string;
  terms?: string;
  type: ContractType;
  totalAmount?: number;
  hourlyRate?: number;
  weeklyLimit?: number;
  startDate?: string;
  endDate?: string;
  milestones?: Omit<
    ContractMilestone,
    'id' | 'contractId' | 'status' | 'createdAt' | 'updatedAt'
  >[];
}

export interface UpdateContractInput {
  title?: string;
  description?: string;
  terms?: string;
  endDate?: string;
  weeklyLimit?: number;
}

export interface ContractListParams {
  page?: number;
  limit?: number;
  status?: ContractStatus | ContractStatus[];
  role?: 'client' | 'freelancer';
  sortBy?: 'createdAt' | 'updatedAt' | 'totalAmount';
  sortOrder?: 'asc' | 'desc';
}

export interface SubmitMilestoneInput {
  message: string;
  attachments?: string[];
  links?: string[];
}

export interface RequestRevisionInput {
  notes: string;
  feedback?: string;
}

export interface TimeEntryInput {
  date: string;
  startTime?: string;
  endTime?: string;
  duration: number;
  description: string;
  task?: string;
  memo?: string;
}

// =============================================================================
// Contracts API Service
// =============================================================================

export const contractsService = {
  /**
   * Get all contracts for current user
   */
  async getMyContracts(params: ContractListParams = {}): Promise<PaginatedResponse<Contract>> {
    const client = getApiClient();
    const { page = 1, limit = 20, status, ...rest } = params;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      ...rest,
    };

    if (status) {
      queryParams.status = Array.isArray(status) ? status.join(',') : status;
    }

    return client.get<Contract[]>(MARKET_ENDPOINTS.MY_CONTRACTS, {
      params: queryParams,
    }) as Promise<PaginatedResponse<Contract>>;
  },

  /**
   * Get a contract by ID
   */
  async getById(id: string): Promise<ApiResponse<Contract>> {
    const client = getApiClient();
    return client.get<Contract>(MARKET_ENDPOINTS.CONTRACT_BY_ID(id));
  },

  /**
   * Create a new contract (from accepted proposal)
   */
  async create(data: CreateContractInput): Promise<ApiResponse<Contract>> {
    const client = getApiClient();
    return client.post<Contract, CreateContractInput>(MARKET_ENDPOINTS.CONTRACTS, data);
  },

  /**
   * Update contract details
   */
  async update(id: string, data: UpdateContractInput): Promise<ApiResponse<Contract>> {
    const client = getApiClient();
    return client.patch<Contract, UpdateContractInput>(MARKET_ENDPOINTS.CONTRACT_BY_ID(id), data);
  },

  /**
   * Sign a contract (both parties must sign)
   */
  async sign(id: string): Promise<ApiResponse<Contract>> {
    const client = getApiClient();
    return client.post<Contract>(`${MARKET_ENDPOINTS.CONTRACT_BY_ID(id)}/sign`);
  },

  /**
   * Pause a contract
   */
  async pause(id: string, reason?: string): Promise<ApiResponse<Contract>> {
    const client = getApiClient();
    return client.post<Contract, { reason?: string }>(
      `${MARKET_ENDPOINTS.CONTRACT_BY_ID(id)}/pause`,
      {
        reason,
      }
    );
  },

  /**
   * Resume a paused contract
   */
  async resume(id: string): Promise<ApiResponse<Contract>> {
    const client = getApiClient();
    return client.post<Contract>(`${MARKET_ENDPOINTS.CONTRACT_BY_ID(id)}/resume`);
  },

  /**
   * Complete a contract
   */
  async complete(id: string): Promise<ApiResponse<Contract>> {
    const client = getApiClient();
    return client.post<Contract>(`${MARKET_ENDPOINTS.CONTRACT_BY_ID(id)}/complete`);
  },

  /**
   * Cancel a contract
   */
  async cancel(id: string, reason: string): Promise<ApiResponse<Contract>> {
    const client = getApiClient();
    return client.post<Contract, { reason: string }>(
      `${MARKET_ENDPOINTS.CONTRACT_BY_ID(id)}/cancel`,
      {
        reason,
      }
    );
  },

  // =============================================================================
  // Milestones
  // =============================================================================

  /**
   * Get milestones for a contract
   */
  async getMilestones(contractId: string): Promise<ApiResponse<ContractMilestone[]>> {
    const client = getApiClient();
    return client.get<ContractMilestone[]>(MARKET_ENDPOINTS.CONTRACT_MILESTONES(contractId));
  },

  /**
   * Fund a milestone escrow (client)
   */
  async fundMilestone(
    contractId: string,
    milestoneId: string
  ): Promise<ApiResponse<ContractMilestone>> {
    const client = getApiClient();
    return client.post<ContractMilestone>(
      `${MARKET_ENDPOINTS.CONTRACT_MILESTONES(contractId)}/${milestoneId}/fund`
    );
  },

  /**
   * Submit milestone for approval (freelancer)
   */
  async submitMilestone(
    contractId: string,
    milestoneId: string,
    data: SubmitMilestoneInput
  ): Promise<ApiResponse<ContractMilestone>> {
    const client = getApiClient();
    return client.post<ContractMilestone, SubmitMilestoneInput>(
      MARKET_ENDPOINTS.COMPLETE_MILESTONE(contractId, milestoneId),
      data
    );
  },

  /**
   * Approve milestone and release payment (client)
   */
  async approveMilestone(
    contractId: string,
    milestoneId: string
  ): Promise<ApiResponse<ContractMilestone>> {
    const client = getApiClient();
    return client.post<ContractMilestone>(
      MARKET_ENDPOINTS.APPROVE_MILESTONE(contractId, milestoneId)
    );
  },

  /**
   * Request revision for a milestone (client)
   */
  async requestRevision(
    contractId: string,
    milestoneId: string,
    data: RequestRevisionInput
  ): Promise<ApiResponse<ContractMilestone>> {
    const client = getApiClient();
    return client.post<ContractMilestone, RequestRevisionInput>(
      MARKET_ENDPOINTS.REQUEST_REVISION(contractId, milestoneId),
      data
    );
  },

  // =============================================================================
  // Time Tracking (Hourly Contracts)
  // =============================================================================

  /**
   * Get time entries for a contract
   */
  async getTimeEntries(
    contractId: string,
    params?: { startDate?: string; endDate?: string; status?: string }
  ): Promise<ApiResponse<TimeEntry[]>> {
    const client = getApiClient();
    return client.get<TimeEntry[]>(`${MARKET_ENDPOINTS.CONTRACT_BY_ID(contractId)}/time-entries`, {
      params,
    });
  },

  /**
   * Add a time entry (freelancer)
   */
  async addTimeEntry(contractId: string, data: TimeEntryInput): Promise<ApiResponse<TimeEntry>> {
    const client = getApiClient();
    return client.post<TimeEntry, TimeEntryInput>(
      `${MARKET_ENDPOINTS.CONTRACT_BY_ID(contractId)}/time-entries`,
      data
    );
  },

  /**
   * Update a time entry
   */
  async updateTimeEntry(
    contractId: string,
    entryId: string,
    data: Partial<TimeEntryInput>
  ): Promise<ApiResponse<TimeEntry>> {
    const client = getApiClient();
    return client.patch<TimeEntry, Partial<TimeEntryInput>>(
      `${MARKET_ENDPOINTS.CONTRACT_BY_ID(contractId)}/time-entries/${entryId}`,
      data
    );
  },

  /**
   * Delete a time entry
   */
  async deleteTimeEntry(contractId: string, entryId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(
      `${MARKET_ENDPOINTS.CONTRACT_BY_ID(contractId)}/time-entries/${entryId}`
    );
  },

  /**
   * Approve time entries (client)
   */
  async approveTimeEntries(
    contractId: string,
    entryIds: string[]
  ): Promise<ApiResponse<TimeEntry[]>> {
    const client = getApiClient();
    return client.post<TimeEntry[], { entryIds: string[] }>(
      `${MARKET_ENDPOINTS.CONTRACT_BY_ID(contractId)}/time-entries/approve`,
      { entryIds }
    );
  },

  // =============================================================================
  // Reviews
  // =============================================================================

  /**
   * Get reviews for a contract
   */
  async getReviews(contractId: string): Promise<
    ApiResponse<{
      clientReview?: ContractReview;
      freelancerReview?: ContractReview;
    }>
  > {
    const client = getApiClient();
    return client.get(MARKET_ENDPOINTS.CONTRACT_REVIEWS(contractId));
  },

  /**
   * Submit a review for a contract
   */
  async submitReview(
    contractId: string,
    data: SubmitReviewInput
  ): Promise<ApiResponse<ContractReview>> {
    const client = getApiClient();
    return client.post<ContractReview, SubmitReviewInput>(
      MARKET_ENDPOINTS.CONTRACT_REVIEWS(contractId),
      data
    );
  },
};

// =============================================================================
// Additional Types
// =============================================================================

export interface ContractReview {
  id: string;
  contractId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  title?: string;
  comment?: string;
  skills?: { skillId: string; rating: number }[];
  isPublic: boolean;
  response?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitReviewInput {
  rating: number;
  title?: string;
  comment?: string;
  skills?: { skillId: string; rating: number }[];
  isPublic?: boolean;
}

export default contractsService;
