/**
 * Jobs Service Module
 *
 * Type-safe API methods for job CRUD operations using the shared API client.
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

export type BudgetType = 'FIXED' | 'HOURLY' | 'MONTHLY';
export type DurationUnit = 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';
export type ExperienceLevel = 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
export type JobVisibility = 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';
export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'COMPLETED' | 'OPEN';

export interface JobSkill {
  id: string;
  name: string;
  slug: string;
  category?: string;
}

export interface JobClient {
  id: string;
  name: string;
  avatarUrl?: string;
  country?: string;
  countryCode?: string;
  totalSpent: number;
  hireRate: number;
  jobsPosted: number;
  reviewScore?: number;
  reviewCount: number;
  memberSince: string;
  isPaymentVerified: boolean;
  isIdentityVerified: boolean;
}

export interface JobAttachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  mimeType?: string;
}

export interface JobQuestion {
  id: string;
  question: string;
  isRequired: boolean;
}

export interface Job {
  id: string;
  slug: string;
  title: string;
  description: string;
  budgetType: BudgetType;
  budgetMin?: number;
  budgetMax?: number;
  estimatedDuration?: number;
  durationUnit?: DurationUnit;
  experienceLevel?: ExperienceLevel;
  visibility: JobVisibility;
  status: JobStatus;
  skills: JobSkill[];
  client: JobClient;
  proposalCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  attachments?: JobAttachment[];
  questions?: JobQuestion[];
}

export interface JobSearchFilters {
  query?: string;
  skills?: string[];
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: BudgetType;
  experienceLevel?: ExperienceLevel;
  category?: string;
  subcategory?: string;
  duration?: string;
  postedWithin?: '24h' | '3d' | 'week' | 'month';
  clientHistory?: 'verified' | 'top' | 'any';
  sortBy?: 'relevance' | 'newest' | 'budget_high' | 'budget_low' | 'bids_count';
  sortOrder?: 'asc' | 'desc';
}

export interface JobSearchParams extends JobSearchFilters {
  page?: number;
  limit?: number;
}

export interface CreateJobInput {
  title: string;
  description: string;
  budgetType: BudgetType;
  budgetMin?: number;
  budgetMax?: number;
  estimatedDuration?: number;
  durationUnit?: DurationUnit;
  experienceLevel?: ExperienceLevel;
  visibility?: JobVisibility;
  skills: string[];
  attachments?: string[];
  questions?: Omit<JobQuestion, 'id'>[];
}

export interface UpdateJobInput {
  title?: string;
  description?: string;
  budgetType?: BudgetType;
  budgetMin?: number;
  budgetMax?: number;
  estimatedDuration?: number;
  durationUnit?: DurationUnit;
  experienceLevel?: ExperienceLevel;
  visibility?: JobVisibility;
  status?: JobStatus;
  skills?: string[];
  attachments?: string[];
  questions?: Omit<JobQuestion, 'id'>[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  children?: Category[];
  jobCount: number;
}

// =============================================================================
// Jobs API Service
// =============================================================================

export const jobsService = {
  /**
   * Search jobs with filters and pagination
   */
  async search(params: JobSearchParams = {}): Promise<PaginatedResponse<Job>> {
    const client = getApiClient();
    const { page = 1, limit = 20, skills, ...filters } = params;

    // Build query params without array values
    const queryParams: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      ...filters,
    };

    // Handle arrays - convert to comma-separated strings
    if (skills?.length) {
      queryParams.skills = skills.join(',');
    }

    return client.get<Job[]>(MARKET_ENDPOINTS.JOB_SEARCH, {
      params: queryParams,
    }) as Promise<PaginatedResponse<Job>>;
  },

  /**
   * Get a single job by ID
   */
  async getById(id: string): Promise<ApiResponse<Job>> {
    const client = getApiClient();
    return client.get<Job>(MARKET_ENDPOINTS.JOB_BY_ID(id));
  },

  /**
   * Get a single job by slug
   */
  async getBySlug(slug: string): Promise<ApiResponse<Job>> {
    const client = getApiClient();
    return client.get<Job>(`${MARKET_ENDPOINTS.JOBS}/slug/${slug}`);
  },

  /**
   * Get all jobs (with optional filters)
   */
  async getAll(params: JobSearchParams = {}): Promise<PaginatedResponse<Job>> {
    const client = getApiClient();
    const { page = 1, limit = 20, skills, ...filters } = params;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      ...filters,
    };

    // Handle arrays - convert to comma-separated strings
    if (skills?.length) {
      queryParams.skills = skills.join(',');
    }

    return client.get<Job[]>(MARKET_ENDPOINTS.JOBS, {
      params: queryParams,
    }) as Promise<PaginatedResponse<Job>>;
  },

  /**
   * Get featured jobs
   */
  async getFeatured(limit = 6): Promise<ApiResponse<Job[]>> {
    const client = getApiClient();
    return client.get<Job[]>(MARKET_ENDPOINTS.FEATURED_JOBS, {
      params: { limit },
    });
  },

  /**
   * Get recommended jobs for current user
   */
  async getRecommended(limit = 10): Promise<ApiResponse<Job[]>> {
    const client = getApiClient();
    return client.get<Job[]>(MARKET_ENDPOINTS.RECOMMENDED_JOBS, {
      params: { limit },
    });
  },

  /**
   * Get my posted jobs (for clients)
   */
  async getMyJobs(
    params: { page?: number; limit?: number; status?: JobStatus } = {}
  ): Promise<PaginatedResponse<Job>> {
    const client = getApiClient();
    return client.get<Job[]>(MARKET_ENDPOINTS.MY_JOBS, {
      params: params,
    }) as Promise<PaginatedResponse<Job>>;
  },

  /**
   * Create a new job
   */
  async create(data: CreateJobInput): Promise<ApiResponse<Job>> {
    const client = getApiClient();
    return client.post<Job, CreateJobInput>(MARKET_ENDPOINTS.JOBS, data);
  },

  /**
   * Update an existing job
   */
  async update(id: string, data: UpdateJobInput): Promise<ApiResponse<Job>> {
    const client = getApiClient();
    return client.patch<Job, UpdateJobInput>(MARKET_ENDPOINTS.JOB_BY_ID(id), data);
  },

  /**
   * Delete a job (or close it)
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(MARKET_ENDPOINTS.JOB_BY_ID(id));
  },

  /**
   * Publish a draft job
   */
  async publish(id: string): Promise<ApiResponse<Job>> {
    const client = getApiClient();
    return client.patch<Job, { status: JobStatus }>(MARKET_ENDPOINTS.JOB_BY_ID(id), {
      status: 'PUBLISHED',
    });
  },

  /**
   * Pause a published job
   */
  async pause(id: string): Promise<ApiResponse<Job>> {
    const client = getApiClient();
    return client.patch<Job, { status: JobStatus }>(MARKET_ENDPOINTS.JOB_BY_ID(id), {
      status: 'PAUSED',
    });
  },

  /**
   * Close a job
   */
  async close(id: string): Promise<ApiResponse<Job>> {
    const client = getApiClient();
    return client.patch<Job, { status: JobStatus }>(MARKET_ENDPOINTS.JOB_BY_ID(id), {
      status: 'CLOSED',
    });
  },

  /**
   * Get job categories
   */
  async getCategories(): Promise<ApiResponse<Category[]>> {
    const client = getApiClient();
    return client.get<Category[]>(MARKET_ENDPOINTS.CATEGORIES);
  },

  /**
   * Get skills list
   */
  async getSkills(query?: string): Promise<ApiResponse<JobSkill[]>> {
    const client = getApiClient();
    return client.get<JobSkill[]>(MARKET_ENDPOINTS.SKILLS, {
      params: query ? { q: query } : undefined,
    });
  },

  /**
   * Get popular skills
   */
  async getPopularSkills(limit = 20): Promise<ApiResponse<JobSkill[]>> {
    const client = getApiClient();
    return client.get<JobSkill[]>(MARKET_ENDPOINTS.POPULAR_SKILLS, {
      params: { limit },
    });
  },
};

export default jobsService;
