/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Freelancers API Client
 *
 * Functions for interacting with market-svc and auth-svc for freelancer profiles
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/market';
const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL ?? 'http://localhost:4000/api/auth';

// ============================================================================
// Types
// ============================================================================

export type VerificationLevel = 'NONE' | 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM';
export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type AvailabilityStatus = 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'NOT_AVAILABLE';
export type CredentialSource = 'SKILLPOD' | 'EXTERNAL' | 'MANUAL';
export type CredentialStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING_RENEWAL';
export type PortfolioItemType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK';
export type VerificationTier = 'BASIC' | 'ENHANCED' | 'PREMIUM';
export type VerificationProgressStatus = 'pending' | 'completed' | 'failed' | 'expired';

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
  description?: string;
  thumbnailUrl?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  images?: string[];
  type: PortfolioItemType;
  mediaType?: PortfolioItemType;
  projectUrl?: string;
  externalUrl?: string;
  category?: string;
  tags?: string[];
  skills?: string[];
  client?: string;
  clientName?: string;
  role?: string;
  duration?: string;
  clientTestimonial?: string;
  projectDate?: string;
  isFeatured: boolean;
  viewCount?: number;
  displayOrder?: number;
  createdAt?: string;
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

  // Social Links
  socialLinks?: {
    linkedIn?: string;
    github?: string;
    twitter?: string;
    website?: string;
  };

  // Work History
  workHistory?: WorkHistoryItem[];

  // Verification (detailed)
  verification?: {
    identity: boolean;
    email: boolean;
    phone: boolean;
    payment: boolean;
    premium: boolean;
    level: VerificationLevel;
  };

  // Last seen
  lastSeen?: string;

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

/**
 * Data structure for updating freelancer profile
 */
export interface UpdateProfileData {
  displayName?: string;
  title?: string;
  bio?: string;
  headline?: string;
  hourlyRate?: number;
  location?: string;
  country?: string;
  timezone?: string;
  availability?: AvailabilityStatus;
  hoursPerWeek?: number;
  preferredWorkingHours?: { start: string; end: string; timezone: string };
  socialLinks?: {
    linkedIn?: string;
    github?: string;
    twitter?: string;
    website?: string;
  };
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
    tier: VerificationTier;
    status: VerificationProgressStatus;
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

  const stringifyValue = (val: unknown): string => {
    if (typeof val === 'object' && val !== null) {
      return JSON.stringify(val);
    }
    // Only stringify primitive types that can safely be converted
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }
    return '';
  };

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParams.append(key, stringifyValue(v)));
      } else {
        searchParams.append(key, stringifyValue(value));
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
  data: UpdateProfileData
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
    description?: string;
    type?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK';
    mediaType?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK';
    thumbnailUrl?: string;
    mediaUrl?: string;
    projectUrl?: string;
    externalUrl?: string;
    category?: string;
    tags?: string[];
    skills?: string[];
    client?: string;
    clientName?: string;
    role?: string;
    duration?: string;
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
// Simplified Portfolio Functions (for components without token context)
// ============================================================================

/**
 * Get current user's portfolio items (simplified - uses stored token)
 */
export async function getMyPortfolio(): Promise<{ items: PortfolioItem[] }> {
  const token = globalThis.window ? (localStorage.getItem('auth_token') ?? '') : '';
  const items = await apiFetch<PortfolioItem[]>(`${API_BASE_URL}/profiles/me/portfolio`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { items };
}

/**
 * Set portfolio item as featured (simplified)
 */
export async function setPortfolioItemFeatured(itemId: string, isFeatured: boolean): Promise<void> {
  const token = globalThis.window ? (localStorage.getItem('auth_token') ?? '') : '';
  await apiFetch<void>(`${API_BASE_URL}/profiles/me/portfolio/${itemId}/featured`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isFeatured }),
  });
}

// ============================================================================
// Simplified Skills Functions (for components without token context)
// ============================================================================

/**
 * Get current user's skills (simplified)
 */
