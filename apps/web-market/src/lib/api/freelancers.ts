/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Freelancers API Client
 *
 * Functions for interacting with market-svc and auth-svc for freelancer profiles
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'http://localhost:4000/api/v1';

// ============================================================================
// Types
// ============================================================================

export type VerificationLevel = 'NONE' | 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM';
export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type AvailabilityStatus = 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'NOT_AVAILABLE';
export type CredentialSource = 'SKILLPOD' | 'EXTERNAL' | 'MANUAL';
export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING_RENEWAL';

export interface FreelancerSkill {
  id: string;
  skillId: string;
  name: string;
  slug: string;
  category?: string;
  proficiencyLevel: ProficiencyLevel;
  yearsOfExperience: number;
  isPrimary: boolean;
  isVerified: boolean;
  verificationSource?: 'SKILLPOD_ASSESSMENT' | 'ENDORSEMENT' | 'PROJECT';
  assessmentScore?: number;
  assessmentPercentile?: number;
  confidenceScore: number;
  endorsementCount: number;
  lastVerifiedAt?: string;
}

export interface FreelancerCredential {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  expirationDate?: string;
  source: CredentialSource;
  status: CredentialStatus;
  verificationUrl?: string;
  verificationCode?: string;
  isVerified: boolean;
  imageUrl?: string;
  badgeUrl?: string;
  associatedSkills: string[];
  score?: number;
  percentile?: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  mediaUrls: string[];
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK';
  externalUrl?: string;
  skills: string[];
  clientName?: string;
  clientTestimonial?: string;
  projectDate?: string;
  isFeatured: boolean;
  viewCount: number;
  displayOrder: number;
  createdAt: string;
}

export interface WorkHistoryItem {
  id: string;
  type: 'PLATFORM' | 'EXTERNAL';
  companyName: string;
  role: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
  skills: string[];
  contractId?: string;
  rating?: number;
  feedback?: string;
  feedbackPrivate?: boolean;
  earnings?: number;
}

export interface FreelancerReview {
  id: string;
  contractId: string;
  projectTitle: string;
  clientId: string;
  clientName: string;
  clientAvatarUrl?: string;
  rating: number;
  ratings: {
    communication: number;
    quality: number;
    expertise: number;
    professionalism: number;
    timeliness: number;
  };
  content: string;
  response?: {
    content: string;
    createdAt: string;
  };
  helpfulCount: number;
  createdAt: string;
}

export interface FreelancerStats {
  totalJobs: number;
  completedJobs: number;
  totalEarnings: number;
  avgRating: number;
  totalReviews: number;
  responseTime: number; // in hours
  onTimeDelivery: number; // percentage
  repeatClients: number; // percentage
  jobSuccessRate: number; // percentage
}

export interface FreelancerProfile {
  id: string;
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl?: string;
  title: string;
  bio: string;
  headline?: string;
  location?: string;
  country?: string;
  countryCode?: string;
  timezone: string;
  hourlyRate?: number;
  currency: string;
  memberSince: string;
  lastActiveAt: string;
  isOnline: boolean;

  // Verification
  verificationLevel: VerificationLevel;
  isIdentityVerified: boolean;
  isPaymentVerified: boolean;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;

  // Badges
  badges: FreelancerBadge[];

  // Availability
  availability: AvailabilityStatus;
  hoursPerWeek: number;
  preferredWorkingHours?: {
    start: string;
    end: string;
    timezone: string;
  };

  // Stats
  stats: FreelancerStats;

  // Skills (summary)
  primarySkills: FreelancerSkill[];
  totalSkills: number;

  // Portfolio (summary)
  featuredPortfolio: PortfolioItem[];
  totalPortfolioItems: number;

  // SEO
  profileUrl: string;
  metaTitle?: string;
  metaDescription?: string;
}

export interface FreelancerBadge {
  id: string;
  type: 'RISING_TALENT' | 'TOP_RATED' | 'TOP_RATED_PLUS' | 'EXPERT_VETTED' | 'SKILL_CERTIFIED';
  name: string;
  description: string;
  iconUrl?: string;
  awardedAt: string;
  expiresAt?: string;
}

export interface FreelancerListItem {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  title: string;
  location?: string;
  countryCode?: string;
  hourlyRate?: number;
  currency: string;
  verificationLevel: VerificationLevel;
  isIdentityVerified: boolean;
  availability: AvailabilityStatus;
  avgRating: number;
  totalReviews: number;
  totalJobs: number;
  jobSuccessRate: number;
  primarySkills: { id: string; name: string; isVerified: boolean }[];
  badges: { type: string; name: string }[];
  isOnline: boolean;
  profileUrl: string;
}

