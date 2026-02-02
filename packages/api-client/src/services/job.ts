/**
 * @module @skillancer/api-client/services/job
 * Job/Gig service client for marketplace functionality
 */

import type { HttpClient, ApiResponse } from '../http/base-client';

// =============================================================================
// Types
// =============================================================================

export interface Job {
  id: string;
  title: string;
  description: string;
  clientId: string;
  client: {
    id: string;
    displayName: string;
    avatar?: string;
    avgRating: number;
    totalReviews: number;
    totalJobsPosted: number;
    paymentVerified: boolean;
  };
  category: JobCategory;
  subcategory?: string;
  skills: string[];
  budgetType: 'fixed' | 'hourly';
  budget: JobBudget;
  duration: JobDuration;
  experienceLevel: 'entry' | 'intermediate' | 'expert';
  scope: 'small' | 'medium' | 'large';
  status: JobStatus;
  visibility: 'public' | 'private' | 'invite-only';
  location?: {
    type: 'remote' | 'onsite' | 'hybrid';
    country?: string;
    city?: string;
  };
  attachments: Attachment[];
  questions?: string[];
  proposalCount: number;
  invitesSent: number;
  hiredCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface JobCategory {
  id: string;
  name: string;
  slug: string;
}

export interface JobBudget {
  min?: number;
  max?: number;
  fixed?: number;
  currency: string;
}

export interface JobDuration {
  type:
    | 'less-than-week'
    | '1-4-weeks'
    | '1-3-months'
    | '3-6-months'
    | 'more-than-6-months'
    | 'ongoing';
  estimatedHours?: number;
}

export type JobStatus = 'draft' | 'open' | 'in-progress' | 'completed' | 'cancelled' | 'closed';

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  categoryId: string;
  subcategory?: string;
  skills: string[];
  budgetType: 'fixed' | 'hourly';
  budget: Omit<JobBudget, 'currency'> & { currency?: string };
  duration: JobDuration;
  experienceLevel: 'entry' | 'intermediate' | 'expert';
  scope: 'small' | 'medium' | 'large';
  visibility?: 'public' | 'private' | 'invite-only';
  location?: {
    type: 'remote' | 'onsite' | 'hybrid';
    country?: string;
    city?: string;
  };
  questions?: string[];
  isDraft?: boolean;
}

export interface UpdateJobRequest extends Partial<CreateJobRequest> {}

export interface JobSearchParams {
  query?: string;
  categoryId?: string;
  skills?: string[];
  budgetType?: 'fixed' | 'hourly';
  budgetMin?: number;
  budgetMax?: number;
  experienceLevel?: string[];
  duration?: string[];
  locationType?: string[];
  country?: string;
  sortBy?: 'relevance' | 'newest' | 'budget-high' | 'budget-low';
  page?: number;
  limit?: number;
}

export interface JobSearchResult {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: {
    categories: Array<{ id: string; name: string; count: number }>;
    skills: Array<{ name: string; count: number }>;
    experienceLevels: Array<{ level: string; count: number }>;
    budgetRanges: Array<{ range: string; count: number }>;
  };
}

// Proposals
export interface Proposal {
  id: string;
  jobId: string;
  job: Pick<Job, 'id' | 'title' | 'status' | 'budget' | 'budgetType'>;
  freelancerId: string;
  freelancer: {
    id: string;
    displayName: string;
    title: string;
    avatar?: string;
    avgRating: number;
    totalReviews: number;
    hourlyRate: number;
  };
  coverLetter: string;
  bidAmount: number;
  bidType: 'fixed' | 'hourly';
  estimatedDuration: string;
  milestones?: ProposalMilestone[];
  attachments: Attachment[];
  answers?: Array<{ question: string; answer: string }>;
  status: ProposalStatus;
  boosted: boolean;
  viewedByClient: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalMilestone {
  description: string;
  amount: number;
  dueDate?: string;
}

export type ProposalStatus =
  | 'pending'
  | 'viewed'
  | 'shortlisted'
  | 'rejected'
  | 'accepted'
  | 'withdrawn';

export interface CreateProposalRequest {
  jobId: string;
  coverLetter: string;
  bidAmount: number;
  bidType: 'fixed' | 'hourly';
  estimatedDuration: string;
  milestones?: ProposalMilestone[];
  answers?: Array<{ question: string; answer: string }>;
}

export interface UpdateProposalRequest {
  coverLetter?: string;
  bidAmount?: number;
  estimatedDuration?: string;
  milestones?: ProposalMilestone[];
}

// Contracts
export interface Contract {
  id: string;
  jobId: string;
  job: Pick<Job, 'id' | 'title' | 'description'>;
  proposalId: string;
  clientId: string;
  client: {
    id: string;
    displayName: string;
    avatar?: string;
  };
  freelancerId: string;
  freelancer: {
    id: string;
    displayName: string;
    title: string;
    avatar?: string;
  };
  title: string;
  description: string;
  contractType: 'fixed' | 'hourly';
  budget: number;
  currency: string;
  hourlyRate?: number;
  weeklyLimit?: number;
  milestones?: ContractMilestone[];
  status: ContractStatus;
  startDate: string;
  endDate?: string;
  completedAt?: string;
  totalPaid: number;
  totalHoursWorked?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractMilestone {
  id: string;
  description: string;
  amount: number;
  dueDate?: string;
  status: 'pending' | 'in-progress' | 'submitted' | 'approved' | 'paid' | 'disputed';
  submittedAt?: string;
  approvedAt?: string;
  paidAt?: string;
}

export type ContractStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export interface CreateContractRequest {
  proposalId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  weeklyLimit?: number;
  milestones?: Omit<ContractMilestone, 'id' | 'status'>[];
}

// =============================================================================
// Job Service Client
// =============================================================================

export class JobServiceClient {
  private httpClient: HttpClient;
  private basePath: string;

