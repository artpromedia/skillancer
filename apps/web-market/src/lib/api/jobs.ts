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
  status: 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'COMPLETED' | 'OPEN';
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
  location?: string;
  remoteOnly?: boolean;
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

// ============================================================================
// Job Creation & Management (Client-side)
// ============================================================================

/**
 * Input for creating a new job
 */
export interface CreateJobInput {
  title: string;
  description: string;
  budgetType: 'FIXED' | 'HOURLY' | 'MONTHLY';
  budgetMin?: number;
  budgetMax?: number;
  estimatedDuration?: number;
  durationUnit?: 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';
  experienceLevel?: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';
  skills: string[]; // skill IDs
  categoryId?: string;
  questions?: Omit<JobQuestion, 'id'>[];
  attachments?: string[]; // attachment IDs
  isDraft?: boolean;
}

/**
 * Input for updating an existing job
 */
export interface UpdateJobInput {
  title?: string;
  description?: string;
  budgetType?: 'FIXED' | 'HOURLY' | 'MONTHLY';
  budgetMin?: number;
  budgetMax?: number;
  estimatedDuration?: number;
  durationUnit?: 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';
  experienceLevel?: 'ENTRY' | 'INTERMEDIATE' | 'EXPERT';
  visibility?: 'PUBLIC' | 'PRIVATE' | 'INVITE_ONLY';
  skills?: string[]; // skill IDs
  categoryId?: string;
  questions?: Omit<JobQuestion, 'id'>[];
  attachments?: string[]; // attachment IDs
}

/**
 * Create a new job posting
 */
export async function createJob(input: CreateJobInput): Promise<Job> {
  const url = buildUrl('/projects');
  const response = await apiFetch<{ success: boolean; project: Job }>(url, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.project;
}

/**
 * Update an existing job posting
 */
export async function updateJob(jobId: string, input: UpdateJobInput): Promise<Job> {
  const url = buildUrl(`/projects/${jobId}`);
  const response = await apiFetch<{ success: boolean; project: Job }>(url, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return response.project;
}

/**
 * Close a job posting (no longer accepting proposals)
 */
export async function closeJob(jobId: string, reason?: string): Promise<Job> {
  const url = buildUrl(`/projects/${jobId}/close`);
  const response = await apiFetch<{ success: boolean; project: Job }>(url, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
  return response.project;
}

/**
 * Reopen a closed job posting
 */
export async function reopenJob(jobId: string): Promise<Job> {
  const url = buildUrl(`/projects/${jobId}/reopen`);
  const response = await apiFetch<{ success: boolean; project: Job }>(url, {
    method: 'PATCH',
  });
  return response.project;
}

/**
 * Delete a job posting (draft only)
 */
export async function deleteJob(jobId: string): Promise<void> {
  const url = buildUrl(`/projects/${jobId}`);
  await apiFetch<{ success: boolean }>(url, {
    method: 'DELETE',
  });
}

/**
 * Pause a job posting (temporarily stop accepting proposals)
 */
export async function pauseJob(jobId: string): Promise<Job> {
  const url = buildUrl(`/projects/${jobId}/pause`);
  const response = await apiFetch<{ success: boolean; project: Job }>(url, {
    method: 'PATCH',
  });
  return response.project;
}

/**
 * Resume a paused job posting
 */
export async function resumeJob(jobId: string): Promise<Job> {
  const url = buildUrl(`/projects/${jobId}/resume`);
  const response = await apiFetch<{ success: boolean; project: Job }>(url, {
    method: 'PATCH',
  });
  return response.project;
}

/**
 * Publish a draft job posting
 */
export async function publishJob(jobId: string): Promise<Job> {
  const url = buildUrl(`/projects/${jobId}/publish`);
  const response = await apiFetch<{ success: boolean; project: Job }>(url, {
    method: 'PATCH',
  });
  return response.project;
}

/**
 * Get jobs posted by the current user (client)
 */
export async function getMyPostedJobs(
  filters: { status?: Job['status']; sortBy?: 'newest' | 'oldest' | 'proposals' } = {},
  pagination: PaginationParams = {}
): Promise<JobSearchResult> {
  const { page = 1, limit = 20 } = pagination;

  const url = buildUrl('/projects/my-postings', {
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

// ============================================================================
// Search Analytics & Suggestions
// ============================================================================

export interface SearchAnalyticsEvent {
  query: string;
  filters: JobSearchFilters;
  resultsCount: number;
  timestamp: string;
  sessionId?: string;
}

export interface SearchSuggestion {
  type: 'skill' | 'category' | 'query' | 'related';
  text: string;
  count?: number;
}

export interface LocationSuggestion {
  id: string;
  name: string;
  type: 'city' | 'state' | 'country' | 'region';
  country?: string;
  countryCode?: string;
}

/**
 * Track search analytics for insights
 */
export async function trackSearchAnalytics(event: SearchAnalyticsEvent): Promise<void> {
  try {
    const url = buildUrl('/analytics/search');
    await apiFetch<{ success: boolean }>(url, {
      method: 'POST',
      body: JSON.stringify(event),
    });
  } catch {
    // Silent fail for analytics - don't block user experience
  }
}

/**
 * Get search suggestions based on query prefix (autocomplete)
 */
export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (query.length < 2) return [];

  const url = buildUrl('/search/suggestions', { q: query, limit: 8 });
  const response = await apiFetch<{ success: boolean; suggestions: SearchSuggestion[] }>(url);
  return response.suggestions;
}

/**
 * Get location suggestions for autocomplete
 */
export async function getLocationSuggestions(query: string): Promise<LocationSuggestion[]> {
  if (query.length < 2) return [];

  const url = buildUrl('/locations/search', { q: query, limit: 8 });
  const response = await apiFetch<{ success: boolean; locations: LocationSuggestion[] }>(url);
  return response.locations;
}

/**
 * Get "no results" suggestions based on search context
 */
export async function getNoResultsSuggestions(filters: JobSearchFilters): Promise<{
  alternativeQueries: string[];
  relatedCategories: { id: string; name: string; jobCount: number }[];
  popularSkills: { id: string; name: string; jobCount: number }[];
  broaderSearchTips: string[];
}> {
  const url = buildUrl('/search/no-results-help', {
    query: filters.query,
    category: filters.category,
    skills: filters.skills,
  });

  try {
    const response = await apiFetch<{
      success: boolean;
      data: {
        alternativeQueries: string[];
        relatedCategories: { id: string; name: string; jobCount: number }[];
        popularSkills: { id: string; name: string; jobCount: number }[];
        broaderSearchTips: string[];
      };
    }>(url);
    return response.data;
  } catch {
    // Return default suggestions on error
    return {
      alternativeQueries: [],
      relatedCategories: [],
      popularSkills: [],
      broaderSearchTips: [
        'Try using fewer filters',
        'Use more general search terms',
        'Check your spelling',
        'Browse job categories instead',
      ],
    };
  }
}

/**
 * Get popular/trending searches
 */
export async function getTrendingSearches(): Promise<
  { query: string; searchCount: number; trend: 'up' | 'stable' | 'down' }[]
> {
  const url = buildUrl('/search/trending');
  const response = await apiFetch<{
    success: boolean;
    searches: { query: string; searchCount: number; trend: 'up' | 'stable' | 'down' }[];
  }>(url);
  return response.searches;
}
