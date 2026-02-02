/**
 * Proposals Service Module
 *
 * Type-safe API methods for proposal operations using the shared API client.
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

export type ProposalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'VIEWED'
  | 'SHORTLISTED'
  | 'INTERVIEW'
  | 'INTERVIEWING'
  | 'HIRED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'EXPIRED'
  | 'ARCHIVED';

export type ContractType = 'FIXED' | 'HOURLY';

export interface ProposalMilestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  durationDays: number;
  order?: number;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

export interface ProposalAttachment {
  id: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt?: string;
}

export interface ProposalFreelancer {
  id: string;
  name: string;
  avatarUrl?: string;
  title?: string;
  country?: string;
  hourlyRate?: number;
  rating?: number;
  reviewCount?: number;
  totalEarnings?: number;
  completedJobs?: number;
}

export interface ProposalJob {
  id: string;
  slug: string;
  title: string;
  budgetType: ContractType;
  budgetMin?: number;
  budgetMax?: number;
}

export interface Proposal {
  id: string;
  jobId: string;
  job: ProposalJob;
  freelancer: ProposalFreelancer;
  coverLetter: string;
  contractType: ContractType;
  bidAmount: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays: number;
  milestones: ProposalMilestone[];
  attachments: ProposalAttachment[];
  portfolioItems?: string[];
  status: ProposalStatus;
  viewedAt?: string;
  shortlistedAt?: string;
  hiredAt?: string;
  declinedAt?: string;
  withdrawnAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitProposalInput {
  jobId: string;
  coverLetter: string;
  contractType: ContractType;
  bidAmount: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays: number;
  milestones?: Omit<ProposalMilestone, 'id' | 'status'>[];
  attachments?: string[];
  portfolioItems?: string[];
  templateId?: string;
}

export interface UpdateProposalInput {
  coverLetter?: string;
  bidAmount?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays?: number;
  milestones?: Omit<ProposalMilestone, 'id' | 'status'>[];
  attachments?: string[];
  portfolioItems?: string[];
}

export interface ProposalDraft {
  id: string;
  jobId: string;
  coverLetter?: string;
  contractType?: ContractType;
  bidAmount?: number;
  hourlyRate?: number;
  estimatedHours?: number;
  deliveryDays?: number;
  milestones?: Omit<ProposalMilestone, 'id' | 'status'>[];
  attachmentIds?: string[];
  portfolioItemIds?: string[];
  currentStep: number;
  lastSavedAt: string;
}

export interface ProposalListParams {
  page?: number;
  limit?: number;
  status?: ProposalStatus | ProposalStatus[];
  sortBy?: 'createdAt' | 'updatedAt' | 'bidAmount';
  sortOrder?: 'asc' | 'desc';
}

export interface ProposalStats {
  total: number;
  submitted: number;
  viewed: number;
  shortlisted: number;
  interviewing: number;
  hired: number;
  declined: number;
  withdrawn: number;
  pending: number;
  avgResponseTime: number | null;
  successRate: number;
}

// =============================================================================
// Proposals API Service
// =============================================================================

export const proposalsService = {
  /**
   * Submit a new proposal
   */
  async submit(data: SubmitProposalInput): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.post<Proposal, SubmitProposalInput>(MARKET_ENDPOINTS.PROPOSALS, data);
  },

  /**
   * Get a proposal by ID
   */
  async getById(id: string): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.get<Proposal>(MARKET_ENDPOINTS.PROPOSAL_BY_ID(id));
  },

  /**
   * Get proposal statistics for current user
   */
  async getStats(): Promise<ApiResponse<ProposalStats>> {
    const client = getApiClient();
    return client.get<ProposalStats>(`${MARKET_ENDPOINTS.MY_PROPOSALS}/stats`);
  },

  /**
   * Get my proposals (as a freelancer)
   */
  async getMyProposals(params: ProposalListParams = {}): Promise<PaginatedResponse<Proposal>> {
    const client = getApiClient();
    const { page = 1, limit = 20, status, ...rest } = params;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      ...rest,
    };

    // Handle status array
    if (status) {
      queryParams.status = Array.isArray(status) ? status.join(',') : status;
    }

    return client.get<Proposal[]>(MARKET_ENDPOINTS.MY_PROPOSALS, {
      params: queryParams,
    }) as Promise<PaginatedResponse<Proposal>>;
  },

  /**
   * Get proposals for a specific job (as a client)
   */
  async getJobProposals(
    jobId: string,
    params: ProposalListParams = {}
  ): Promise<PaginatedResponse<Proposal>> {
    const client = getApiClient();
    const { page = 1, limit = 20, status, ...rest } = params;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      ...rest,
    };

    // Handle status array
    if (status) {
      queryParams.status = Array.isArray(status) ? status.join(',') : status;
    }

    return client.get<Proposal[]>(MARKET_ENDPOINTS.JOB_PROPOSALS(jobId), {
      params: queryParams,
    }) as Promise<PaginatedResponse<Proposal>>;
  },

  /**
   * Update a proposal (only allowed before client views it)
   */
  async update(id: string, data: UpdateProposalInput): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.patch<Proposal, UpdateProposalInput>(MARKET_ENDPOINTS.PROPOSAL_BY_ID(id), data);
  },

  /**
   * Withdraw a proposal
   */
  async withdraw(id: string): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.post<Proposal>(MARKET_ENDPOINTS.WITHDRAW_PROPOSAL(id));
  },

  /**
   * Accept a proposal (as a client) - initiates contract creation
   */
  async accept(id: string): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.post<Proposal>(MARKET_ENDPOINTS.ACCEPT_PROPOSAL(id));
  },

  /**
   * Reject/decline a proposal (as a client)
   */
  async reject(id: string, reason?: string): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.post<Proposal, { reason?: string }>(MARKET_ENDPOINTS.REJECT_PROPOSAL(id), {
      reason,
    });
  },

  /**
   * Shortlist a proposal (as a client)
   */
  async shortlist(id: string): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.patch<Proposal, { status: ProposalStatus }>(MARKET_ENDPOINTS.PROPOSAL_BY_ID(id), {
      status: 'SHORTLISTED',
    });
  },

  /**
   * Archive a proposal
   */
  async archive(id: string): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.patch<Proposal, { status: ProposalStatus }>(MARKET_ENDPOINTS.PROPOSAL_BY_ID(id), {
      status: 'ARCHIVED',
    });
  },

  // =============================================================================
  // Draft Management
  // =============================================================================

  /**
   * Save a proposal as draft
   */
  async saveDraft(
    data: Partial<SubmitProposalInput> & { jobId: string }
  ): Promise<ApiResponse<ProposalDraft>> {
    const client = getApiClient();
    return client.post<ProposalDraft, Partial<SubmitProposalInput> & { jobId: string }>(
      `${MARKET_ENDPOINTS.PROPOSALS}/drafts`,
      data
    );
  },

  /**
   * Get draft for a job
   */
  async getDraft(jobId: string): Promise<ApiResponse<ProposalDraft | null>> {
    const client = getApiClient();
    return client.get<ProposalDraft | null>(`${MARKET_ENDPOINTS.PROPOSALS}/drafts/${jobId}`);
  },

  /**
   * Update draft
   */
  async updateDraft(
    draftId: string,
    data: Partial<SubmitProposalInput>
  ): Promise<ApiResponse<ProposalDraft>> {
    const client = getApiClient();
    return client.patch<ProposalDraft, Partial<SubmitProposalInput>>(
      `${MARKET_ENDPOINTS.PROPOSALS}/drafts/${draftId}`,
      data
    );
  },

  /**
   * Delete draft
   */
  async deleteDraft(draftId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`${MARKET_ENDPOINTS.PROPOSALS}/drafts/${draftId}`);
  },

  /**
   * Submit draft as proposal
   */
  async submitDraft(draftId: string): Promise<ApiResponse<Proposal>> {
    const client = getApiClient();
    return client.post<Proposal>(`${MARKET_ENDPOINTS.PROPOSALS}/drafts/${draftId}/submit`);
  },
};

export default proposalsService;