export async function getMySkills(): Promise<FreelancerSkill[]> {
  const token = globalThis.window ? (localStorage.getItem('auth_token') ?? '') : '';
  return apiFetch<FreelancerSkill[]>(`${API_BASE_URL}/profiles/me/skills`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ============================================================================
// API Functions - Verification (Auth Service)
// ============================================================================

/**
 * Get current verification status
 * Uses cookie-based authentication
 */
export async function getVerificationStatus(): Promise<VerificationStatus> {
  return apiFetch<VerificationStatus>(`${AUTH_API_URL}/verification/status`, {
    credentials: 'include',
  });
}

/**
 * Start identity verification flow
 * Uses cookie-based authentication
 */
export async function startVerification(tier: 'BASIC' | 'ENHANCED' | 'PREMIUM'): Promise<{
  inquiryId: string;
  sessionToken: string;
  templateId: string;
}> {
  return apiFetch<{ inquiryId: string; sessionToken: string; templateId: string }>(
    `${AUTH_API_URL}/verification/start`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ tier }),
    }
  );
}

/**
 * Check verification inquiry status
 * Uses cookie-based authentication
 */
export async function checkVerificationInquiry(inquiryId: string): Promise<{
  status: 'pending' | 'completed' | 'failed' | 'expired';
  level?: VerificationLevel;
  completedAt?: string;
}> {
  return apiFetch<{
    status: 'pending' | 'completed' | 'failed' | 'expired';
    level?: VerificationLevel;
    completedAt?: string;
  }>(`${AUTH_API_URL}/verification/status/${inquiryId}`, {
    credentials: 'include',
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
// API Functions - Email Verification
// ============================================================================

/**
 * Send email verification code
 * Uses cookie-based authentication
 */
export async function sendEmailVerificationCode(
  email?: string
): Promise<{ success: boolean; expiresAt: string }> {
  return apiFetch<{ success: boolean; expiresAt: string }>(
    `${AUTH_API_URL}/verification/email/send`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email }),
    }
  );
}

/**
 * Verify email with code
 * Uses cookie-based authentication
 */
export async function verifyEmailCode(
  code: string
): Promise<{ success: boolean; verifiedAt: string }> {
  return apiFetch<{ success: boolean; verifiedAt: string }>(
    `${AUTH_API_URL}/verification/email/verify`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ code }),
    }
  );
}

// ============================================================================
// API Functions - Phone Verification
// ============================================================================

/**
 * Send phone verification code via SMS
 * Uses cookie-based authentication
 */
export async function sendPhoneVerificationCode(
  phone: string
): Promise<{ success: boolean; expiresAt: string }> {
  return apiFetch<{ success: boolean; expiresAt: string }>(
    `${AUTH_API_URL}/verification/phone/send`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ phone }),
    }
  );
}

/**
 * Verify phone with code
 * Uses cookie-based authentication
 */
export async function verifyPhoneCode(
  code: string
): Promise<{ success: boolean; verifiedAt: string }> {
  return apiFetch<{ success: boolean; verifiedAt: string }>(
    `${AUTH_API_URL}/verification/phone/verify`,
    {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ code }),
    }
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

// ============================================================================
// Trust Score & Endorsements
// ============================================================================

export interface TrustFactor {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  status: 'verified' | 'partial' | 'unverified';
  description: string;
}

export interface TrustBadge {
  id: string;
  name: string;
  icon: string;
  earnedAt: string;
}

export interface TrustScore {
  overallScore: number;
  factors: TrustFactor[];
  badges: TrustBadge[];
  averageScore: number;
  percentile?: number;
  lastUpdated: string;
}

/**
 * Get freelancer trust score with all factors
 */
export async function getFreelancerTrustScore(userId: string): Promise<TrustScore> {
  return apiFetch<TrustScore>(`${API_BASE_URL}/profiles/${userId}/trust-score`);
}

export interface FreelancerEndorsement {
  id: string;
  skill: {
    id: string;
    name: string;
    category: string;
  };
  endorser: {
    id: string;
    name: string;
    avatar?: string;
    title?: string;
    company?: string;
    verified?: boolean;
  };
  relationship: 'client' | 'colleague' | 'manager' | 'mentor' | 'collaborator' | 'other';
  endorsementText?: string;
  projectContext?: {
    id: string;
    title: string;
  };
  createdAt: string;
  featured?: boolean;
}

export interface SkillEndorsementSummary {
  skillId: string;
  skillName: string;
  category: string;
  totalEndorsements: number;
  topEndorsers: Array<{
    id: string;
    name: string;
    avatar?: string;
    title?: string;
  }>;
  percentile?: number;
}

export interface EndorsementsData {
  endorsements: FreelancerEndorsement[];
  skillSummaries: SkillEndorsementSummary[];
  totalEndorsements: number;
}

/**
 * Get freelancer endorsements
 */
export async function getFreelancerEndorsements(userId: string): Promise<EndorsementsData> {
  return apiFetch<EndorsementsData>(`${API_BASE_URL}/profiles/${userId}/endorsements`);
}

