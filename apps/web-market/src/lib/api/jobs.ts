/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Jobs API Client
 *
 * Functions for interacting with the market-svc jobs API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';

// ============================================================================
// Types
// ============================================================================

export interface Job {
  id: string;
  slug: string;
  title: string;
  description: string;
  budgetType: 'FIXED' | 'HOURLY' | 'MONTHLY';
  budgetMin?: number;
  budgetMax?: number;
  estimatedDuration?: number;
  durationUnit?: 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';
  experienceLevel?: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
  visibility: 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'COMPLETED';
  skills: Skill[];
  client: ClientInfo;
  proposalCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];
  questions?: JobQuestion[];
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  category?: string;
}

export interface ClientInfo {
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

export interface Attachment {
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

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  children?: Category[];
  jobCount: number;
}

export interface JobSearchFilters {
  query?: string;
  skills?: string[];
  budgetMin?: number;
  budgetMax?: number;
  budgetType?: 'FIXED' | 'HOURLY' | 'MONTHLY';
  experienceLevel?: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
  category?: string;
  subcategory?: string;
  duration?: string;
  postedWithin?: '24h' | '3d' | 'week' | 'month';
  clientHistory?: 'verified' | 'top' | 'any';
  sortBy?: 'relevance' | 'newest' | 'budget_high' | 'budget_low' | 'bids_count';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface JobSearchResult {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface SmartMatchScore {
  overallScore: number;
  breakdown: {
    skills: number;
    experience: number;
    trust: number;
    rate: number;
    availability: number;
    successHistory: number;
    responsiveness: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: string[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Build URL with query parameters
 */
function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | string[] | undefined>
): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, v));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
  }

  return url.toString();
}

/**
 * Fetch wrapper with error handling
 */
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData: { message?: string } = await response.json().catch(() => ({}));
    throw new Error(errorData.message ?? `API Error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Search jobs with filters and pagination
 */
export async function searchJobs(
  filters: JobSearchFilters = {},
  pagination: PaginationParams = {}
): Promise<JobSearchResult> {
  const { page = 1, limit = 20 } = pagination;

  const url = buildUrl('/projects/search', {
    ...filters,
    page,
    limit,
  });

  const response = await apiFetch<{
    success: boolean;
    jobs: Job[];
    total: number;
    page: number;
    limit: number;
  }>(url);

  const totalPages = Math.ceil(response.total / response.limit);

  return {
    jobs: response.jobs,
    total: response.total,
    page: response.page,
    limit: response.limit,
    totalPages,
    hasMore: response.page < totalPages,
  };
}

/**
 * Get a single job by slug
 */
export async function getJobBySlug(slug: string): Promise<Job> {
  const url = buildUrl(`/projects/${slug}`);
  const response = await apiFetch<{ success: boolean; project: Job }>(url);
  return response.project;
}

/**
 * Get a single job by ID
 */
export async function getJobById(id: string): Promise<Job> {
  const url = buildUrl(`/projects/${id}`);
  const response = await apiFetch<{ success: boolean; project: Job }>(url);
  return response.project;
}

/**
 * Get all job categories
 */
export async function getJobCategories(): Promise<Category[]> {
  const url = buildUrl('/categories');
  const response = await apiFetch<{ success: boolean; categories: Category[] }>(url);
  return response.categories;
}

/**
 * Get saved jobs for the current user
 */
export async function getSavedJobs(
  userId: string,
  pagination: PaginationParams = {}
): Promise<JobSearchResult> {
  const { page = 1, limit = 20 } = pagination;

  const url = buildUrl('/projects/saved', { userId, page, limit });
  const response = await apiFetch<{
    success: boolean;
    jobs: Job[];
    total: number;
    page: number;
    limit: number;
  }>(url);

  const totalPages = Math.ceil(response.total / response.limit);

  return {
    jobs: response.jobs,
    total: response.total,
    page: response.page,
    limit: response.limit,
    totalPages,
    hasMore: response.page < totalPages,
  };
}

/**
 * Save a job to user's saved list
 */
export async function saveJob(jobId: string): Promise<void> {
  const url = buildUrl(`/projects/${jobId}/save`);
  await apiFetch(url, { method: 'POST' });
}

/**
 * Remove a job from user's saved list
 */
export async function unsaveJob(jobId: string): Promise<void> {
  const url = buildUrl(`/projects/${jobId}/save`);
  await apiFetch(url, { method: 'DELETE' });
}

/**
 * Get related/similar jobs
 */
export async function getRelatedJobs(jobId: string, limit: number = 6): Promise<Job[]> {
  const url = buildUrl(`/projects/${jobId}/related`, { limit });
  const response = await apiFetch<{ success: boolean; jobs: Job[] }>(url);
  return response.jobs;
}

/**
 * Get job statistics (proposal count, views, etc.)
 */
export async function getJobStats(jobId: string): Promise<{
  proposalCount: number;
  viewCount: number;
  averageBid: number;
  invitesSent: number;
  interviewsActive: number;
}> {
  const url = buildUrl(`/projects/${jobId}/stats`);
  const response = await apiFetch<{
    success: boolean;
    stats: {
      proposalCount: number;
      viewCount: number;
      averageBid: number;
      invitesSent: number;
      interviewsActive: number;
    };
  }>(url);
  return response.stats;
}

/**
 * Get SmartMatch score for current user against a job
 */
export async function getSmartMatchScore(jobId: string): Promise<SmartMatchScore> {
  const url = buildUrl(`/smartmatch/score/${jobId}`);
  const response = await apiFetch<{ success: boolean; data: SmartMatchScore }>(url);
  return response.data;
}

/**
 * Get skills suggestions for autocomplete
 */
export async function getSkillsSuggestions(query: string): Promise<Skill[]> {
  const url = buildUrl('/skills/search', { query, limit: 10 });
  const response = await apiFetch<{ success: boolean; skills: Skill[] }>(url);
  return response.skills;
}

/**
 * Get featured/promoted jobs for homepage
 */
export async function getFeaturedJobs(limit: number = 6): Promise<Job[]> {
  const url = buildUrl('/projects/featured', { limit });
  const response = await apiFetch<{ success: boolean; jobs: Job[] }>(url);
  return response.jobs;
}

/**
 * Get job categories with counts for homepage
 */
export async function getTopCategories(limit: number = 8): Promise<Category[]> {
  const url = buildUrl('/categories/top', { limit });
  const response = await apiFetch<{ success: boolean; categories: Category[] }>(url);
  return response.categories;
}
