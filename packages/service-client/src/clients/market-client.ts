/**
 * @module @skillancer/service-client/clients/market-client
 * Market service client for jobs, bids, contracts, and services
 */

import { BaseServiceClient, type ServiceClientConfig, type Pagination } from '../base-client.js';

// ============================================================================
// Types
// ============================================================================

export interface Job {
  id: string;
  clientUserId: string;
  title: string;
  description: string;
  skills: string[];
  budget: {
    type: 'fixed' | 'hourly';
    amount: number;
    currency: string;
    minHours?: number;
    maxHours?: number;
  };
  status: 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled' | 'closed';
  visibility: 'public' | 'private' | 'invite_only';
  category?: string;
  attachments?: Attachment[];
  deadline?: string;
  bidsCount: number;
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface CreateJobInput {
  title: string;
  description: string;
  skills: string[];
  budget: Job['budget'];
  visibility?: Job['visibility'];
  category?: string;
  deadline?: string;
}

export interface UpdateJobInput {
  title?: string;
  description?: string;
  skills?: string[];
  budget?: Partial<Job['budget']>;
  visibility?: Job['visibility'];
  status?: Job['status'];
  deadline?: string;
}

export interface Bid {
  id: string;
  jobId: string;
  freelancerUserId: string;
  amount: number;
  currency: string;
  proposedTimeline: string;
  coverLetter: string;
  status: 'pending' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBidInput {
  amount: number;
  currency: string;
  proposedTimeline: string;
  coverLetter: string;
}

export interface UpdateBidInput {
  amount?: number;
  proposedTimeline?: string;
  coverLetter?: string;
}

export interface Contract {
  id: string;
  jobId: string;
  bidId: string;
  clientUserId: string;
  freelancerUserId: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled' | 'disputed';
  paymentType: 'fixed' | 'hourly';
  startDate: string;
  endDate?: string;
  escrowId?: string;
  milestones?: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  amount: number;
  dueDate?: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected' | 'paid';
}

export interface CreateContractInput {
  bidId: string;
  startDate?: string;
  milestones?: Omit<Milestone, 'id' | 'status'>[];
}

export interface Service {
  id: string;
  freelancerUserId: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
  packages: ServicePackage[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  gallery?: Attachment[];
  rating?: number;
  reviewsCount?: number;
  ordersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServicePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  deliveryDays: number;
  revisions: number;
  features: string[];
}

export interface CreateServiceInput {
  title: string;
  description: string;
  category: string;
  skills: string[];
  packages: Omit<ServicePackage, 'id'>[];
}

// ============================================================================
// Market Service Client
// ============================================================================

export class MarketServiceClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['MARKET_SERVICE_URL'] ?? 'http://market-svc:3002',
      serviceName: 'market-svc',
      timeout: 15000,
      retries: 3,
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        resetTimeout: 30000,
      },
      ...config,
    });
  }

  // ==========================================================================
  // Jobs
  // ==========================================================================

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job> {
    return this.get<Job>(`jobs/${jobId}`);
  }

  /**
   * List jobs with filters
   */
  async listJobs(params?: {
    status?: Job['status'];
    skills?: string[];
    category?: string;
    budgetMin?: number;
    budgetMax?: number;
    clientUserId?: string;
    search?: string;
    pagination?: Pagination;
  }): Promise<{ jobs: Job[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.status) searchParams['status'] = params.status;
    if (params?.skills?.length) searchParams['skills'] = params.skills.join(',');
    if (params?.category) searchParams['category'] = params.category;
    if (params?.budgetMin) searchParams['budgetMin'] = String(params.budgetMin);
    if (params?.budgetMax) searchParams['budgetMax'] = String(params.budgetMax);
    if (params?.clientUserId) searchParams['clientUserId'] = params.clientUserId;
    if (params?.search) searchParams['search'] = params.search;

    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ jobs: Job[]; total: number }>('jobs', { searchParams });
  }

  /**
   * Create a new job
   */
  async createJob(data: CreateJobInput): Promise<Job> {
    return this.post<Job>('jobs', data);
  }

  /**
   * Update job
   */
  async updateJob(jobId: string, data: UpdateJobInput): Promise<Job> {
    return this.patch<Job>(`jobs/${jobId}`, data);
  }

  /**
   * Delete job
   */
  async deleteJob(jobId: string): Promise<void> {
    await this.delete(`jobs/${jobId}`);
  }

  /**
   * Close job to new bids
   */
  async closeJob(jobId: string): Promise<Job> {
    return this.post<Job>(`jobs/${jobId}/close`);
  }

  /**
   * Get recommended jobs for freelancer
   */
  async getRecommendedJobs(
    freelancerUserId: string,
    pagination?: Pagination
  ): Promise<{ jobs: Job[]; total: number }> {
    const searchParams = this.buildPaginationParams(pagination);
    return this.get<{ jobs: Job[]; total: number }>(`jobs/recommended/${freelancerUserId}`, {
      searchParams,
    });
  }

  // ==========================================================================
  // Bids
  // ==========================================================================

  /**
   * Get bid by ID
   */
  async getBid(bidId: string): Promise<Bid> {
    return this.get<Bid>(`bids/${bidId}`);
  }

  /**
   * List bids for a job
   */
  async listJobBids(
    jobId: string,
    params?: {
      status?: Bid['status'];
      pagination?: Pagination;
    }
  ): Promise<{ bids: Bid[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.status) searchParams['status'] = params.status;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ bids: Bid[]; total: number }>(`jobs/${jobId}/bids`, { searchParams });
  }

  /**
   * List bids by freelancer
   */
  async listFreelancerBids(
    freelancerUserId: string,
    params?: {
      status?: Bid['status'];
      pagination?: Pagination;
    }
  ): Promise<{ bids: Bid[]; total: number }> {
    const searchParams: Record<string, string> = {
      freelancerUserId,
    };

    if (params?.status) searchParams['status'] = params.status;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ bids: Bid[]; total: number }>('bids', { searchParams });
  }

  /**
   * Create a bid on a job
   */
  async createBid(jobId: string, data: CreateBidInput): Promise<Bid> {
    return this.post<Bid>(`jobs/${jobId}/bids`, data);
  }

  /**
   * Update bid
   */
  async updateBid(bidId: string, data: UpdateBidInput): Promise<Bid> {
    return this.patch<Bid>(`bids/${bidId}`, data);
  }

  /**
   * Withdraw bid
   */
  async withdrawBid(bidId: string): Promise<Bid> {
    return this.post<Bid>(`bids/${bidId}/withdraw`);
  }

  /**
   * Shortlist bid
   */
  async shortlistBid(bidId: string): Promise<Bid> {
    return this.post<Bid>(`bids/${bidId}/shortlist`);
  }

  /**
   * Accept bid and create contract
   */
  async acceptBid(bidId: string, input?: CreateContractInput): Promise<Contract> {
    return this.post<Contract>(`bids/${bidId}/accept`, input ?? { bidId });
  }

  /**
   * Reject bid
   */
  async rejectBid(bidId: string, reason?: string): Promise<Bid> {
    return this.post<Bid>(`bids/${bidId}/reject`, { reason });
  }

  // ==========================================================================
  // Contracts
  // ==========================================================================

  /**
   * Get contract by ID
   */
  async getContract(contractId: string): Promise<Contract> {
    return this.get<Contract>(`contracts/${contractId}`);
  }

  /**
   * List contracts
   */
  async listContracts(params?: {
    clientUserId?: string;
    freelancerUserId?: string;
    status?: Contract['status'];
    pagination?: Pagination;
  }): Promise<{ contracts: Contract[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.clientUserId) searchParams['clientUserId'] = params.clientUserId;
    if (params?.freelancerUserId) searchParams['freelancerUserId'] = params.freelancerUserId;
    if (params?.status) searchParams['status'] = params.status;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ contracts: Contract[]; total: number }>('contracts', { searchParams });
  }

  /**
   * Create contract directly
   */
  async createContract(data: CreateContractInput): Promise<Contract> {
    return this.post<Contract>('contracts', data);
  }

  /**
   * Cancel contract
   */
  async cancelContract(contractId: string, reason?: string): Promise<Contract> {
    return this.post<Contract>(`contracts/${contractId}/cancel`, { reason });
  }

  /**
   * Complete contract
   */
  async completeContract(contractId: string): Promise<Contract> {
    return this.post<Contract>(`contracts/${contractId}/complete`);
  }

  /**
   * Pause contract
   */
  async pauseContract(contractId: string, reason?: string): Promise<Contract> {
    return this.post<Contract>(`contracts/${contractId}/pause`, { reason });
  }

  /**
   * Resume contract
   */
  async resumeContract(contractId: string): Promise<Contract> {
    return this.post<Contract>(`contracts/${contractId}/resume`);
  }

  // ==========================================================================
  // Milestones
  // ==========================================================================

  /**
   * Add milestone to contract
   */
  async addMilestone(
    contractId: string,
    data: Omit<Milestone, 'id' | 'status'>
  ): Promise<Milestone> {
    return this.post<Milestone>(`contracts/${contractId}/milestones`, data);
  }

  /**
   * Submit milestone for approval
   */
  async submitMilestone(contractId: string, milestoneId: string): Promise<Milestone> {
    return this.post<Milestone>(`contracts/${contractId}/milestones/${milestoneId}/submit`);
  }

  /**
   * Approve milestone
   */
  async approveMilestone(contractId: string, milestoneId: string): Promise<Milestone> {
    return this.post<Milestone>(`contracts/${contractId}/milestones/${milestoneId}/approve`);
  }

  /**
   * Reject milestone
   */
  async rejectMilestone(
    contractId: string,
    milestoneId: string,
    reason?: string
  ): Promise<Milestone> {
    return this.post<Milestone>(`contracts/${contractId}/milestones/${milestoneId}/reject`, {
      reason,
    });
  }

  // ==========================================================================
  // Services (Freelancer offerings)
  // ==========================================================================

  /**
   * Get service by ID
   */
  async getService(serviceId: string): Promise<Service> {
    return this.get<Service>(`services/${serviceId}`);
  }

  /**
   * List services
   */
  async listServices(params?: {
    category?: string;
    skills?: string[];
    freelancerUserId?: string;
    status?: Service['status'];
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    pagination?: Pagination;
  }): Promise<{ services: Service[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.category) searchParams['category'] = params.category;
    if (params?.skills?.length) searchParams['skills'] = params.skills.join(',');
    if (params?.freelancerUserId) searchParams['freelancerUserId'] = params.freelancerUserId;
    if (params?.status) searchParams['status'] = params.status;
    if (params?.minPrice) searchParams['minPrice'] = String(params.minPrice);
    if (params?.maxPrice) searchParams['maxPrice'] = String(params.maxPrice);
    if (params?.search) searchParams['search'] = params.search;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ services: Service[]; total: number }>('services', { searchParams });
  }

  /**
   * Create service
   */
  async createService(data: CreateServiceInput): Promise<Service> {
    return this.post<Service>('services', data);
  }

  /**
   * Update service
   */
  async updateService(serviceId: string, data: Partial<CreateServiceInput>): Promise<Service> {
    return this.patch<Service>(`services/${serviceId}`, data);
  }

  /**
   * Delete service
   */
  async deleteService(serviceId: string): Promise<void> {
    await this.delete(`services/${serviceId}`);
  }
}

// Export singleton instance
export const marketClient = new MarketServiceClient();