export interface FreelancerRecommendation {
  id: string;
  recommender: {
    id: string;
    name: string;
    title: string;
    avatar?: string;
    verified?: boolean;
  };
  relationship: string;
  duration: string;
  text: string;
  skillsMentioned: string[];
  date: string;
}

/**
 * Get freelancer recommendations
 */
export async function getFreelancerRecommendations(
  userId: string
): Promise<FreelancerRecommendation[]> {
  return apiFetch<FreelancerRecommendation[]>(`${API_BASE_URL}/profiles/${userId}/recommendations`);
}

export interface LearningActivity {
  isActiveLearner: boolean;
  learningStreak: number;
  recentCompletions: Array<{
    id: string;
    title: string;
    type: 'course' | 'assessment' | 'certification';
    completedAt: string;
  }>;
  skillUpdates: Array<{
    skill: string;
    improvement: number;
    updatedAt: string;
  }>;
  lastActivityAt?: string;
}

/**
 * Get freelancer learning activity
 */
export async function getFreelancerLearningActivity(userId: string): Promise<LearningActivity> {
  return apiFetch<LearningActivity>(`${API_BASE_URL}/profiles/${userId}/learning-activity`);
}

export interface ComplianceData {
  certifications: Array<{
    id: string;
    type: 'hipaa' | 'soc2' | 'pci-dss' | 'gdpr' | 'iso27001' | 'fedramp';
    verifiedAt: string;
    expiresAt?: string;
    status: 'active' | 'expired' | 'pending';
  }>;
  clearances: Array<{
    id: string;
    level: 'public-trust' | 'confidential' | 'secret' | 'top-secret';
    verifiedAt: string;
    expiresAt?: string;
    status: 'active' | 'expired' | 'pending';
  }>;
}

/**
 * Get freelancer compliance data
 */
export async function getFreelancerCompliance(userId: string): Promise<ComplianceData> {
  return apiFetch<ComplianceData>(`${API_BASE_URL}/profiles/${userId}/compliance`);
}

export interface VerifiedSkillData {
  id: string;
  name: string;
  category: string;
  proficiencyLevel: number;
  yearsOfExperience: number;
  verificationTier: 'unverified' | 'self-assessed' | 'endorsed' | 'assessed' | 'certified';
  assessmentScore?: number;
  endorsementCount: number;
  credentialId?: string;
  isPrimary?: boolean;
}

/**
 * Get freelancer verified skills with tier info
 */
export async function getFreelancerVerifiedSkills(userId: string): Promise<VerifiedSkillData[]> {
  return apiFetch<VerifiedSkillData[]>(`${API_BASE_URL}/profiles/${userId}/verified-skills`);
}

// ============================================================================
// Skills Verification API
// ============================================================================

export interface SkillVerificationStatus {
  summary: {
    totalVerifiedSkills: number;
    assessmentVerified: number;
    endorsementCount: number;
    pendingEndorsementRequests: number;
  };
  skills: Array<{
    skillId: string;
    skillName: string;
    category: string;
    currentLevel: string | null;
    verifications: Array<{
      type: string;
      score: number | null;
      verifiedAt: string;
      validUntil: string | null;
      isActive: boolean;
    }>;
    endorsements: Array<{
      endorserId: string;
      endorserName: string;
      endorserTitle: string | null;
      relationshipType: string;
      endorsedAt: string;
      message: string | null;
    }>;
    assessmentAvailable: boolean;
    nextAssessmentAvailableAt: string | null;
  }>;
  pendingEndorsements: Array<{
    id: string;
    skillId: string;
    endorserEmail: string;
    requestedAt: string;
  }>;
}

export interface SkillAssessment {
  skillId: string;
  skillName: string;
  category: string;
  description: string | null;
  assessmentTypes: Array<{
    type: 'QUICK' | 'STANDARD' | 'COMPREHENSIVE';
    duration: number;
    questions: number;
    description: string;
  }>;
  proctoredAvailable: boolean;
  lastAttempt: {
    score: number;
    maxScore: number;
    proficiencyLevel: string;
    verifiedAt: string;
  } | null;
  canRetake: boolean;
  nextAttemptAt: string | null;
}

export interface SkillAssessmentSession {
  assessmentId: string;
  skillId: string;
  skillName: string;
  assessmentType: string;
  proctored: boolean;
  duration: number;
  expiresAt: string;
  questions: Array<{
    id: string;
    number: number;
    text: string;
    type: string;
    options?: string[];
    category: string;
  }>;
}