  constructor(httpClient: HttpClient, basePath: string = '/jobs') {
    this.httpClient = httpClient;
    this.basePath = basePath;
  }

  // ===========================================================================
  // Jobs
  // ===========================================================================

  /**
   * Search jobs
   */
  async searchJobs(params: JobSearchParams = {}): Promise<JobSearchResult> {
    const queryString = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach((v) => queryString.append(key, v));
        } else {
          queryString.append(key, String(value));
        }
      }
    });

    return this.httpClient.get<JobSearchResult>(`${this.basePath}?${queryString.toString()}`);
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job> {
    return this.httpClient.get<Job>(`${this.basePath}/${jobId}`);
  }

  /**
   * Create a new job
   */
  async createJob(data: CreateJobRequest): Promise<Job> {
    return this.httpClient.post<Job>(this.basePath, data);
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, data: UpdateJobRequest): Promise<Job> {
    return this.httpClient.patch<Job>(`${this.basePath}/${jobId}`, data);
  }

  /**
   * Delete job (draft only)
   */
  async deleteJob(jobId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(`${this.basePath}/${jobId}`);
  }

  /**
   * Publish draft job
   */
  async publishJob(jobId: string): Promise<Job> {
    return this.httpClient.post<Job>(`${this.basePath}/${jobId}/publish`);
  }

  /**
   * Close job
   */
  async closeJob(jobId: string, reason?: string): Promise<Job> {
    return this.httpClient.post<Job>(`${this.basePath}/${jobId}/close`, { reason });
  }

  /**
   * Get client's posted jobs
   */
  async getMyJobs(
    status?: JobStatus,
    page?: number,
    limit?: number
  ): Promise<ApiResponse<{ jobs: Job[]; total: number }>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));

    return this.httpClient.get<ApiResponse<{ jobs: Job[]; total: number }>>(
      `${this.basePath}/me?${params.toString()}`
    );
  }

  /**
   * Get recommended jobs for freelancer
   */
  async getRecommendedJobs(limit?: number): Promise<Job[]> {
    const params = limit ? `?limit=${limit}` : '';
    return this.httpClient.get<Job[]>(`${this.basePath}/recommended${params}`);
  }

  /**
   * Save job
   */
  async saveJob(jobId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`${this.basePath}/${jobId}/save`);
  }

  /**
   * Unsave job
   */
  async unsaveJob(jobId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(`${this.basePath}/${jobId}/save`);
  }

  /**
   * Get saved jobs
   */
  async getSavedJobs(
    page?: number,
    limit?: number
  ): Promise<ApiResponse<{ jobs: Job[]; total: number }>> {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));

    return this.httpClient.get<ApiResponse<{ jobs: Job[]; total: number }>>(
      `${this.basePath}/saved?${params.toString()}`
    );
  }

  // ===========================================================================
  // Proposals
  // ===========================================================================

  /**
   * Get proposals for a job (client)
   */
  async getJobProposals(
    jobId: string,
    page?: number,
    limit?: number
  ): Promise<ApiResponse<{ proposals: Proposal[]; total: number }>> {
    const params = new URLSearchParams();
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));

    return this.httpClient.get<ApiResponse<{ proposals: Proposal[]; total: number }>>(
      `${this.basePath}/${jobId}/proposals?${params.toString()}`
    );
  }

  /**
   * Submit proposal (freelancer)
   */
  async submitProposal(data: CreateProposalRequest): Promise<Proposal> {
    return this.httpClient.post<Proposal>(`/proposals`, data);
  }

  /**
   * Get proposal by ID
   */
  async getProposal(proposalId: string): Promise<Proposal> {
    return this.httpClient.get<Proposal>(`/proposals/${proposalId}`);
  }

  /**
   * Update proposal
   */
  async updateProposal(proposalId: string, data: UpdateProposalRequest): Promise<Proposal> {
    return this.httpClient.patch<Proposal>(`/proposals/${proposalId}`, data);
  }

  /**
   * Withdraw proposal
   */
  async withdrawProposal(proposalId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`/proposals/${proposalId}/withdraw`);
  }

  /**
   * Get freelancer's proposals
   */
  async getMyProposals(
    status?: ProposalStatus,
    page?: number,
    limit?: number
  ): Promise<ApiResponse<{ proposals: Proposal[]; total: number }>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));

    return this.httpClient.get<ApiResponse<{ proposals: Proposal[]; total: number }>>(
      `/proposals/me?${params.toString()}`
    );
  }

  /**
   * Accept proposal (client)
   */
  async acceptProposal(proposalId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`/proposals/${proposalId}/accept`);
  }

  /**
   * Reject proposal (client)
   */
  async rejectProposal(proposalId: string, reason?: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`/proposals/${proposalId}/reject`, { reason });
  }

  /**
   * Shortlist proposal (client)
   */
  async shortlistProposal(proposalId: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`/proposals/${proposalId}/shortlist`);
  }

  // ===========================================================================
  // Contracts
  // ===========================================================================

  /**
   * Create contract from proposal
   */
  async createContract(data: CreateContractRequest): Promise<Contract> {
    return this.httpClient.post<Contract>(`/contracts`, data);
  }

  /**
   * Get contract by ID
   */
  async getContract(contractId: string): Promise<Contract> {
    return this.httpClient.get<Contract>(`/contracts/${contractId}`);
  }

  /**
   * Get user's contracts
   */
  async getMyContracts(
    status?: ContractStatus,
    page?: number,
    limit?: number
  ): Promise<ApiResponse<{ contracts: Contract[]; total: number }>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));

    return this.httpClient.get<ApiResponse<{ contracts: Contract[]; total: number }>>(
      `/contracts/me?${params.toString()}`
    );
  }

  /**
   * End contract
   */
  async endContract(contractId: string, reason?: string): Promise<Contract> {
    return this.httpClient.post<Contract>(`/contracts/${contractId}/end`, { reason });
  }

  /**
   * Submit milestone (freelancer)
   */
  async submitMilestone(
    contractId: string,
    milestoneId: string,
    message?: string
  ): Promise<ContractMilestone> {
    return this.httpClient.post<ContractMilestone>(
      `/contracts/${contractId}/milestones/${milestoneId}/submit`,
      { message }
    );
  }

  /**
   * Approve milestone (client)
   */
  async approveMilestone(contractId: string, milestoneId: string): Promise<ContractMilestone> {
    return this.httpClient.post<ContractMilestone>(
      `/contracts/${contractId}/milestones/${milestoneId}/approve`
    );
  }

  /**
   * Request revision on milestone (client)
   */
  async requestRevision(
    contractId: string,
    milestoneId: string,
    feedback: string
  ): Promise<ContractMilestone> {
    return this.httpClient.post<ContractMilestone>(
      `/contracts/${contractId}/milestones/${milestoneId}/revision`,
      { feedback }
    );
  }

  // ===========================================================================
  // Categories
  // ===========================================================================

  /**
   * Get all job categories
   */
  async getCategories(): Promise<JobCategory[]> {
    return this.httpClient.get<JobCategory[]>(`/categories`);
  }

  /**
   * Get popular skills
   */
  async getPopularSkills(categoryId?: string, limit?: number): Promise<string[]> {
    const params = new URLSearchParams();
    if (categoryId) params.append('categoryId', categoryId);
    if (limit) params.append('limit', String(limit));

    return this.httpClient.get<string[]>(`/skills/popular?${params.toString()}`);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createJobServiceClient(
  httpClient: HttpClient,
  basePath?: string
): JobServiceClient {
  return new JobServiceClient(httpClient, basePath);
}