export interface FreelancerSearchFilters {
  query?: string;
  skills?: string[];
  categories?: string[];
  minRate?: number;
  maxRate?: number;
  location?: string;
  country?: string;
  verificationLevel?: VerificationLevel;
  availability?: AvailabilityStatus;
  minRating?: number;
  minJobs?: number;
  hasPortfolio?: boolean;
  languages?: string[];
}

export type FreelancerSortBy =
  | 'relevance'
  | 'rating'
  | 'hourlyRate'
  | 'jobsCompleted'
  | 'recentlyActive';

export interface FreelancerSearchParams extends FreelancerSearchFilters {
  sortBy?: FreelancerSortBy;
  page?: number;
  limit?: number;
}

export interface FreelancerSearchResponse {
  freelancers: FreelancerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: {
    skills: { id: string; name: string; count: number }[];
    locations: { country: string; countryCode: string; count: number }[];
    rateRanges: { min: number; max: number; count: number }[];
  };
}

export interface ReviewsResponse {
  reviews: FreelancerReview[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  avgRatings: {
    overall: number;
    communication: number;
    quality: number;
    expertise: number;
    professionalism: number;
    timeliness: number;
  };
}

export interface VerificationStatus {
  level: VerificationLevel;
  identityVerified: boolean;
  identityVerifiedAt?: string;
  paymentVerified: boolean;
  paymentVerifiedAt?: string;
  phoneVerified: boolean;
  phoneVerifiedAt?: string;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  pendingVerification?: {
    inquiryId: string;
    tier: 'BASIC' | 'ENHANCED' | 'PREMIUM';
    status: 'pending' | 'completed' | 'failed' | 'expired';
    startedAt: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData: { message?: string } = await response.json().catch(() => ({}));
    throw new Error(errorData.message ?? `API Error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, String(v)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  return searchParams.toString();
}

// ============================================================================
// API Functions - Public Profile
// ============================================================================

/**
 * Get freelancer profile by username
 */
export async function getFreelancerByUsername(username: string): Promise<FreelancerProfile> {
  return apiFetch<FreelancerProfile>(`${API_BASE_URL}/profiles/${username}`);
}

/**
 * Get freelancer profile by ID
 */
export async function getFreelancerById(id: string): Promise<FreelancerProfile> {
  return apiFetch<FreelancerProfile>(`${API_BASE_URL}/profiles/id/${id}`);
}

/**
 * Search freelancers with filters
 */
export async function searchFreelancers(
  params: FreelancerSearchParams
): Promise<FreelancerSearchResponse> {
  const queryString = buildQueryString(params as Record<string, unknown>);
  return apiFetch<FreelancerSearchResponse>(`${API_BASE_URL}/profiles/search?${queryString}`);
}

/**
 * Get freelancer skills with verification data
 */
export async function getFreelancerSkills(userId: string): Promise<FreelancerSkill[]> {
  return apiFetch<FreelancerSkill[]>(`${API_BASE_URL}/profiles/${userId}/skills`);
}

/**
 * Get freelancer credentials
 */
export async function getFreelancerCredentials(userId: string): Promise<FreelancerCredential[]> {
  return apiFetch<FreelancerCredential[]>(`${API_BASE_URL}/credentials/user/${userId}`);
}

/**
 * Get freelancer portfolio items
 */
export async function getFreelancerPortfolio(userId: string): Promise<PortfolioItem[]> {
  return apiFetch<PortfolioItem[]>(`${API_BASE_URL}/profiles/${userId}/portfolio`);
}

/**
 * Get single portfolio item
 */
export async function getPortfolioItem(userId: string, itemId: string): Promise<PortfolioItem> {
  return apiFetch<PortfolioItem>(`${API_BASE_URL}/profiles/${userId}/portfolio/${itemId}`);
}

/**
 * Get freelancer work history
 */
export async function getFreelancerWorkHistory(userId: string): Promise<WorkHistoryItem[]> {
  return apiFetch<WorkHistoryItem[]>(`${API_BASE_URL}/profiles/${userId}/work-history`);
}

/**
 * Get freelancer reviews with pagination
 */
export async function getFreelancerReviews(
  userId: string,
  params: { page?: number; limit?: number; rating?: number; sortBy?: 'recent' | 'helpful' } = {}
): Promise<ReviewsResponse> {
  const queryString = buildQueryString(params);
  return apiFetch<ReviewsResponse>(`${API_BASE_URL}/profiles/${userId}/reviews?${queryString}`);
}

/**
 * Get similar freelancers (SmartMatch based)
 */
export async function getSimilarFreelancers(
  userId: string,
  limit = 4
): Promise<FreelancerListItem[]> {
  return apiFetch<FreelancerListItem[]>(
    `${API_BASE_URL}/profiles/${userId}/similar?limit=${limit}`
  );
}

// ============================================================================
// API Functions - Profile Management (Authenticated)
// ============================================================================

/**
 * Get current user's profile
 */
export async function getMyProfile(token: string): Promise<FreelancerProfile> {
  return apiFetch<FreelancerProfile>(`${API_BASE_URL}/profiles/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Update profile
 */
export async function updateProfile(
  token: string,
  data: Partial<{
    title: string;
    bio: string;
    headline: string;
    hourlyRate: number;
    location: string;
    timezone: string;
    availability: AvailabilityStatus;
    hoursPerWeek: number;
    preferredWorkingHours: { start: string; end: string; timezone: string };
  }>
): Promise<FreelancerProfile> {
  return apiFetch<FreelancerProfile>(`${API_BASE_URL}/profiles/me`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/**
 * Upload avatar
 */
export async function uploadAvatar(token: string, file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch(`${API_BASE_URL}/profiles/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload avatar');
  }

  return response.json() as Promise<{ avatarUrl: string }>;
}

/**
 * Add skill to profile
 */
export async function addSkill(
  token: string,
  data: {
    skillId: string;
    proficiencyLevel: ProficiencyLevel;
    yearsOfExperience: number;
    isPrimary?: boolean;
  }
): Promise<FreelancerSkill> {
  return apiFetch<FreelancerSkill>(`${API_BASE_URL}/profiles/me/skills`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/**
 * Update skill on profile
 */
export async function updateSkill(
  token: string,
  skillId: string,
  data: Partial<{
    proficiencyLevel: ProficiencyLevel;
    yearsOfExperience: number;
    isPrimary: boolean;
  }>
): Promise<FreelancerSkill> {
  return apiFetch<FreelancerSkill>(`${API_BASE_URL}/profiles/me/skills/${skillId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/**
 * Remove skill from profile
 */
export async function removeSkill(token: string, skillId: string): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/profiles/me/skills/${skillId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Reorder skills
 */
export async function reorderSkills(token: string, skillIds: string[]): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/profiles/me/skills/reorder`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ skillIds }),
  });
}

/**
 * Add portfolio item
 */
export async function addPortfolioItem(
  token: string,
  data: {
    title: string;
    description: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK';
    externalUrl?: string;
    skills: string[];
    clientName?: string;
    clientTestimonial?: string;
    projectDate?: string;
    isFeatured?: boolean;
  }
): Promise<PortfolioItem> {
  return apiFetch<PortfolioItem>(`${API_BASE_URL}/profiles/me/portfolio`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/**
 * Upload portfolio media
 */
export async function uploadPortfolioMedia(
  token: string,
  portfolioId: string,
  files: File[]
): Promise<{ mediaUrls: string[]; thumbnailUrl: string }> {
  const formData = new FormData();
  files.forEach((file) => formData.append('media', file));

  const response = await fetch(`${API_BASE_URL}/profiles/me/portfolio/${portfolioId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload portfolio media');
  }

  return response.json() as Promise<{ mediaUrls: string[]; thumbnailUrl: string }>;
}

/**
 * Update portfolio item
 */
export async function updatePortfolioItem(
  token: string,
  itemId: string,
  data: Partial<PortfolioItem>
): Promise<PortfolioItem> {
  return apiFetch<PortfolioItem>(`${API_BASE_URL}/profiles/me/portfolio/${itemId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/**
 * Delete portfolio item
 */
export async function deletePortfolioItem(token: string, itemId: string): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/profiles/me/portfolio/${itemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Reorder portfolio items
 */
export async function reorderPortfolioItems(token: string, itemIds: string[]): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/profiles/me/portfolio/reorder`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ itemIds }),
  });
}

/**
 * Add work history item
 */
export async function addWorkHistoryItem(
  token: string,
  data: Omit<WorkHistoryItem, 'id' | 'type' | 'contractId' | 'rating' | 'feedback' | 'earnings'>
): Promise<WorkHistoryItem> {
  return apiFetch<WorkHistoryItem>(`${API_BASE_URL}/profiles/me/work-history`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/**
 * Update work history item
 */
export async function updateWorkHistoryItem(
  token: string,
  itemId: string,
  data: Partial<WorkHistoryItem>
): Promise<WorkHistoryItem> {
  return apiFetch<WorkHistoryItem>(`${API_BASE_URL}/profiles/me/work-history/${itemId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

/**
 * Delete work history item
 */
export async function deleteWorkHistoryItem(token: string, itemId: string): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/profiles/me/work-history/${itemId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ============================================================================
// API Functions - Verification (Auth Service)
// ============================================================================

/**
 * Get current verification status
 */
export async function getVerificationStatus(token: string): Promise<VerificationStatus> {
  return apiFetch<VerificationStatus>(`${AUTH_API_URL}/verification/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Start identity verification flow
 */
export async function startVerification(
  token: string,
  tier: 'BASIC' | 'ENHANCED' | 'PREMIUM'
): Promise<{
  inquiryId: string;
  sessionToken: string;
  templateId: string;
}> {
  return apiFetch<{ inquiryId: string; sessionToken: string; templateId: string }>(
    `${AUTH_API_URL}/verification/start`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tier }),
    }
  );
}

/**
 * Check verification inquiry status
 */
export async function checkVerificationInquiry(
  token: string,
  inquiryId: string
): Promise<{
  status: 'pending' | 'completed' | 'failed' | 'expired';
  level?: VerificationLevel;
  completedAt?: string;
}> {
  return apiFetch<{
    status: 'pending' | 'completed' | 'failed' | 'expired';
    level?: VerificationLevel;
    completedAt?: string;
  }>(`${AUTH_API_URL}/verification/status/${inquiryId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Get user verification level (public)
 */
export async function getUserVerificationLevel(
  userId: string
): Promise<{ level: VerificationLevel; verifiedAt?: string }> {
  return apiFetch<{ level: VerificationLevel; verifiedAt?: string }>(
    `${AUTH_API_URL}/users/${userId}/verification-level`
  );
}

// ============================================================================
// Profile Completeness
// ============================================================================

export interface ProfileCompleteness {
  percentage: number;
  sections: {
    basicInfo: { complete: boolean; weight: number };
    avatar: { complete: boolean; weight: number };
    title: { complete: boolean; weight: number };
    bio: { complete: boolean; weight: number };
    skills: { complete: boolean; weight: number; count: number; minimum: number };
    portfolio: { complete: boolean; weight: number; count: number; minimum: number };
    workHistory: { complete: boolean; weight: number; count: number; minimum: number };
    hourlyRate: { complete: boolean; weight: number };
    verification: { complete: boolean; weight: number };
  };
  suggestions: string[];
}

/**
 * Calculate profile completeness
 */
export function calculateProfileCompleteness(
  profile: FreelancerProfile,
  skills: FreelancerSkill[],
  portfolio: PortfolioItem[],
  workHistory: WorkHistoryItem[]
): ProfileCompleteness {
  const sections = {
    basicInfo: {
      complete: Boolean(profile.firstName && profile.lastName),
      weight: 10,
    },
    avatar: {
      complete: Boolean(profile.avatarUrl),
      weight: 10,
    },
    title: {
      complete: Boolean(profile.title && profile.title.length >= 10),
      weight: 10,
    },
    bio: {
      complete: Boolean(profile.bio && profile.bio.length >= 100),
      weight: 15,
    },
    skills: {
      complete: skills.length >= 3,
      weight: 20,
      count: skills.length,
      minimum: 3,
    },
    portfolio: {
      complete: portfolio.length >= 1,
      weight: 15,
      count: portfolio.length,
      minimum: 1,
    },
    workHistory: {
      complete: workHistory.length >= 1,
      weight: 10,
      count: workHistory.length,
      minimum: 1,
    },
    hourlyRate: {
      complete: Boolean(profile.hourlyRate && profile.hourlyRate > 0),
      weight: 5,
    },
    verification: {
      complete: profile.verificationLevel !== 'NONE' && profile.verificationLevel !== 'EMAIL',
      weight: 5,
    },
  };

  const percentage = Object.values(sections).reduce((acc, section) => {
    return acc + (section.complete ? section.weight : 0);
  }, 0);

  const suggestions: string[] = [];
  if (!sections.avatar.complete) suggestions.push('Add a professional profile photo');
  if (!sections.title.complete)
    suggestions.push('Add a professional title (at least 10 characters)');
  if (!sections.bio.complete) suggestions.push('Write a detailed bio (at least 100 characters)');
  if (!sections.skills.complete) suggestions.push(`Add at least ${sections.skills.minimum} skills`);
  if (!sections.portfolio.complete) suggestions.push('Add at least one portfolio item');
  if (!sections.workHistory.complete) suggestions.push('Add your work experience');
  if (!sections.hourlyRate.complete) suggestions.push('Set your hourly rate');
  if (!sections.verification.complete)
    suggestions.push('Complete identity verification for more trust');

  return { percentage, sections, suggestions };
}