export interface SkillAssessmentResult {
  assessmentId: string;
  skillId: string;
  skillName: string;
  score: number;
  maxScore: number;
  percentage: number;
  percentile: number;
  proficiencyLevel: string;
  badge: {
    type: string;
    level: string;
    issuedAt: string;
    validUntil: string;
  };
  breakdown: Record<string, { correct: number; total: number }>;
}

/**
 * Get skills verification status
 */
export async function getSkillsVerificationStatus(): Promise<SkillVerificationStatus> {
  return apiFetch<SkillVerificationStatus>(`${AUTH_API_URL}/skills-verification/status`);
}

/**
 * Get available skill assessments
 */
export async function getAvailableAssessments(params?: {
  skillId?: string;
  category?: string;
}): Promise<{ assessments: SkillAssessment[]; categories: string[] }> {
  const searchParams = new URLSearchParams();
  if (params?.skillId) searchParams.set('skillId', params.skillId);
  if (params?.category) searchParams.set('category', params.category);
  const query = searchParams.toString();
  return apiFetch<{ assessments: SkillAssessment[]; categories: string[] }>(
    `${AUTH_API_URL}/skills-verification/assessments${query ? `?${query}` : ''}`
  );
}

/**
 * Start a skill assessment
 */
export async function startSkillAssessment(data: {
  skillId: string;
  assessmentType?: 'QUICK' | 'STANDARD' | 'COMPREHENSIVE';
  proctored?: boolean;
}): Promise<SkillAssessmentSession> {
  return apiFetch<SkillAssessmentSession>(`${AUTH_API_URL}/skills-verification/assessments/start`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Submit assessment answers
 */
export async function submitSkillAssessment(data: {
  assessmentId: string;
  answers: Array<{
    questionId: string;
    answer: string | number | string[];
    timeSpent: number;
  }>;
}): Promise<SkillAssessmentResult> {
  return apiFetch<SkillAssessmentResult>(`${AUTH_API_URL}/skills-verification/assessments/submit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Request a peer endorsement
 */
export async function requestEndorsement(data: {
  skillId: string;
  endorserEmail: string;
  message?: string;
  relationshipType: 'COLLEAGUE' | 'MANAGER' | 'CLIENT' | 'MENTOR' | 'OTHER';
}): Promise<{
  id: string;
  skillId: string;
  skillName: string;
  endorserEmail: string;
  status: string;
  expiresAt: string;
}> {
  return apiFetch(`${AUTH_API_URL}/skills-verification/endorsements/request`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get detailed skill verification status
 */
export async function getSkillVerificationDetails(skillId: string): Promise<{
  skillId: string;
  skillName: string;
  category: string;
  currentLevel: string | null;
  confidenceScore: number;
  verifications: Array<{
    id: string;
    type: string;
    score: number | null;
    maxScore: number | null;
    percentile: number | null;
    proficiencyLevel: string;
    proctored: boolean;
    verifiedAt: string;
    validUntil: string | null;
    isActive: boolean;
    showOnProfile: boolean;
  }>;
  endorsements: Array<{
    id: string;
    endorser: { id: string; name: string; avatar: string | null };
    relationshipType: string;
    message: string | null;
    endorsedAt: string;
  }>;
  pendingRequests: Array<{
    id: string;
    endorserEmail: string;
    requestedAt: string;
    expiresAt: string;
  }>;
  stats: {
    endorsementCount: number;
    hasAssessment: boolean;
    lastVerifiedAt: string | null;
  };
}> {
  return apiFetch(`${AUTH_API_URL}/skills-verification/${skillId}`);
}

// ============================================================================
// Payment Verification API
// ============================================================================

export interface PaymentVerificationStatus {
  isVerified: boolean;
  verifiedAt: string | null;
  hasStripeCustomer: boolean;
  paymentMethodsCount: number;
  benefits: Array<{ label: string; available: boolean }>;
}

export interface PaymentSetupIntent {
  setupIntentId: string;
  clientSecret: string;
  paymentMethodType: string;
  publishableKey: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  addedAt: string;
}

/**
 * Get payment verification status
 */
export async function getPaymentVerificationStatus(): Promise<PaymentVerificationStatus> {
  return apiFetch<PaymentVerificationStatus>(`${AUTH_API_URL}/payment-verification/status`);
}

/**
 * Create a setup intent for payment method verification
 */
export async function createPaymentSetupIntent(
  paymentMethodType: 'card' | 'bank_account' = 'card'
): Promise<PaymentSetupIntent> {
  return apiFetch<PaymentSetupIntent>(`${AUTH_API_URL}/payment-verification/setup-intent`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethodType }),
  });
}

/**
 * Confirm payment verification
 */
export async function confirmPaymentVerification(data: {
  setupIntentId: string;
  paymentMethodId: string;
}): Promise<{
  success: boolean;
  message: string;
  paymentMethod: { type: string; brand: string; last4: string };
  verifiedAt: string;
  benefits: Array<{ label: string; available: boolean }>;
}> {
  return apiFetch(`${AUTH_API_URL}/payment-verification/confirm`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get verified payment methods
 */
export async function getVerifiedPaymentMethods(): Promise<{
  paymentMethods: PaymentMethod[];
}> {
  return apiFetch(`${AUTH_API_URL}/payment-verification/methods`);
}

/**
 * Remove a payment method
 */
export async function removePaymentMethod(methodId: string): Promise<{
  success: boolean;
  message: string;
  remainingMethods: number;
  paymentVerified: boolean;
}> {
  return apiFetch(`${AUTH_API_URL}/payment-verification/methods/${methodId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Business Verification API
// ============================================================================

export type BusinessType = 'SOLE_PROPRIETOR' | 'LLC' | 'CORPORATION' | 'PARTNERSHIP' | 'NON_PROFIT';
export type BusinessDocumentType =
  | 'BUSINESS_LICENSE'
  | 'CERTIFICATE_OF_INCORPORATION'
  | 'TAX_REGISTRATION'
  | 'PROOF_OF_ADDRESS'
  | 'ARTICLES_OF_ORGANIZATION'
  | 'OPERATING_AGREEMENT'
  | 'EIN_LETTER'
  | 'OTHER';

export interface BusinessVerificationStatus {
  hasBusinessProfile: boolean;
  status: string;
  verifiedAt: string | null;
  business?: {
    type: BusinessType;
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    taxIdType: string;
    taxIdLastFour: string | null;
    website: string | null;
    yearEstablished: number | null;
  };
  documents: Array<{
    id: string;
    type: BusinessDocumentType;
    fileName: string;
    status: string;
    uploadedAt: string;
    verifiedAt: string | null;
    rejectionReason: string | null;
  }>;
  documentsProgress: {
    required: number;
    uploaded: number;
    verified: number;
  };
  requiredDocuments: string[];
  missingDocuments: string[];
  benefits: Array<{ label: string; available: boolean }>;
}

/**
 * Get business verification status
 */
export async function getBusinessVerificationStatus(): Promise<BusinessVerificationStatus> {
  return apiFetch<BusinessVerificationStatus>(`${AUTH_API_URL}/business-verification/status`);
}

/**
 * Start business verification
 */
export async function startBusinessVerification(data: {
  businessType: BusinessType;
  businessName: string;
  businessAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  taxIdType: 'EIN' | 'SSN' | 'VAT' | 'OTHER';
  taxIdNumber: string;
  website?: string;
  yearEstablished?: number;
}): Promise<{
  verificationId: string;
  status: string;
  businessType: BusinessType;
  businessName: string;
  requiredDocuments: string[];
  nextStep: string;
}> {
  return apiFetch(`${AUTH_API_URL}/business-verification/start`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get document upload URL
 */
export async function getDocumentUploadUrl(data: {
  documentType: BusinessDocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
}): Promise<{
  documentId: string;
  uploadUrl: string;
  uploadKey: string;
  expiresAt: string;
  instructions: string;
}> {
  return apiFetch(`${AUTH_API_URL}/business-verification/documents/upload-url`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Confirm document upload
 */
export async function confirmDocumentUpload(documentId: string): Promise<{
  success: boolean;
  documentId: string;
  status: string;
  allRequiredDocumentsUploaded: boolean;
  verificationStatus: string;
}> {
  return apiFetch(`${AUTH_API_URL}/business-verification/documents/${documentId}/confirm`, {
    method: 'POST',
  });
}

/**
 * Get business verification requirements
 */
export async function getBusinessVerificationRequirements(): Promise<{
  requirements: Array<{
    businessType: BusinessType;
    displayName: string;
    requiredDocuments: Array<{
      type: BusinessDocumentType;
      displayName: string;
      description: string;
    }>;
  }>;
}> {
  return apiFetch(`${AUTH_API_URL}/business-verification/requirements`);
}
