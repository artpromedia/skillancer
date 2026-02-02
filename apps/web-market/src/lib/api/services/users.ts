/**
 * Users Service Module
 *
 * Type-safe API methods for user/profile operations using the shared API client.
 */

import {
  type ApiResponse,
  type PaginatedResponse,
  AUTH_ENDPOINTS,
  MARKET_ENDPOINTS,
} from '@skillancer/shared-api-client';

import { getApiClient } from '../api-client';

// =============================================================================
// Types
// =============================================================================

export type UserRole = 'FREELANCER' | 'CLIENT' | 'AGENCY' | 'ADMIN';
export type VerificationLevel = 'NONE' | 'EMAIL' | 'BASIC' | 'ENHANCED' | 'PREMIUM';
export type AvailabilityStatus = 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'NOT_AVAILABLE';
export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export interface UserSkill {
  id: string;
  skillId: string;
  name: string;
  slug: string;
  category?: string;
  proficiencyLevel: ProficiencyLevel;
  yearsOfExperience: number;
  isPrimary: boolean;
  isVerified: boolean;
  verificationSource?: string;
  assessmentScore?: number;
  endorsementCount: number;
  lastVerifiedAt?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  mediaUrls?: string[];
  type: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK';
  projectUrl?: string;
  category?: string;
  tags?: string[];
  skills?: string[];
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

export interface WorkExperience {
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
  earnings?: number;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface Certification {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  isVerified: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  headline?: string;
  bio?: string;
  roles: UserRole[];
  country?: string;
  countryCode?: string;
  city?: string;
  timezone?: string;
  languages?: { code: string; name: string; proficiency: string }[];
  phone?: string;
  website?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    dribbble?: string;
    behance?: string;
  };
  verificationLevel: VerificationLevel;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isIdentityVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FreelancerProfile extends UserProfile {
  title: string;
  skills: UserSkill[];
  portfolio: PortfolioItem[];
  workExperience: WorkExperience[];
  education: Education[];
  certifications: Certification[];
  hourlyRate?: number;
  availability: AvailabilityStatus;
  hoursPerWeek?: number;
  totalEarnings: number;
  completedJobs: number;
  ongoingJobs: number;
  rating?: number;
  reviewCount: number;
  successRate: number;
  responseTime?: number;
  memberSince: string;
  lastActiveAt?: string;
}

export interface ClientProfile extends UserProfile {
  companyName?: string;
  companySize?: string;
  industry?: string;
  companyWebsite?: string;
  companyDescription?: string;
  totalSpent: number;
  jobsPosted: number;
  activeJobs: number;
  hireRate: number;
  rating?: number;
  reviewCount: number;
  isPaymentVerified: boolean;
  memberSince: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  headline?: string;
  bio?: string;
  country?: string;
  city?: string;
  timezone?: string;
  phone?: string;
  website?: string;
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    dribbble?: string;
    behance?: string;
  };
  languages?: { code: string; name: string; proficiency: string }[];
}

export interface UpdateFreelancerProfileInput extends UpdateProfileInput {
  title?: string;
  hourlyRate?: number;
  availability?: AvailabilityStatus;
  hoursPerWeek?: number;
}

export interface UpdateClientProfileInput extends UpdateProfileInput {
  companyName?: string;
  companySize?: string;
  industry?: string;
  companyWebsite?: string;
  companyDescription?: string;
}

export interface FreelancerSearchParams {
  query?: string;
  skills?: string[];
  category?: string;
  experienceLevel?: ProficiencyLevel;
  hourlyRateMin?: number;
  hourlyRateMax?: number;
  availability?: AvailabilityStatus;
  country?: string;
  languages?: string[];
  verificationLevel?: VerificationLevel;
  minRating?: number;
  sortBy?: 'relevance' | 'rating' | 'hourlyRate' | 'completedJobs' | 'earnings';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// =============================================================================
// Users API Service
// =============================================================================

export const usersService = {
  /**
   * Get current user profile
   */
  async getCurrentUser(): Promise<ApiResponse<UserProfile>> {
    const client = getApiClient();
    return client.get<UserProfile>(AUTH_ENDPOINTS.PROFILE);
  },

  /**
   * Update current user profile
   */
  async updateProfile(data: UpdateProfileInput): Promise<ApiResponse<UserProfile>> {
    const client = getApiClient();
    return client.patch<UserProfile, UpdateProfileInput>(AUTH_ENDPOINTS.UPDATE_PROFILE, data);
  },

  /**
   * Upload avatar
   */
  async uploadAvatar(file: File): Promise<ApiResponse<{ avatarUrl: string }>> {
    const client = getApiClient();
    const formData = new FormData();
    formData.append('avatar', file);

    // Use raw axios instance for file upload
    const axios = client.getAxiosInstance();
    const response = await axios.post<ApiResponse<{ avatarUrl: string }>>(
      `${AUTH_ENDPOINTS.PROFILE}/avatar`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  },

  /**
   * Delete avatar
   */
  async deleteAvatar(): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`${AUTH_ENDPOINTS.PROFILE}/avatar`);
  },

  // =============================================================================
  // Freelancer Operations
  // =============================================================================

  /**
   * Get current user's freelancer profile
   */
  async getMyFreelancerProfile(): Promise<ApiResponse<FreelancerProfile>> {
    const client = getApiClient();
    return client.get<FreelancerProfile>(`${MARKET_ENDPOINTS.FREELANCERS}/me`);
  },

  /**
   * Update freelancer profile
   */
  async updateFreelancerProfile(
    data: UpdateFreelancerProfileInput
  ): Promise<ApiResponse<FreelancerProfile>> {
    const client = getApiClient();
    return client.patch<FreelancerProfile, UpdateFreelancerProfileInput>(
      `${MARKET_ENDPOINTS.FREELANCERS}/me`,
      data
    );
  },

  /**
   * Get a freelancer by ID
   */
  async getFreelancer(id: string): Promise<ApiResponse<FreelancerProfile>> {
    const client = getApiClient();
    return client.get<FreelancerProfile>(MARKET_ENDPOINTS.FREELANCER_BY_ID(id));
  },

  /**
   * Search freelancers
   */
  async searchFreelancers(
    params: FreelancerSearchParams = {}
  ): Promise<PaginatedResponse<FreelancerProfile>> {
    const client = getApiClient();
    const { page = 1, limit = 20, skills, languages, ...rest } = params;

    const queryParams: Record<string, string | number | boolean | undefined> = {
      page,
      limit,
      ...rest,
    };

    if (skills?.length) {
      queryParams.skills = skills.join(',');
    }
    if (languages?.length) {
      queryParams.languages = languages.join(',');
    }

    return client.get<FreelancerProfile[]>(MARKET_ENDPOINTS.FREELANCER_SEARCH, {
      params: queryParams,
    }) as Promise<PaginatedResponse<FreelancerProfile>>;
  },

  /**
   * Get top freelancers
   */
  async getTopFreelancers(
    params: { category?: string; limit?: number } = {}
  ): Promise<ApiResponse<FreelancerProfile[]>> {
    const client = getApiClient();
    return client.get<FreelancerProfile[]>(MARKET_ENDPOINTS.TOP_FREELANCERS, {
      params,
    });
  },

  // =============================================================================
  // Client Operations
  // =============================================================================

  /**
   * Get current user's client profile
   */
  async getMyClientProfile(): Promise<ApiResponse<ClientProfile>> {
    const client = getApiClient();
    return client.get<ClientProfile>('/clients/me');
  },

  /**
   * Update client profile
   */
  async updateClientProfile(data: UpdateClientProfileInput): Promise<ApiResponse<ClientProfile>> {
    const client = getApiClient();
    return client.patch<ClientProfile, UpdateClientProfileInput>('/clients/me', data);
  },

  // =============================================================================
  // Skills Management
  // =============================================================================

  /**
   * Add skill to profile
   */
  async addSkill(data: {
    skillId: string;
    proficiencyLevel: ProficiencyLevel;
    yearsOfExperience: number;
    isPrimary?: boolean;
  }): Promise<ApiResponse<UserSkill>> {
    const client = getApiClient();
    return client.post<
      UserSkill,
      {
        skillId: string;
        proficiencyLevel: ProficiencyLevel;
        yearsOfExperience: number;
        isPrimary?: boolean;
      }
    >(`${MARKET_ENDPOINTS.FREELANCERS}/me/skills`, data);
  },

  /**
   * Update skill
   */
  async updateSkill(
    skillId: string,
    data: Partial<{
      proficiencyLevel: ProficiencyLevel;
      yearsOfExperience: number;
      isPrimary: boolean;
    }>
  ): Promise<ApiResponse<UserSkill>> {
    const client = getApiClient();
    return client.patch<UserSkill>(`${MARKET_ENDPOINTS.FREELANCERS}/me/skills/${skillId}`, data);
  },

  /**
   * Remove skill from profile
   */
  async removeSkill(skillId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`${MARKET_ENDPOINTS.FREELANCERS}/me/skills/${skillId}`);
  },

  // =============================================================================
  // Portfolio Management
  // =============================================================================

  /**
   * Add portfolio item
   */
  async addPortfolioItem(
    data: Omit<PortfolioItem, 'id' | 'createdAt'>
  ): Promise<ApiResponse<PortfolioItem>> {
    const client = getApiClient();
    return client.post<PortfolioItem>(`${MARKET_ENDPOINTS.FREELANCERS}/me/portfolio`, data);
  },

  /**
   * Update portfolio item
   */
  async updatePortfolioItem(
    itemId: string,
    data: Partial<Omit<PortfolioItem, 'id' | 'createdAt'>>
  ): Promise<ApiResponse<PortfolioItem>> {
    const client = getApiClient();
    return client.patch<PortfolioItem>(
      `${MARKET_ENDPOINTS.FREELANCERS}/me/portfolio/${itemId}`,
      data
    );
  },

  /**
   * Delete portfolio item
   */
  async deletePortfolioItem(itemId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`${MARKET_ENDPOINTS.FREELANCERS}/me/portfolio/${itemId}`);
  },

  /**
   * Reorder portfolio items
   */
  async reorderPortfolio(itemIds: string[]): Promise<ApiResponse<PortfolioItem[]>> {
    const client = getApiClient();
    return client.post<PortfolioItem[], { itemIds: string[] }>(
      `${MARKET_ENDPOINTS.FREELANCERS}/me/portfolio/reorder`,
      { itemIds }
    );
  },

  // =============================================================================
  // Reviews
  // =============================================================================

  /**
   * Get reviews for a user
   */
  async getReviews(
    userId: string,
    params?: { page?: number; limit?: number; role?: 'client' | 'freelancer' }
  ): Promise<PaginatedResponse<UserReview>> {
    const client = getApiClient();
    return client.get<UserReview[]>(MARKET_ENDPOINTS.USER_REVIEWS(userId), {
      params,
    }) as Promise<PaginatedResponse<UserReview>>;
  },

  // =============================================================================
  // Work Experience
  // =============================================================================

  /**
   * Add work experience
   */
  async addWorkExperience(data: Omit<WorkExperience, 'id'>): Promise<ApiResponse<WorkExperience>> {
    const client = getApiClient();
    return client.post<WorkExperience>(`${MARKET_ENDPOINTS.FREELANCERS}/me/experience`, data);
  },

  /**
   * Update work experience
   */
  async updateWorkExperience(
    expId: string,
    data: Partial<Omit<WorkExperience, 'id'>>
  ): Promise<ApiResponse<WorkExperience>> {
    const client = getApiClient();
    return client.patch<WorkExperience>(
      `${MARKET_ENDPOINTS.FREELANCERS}/me/experience/${expId}`,
      data
    );
  },

  /**
   * Delete work experience
   */
  async deleteWorkExperience(expId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`${MARKET_ENDPOINTS.FREELANCERS}/me/experience/${expId}`);
  },

  // =============================================================================
  // Education
  // =============================================================================

  /**
   * Add education
   */
  async addEducation(data: Omit<Education, 'id'>): Promise<ApiResponse<Education>> {
    const client = getApiClient();
    return client.post<Education>(`${MARKET_ENDPOINTS.FREELANCERS}/me/education`, data);
  },

  /**
   * Update education
   */
  async updateEducation(
    eduId: string,
    data: Partial<Omit<Education, 'id'>>
  ): Promise<ApiResponse<Education>> {
    const client = getApiClient();
    return client.patch<Education>(`${MARKET_ENDPOINTS.FREELANCERS}/me/education/${eduId}`, data);
  },

  /**
   * Delete education
   */
  async deleteEducation(eduId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`${MARKET_ENDPOINTS.FREELANCERS}/me/education/${eduId}`);
  },

  // =============================================================================
  // Certifications
  // =============================================================================

  /**
   * Add certification
   */
  async addCertification(
    data: Omit<Certification, 'id' | 'isVerified'>
  ): Promise<ApiResponse<Certification>> {
    const client = getApiClient();
    return client.post<Certification>(`${MARKET_ENDPOINTS.FREELANCERS}/me/certifications`, data);
  },

  /**
   * Update certification
   */
  async updateCertification(
    certId: string,
    data: Partial<Omit<Certification, 'id' | 'isVerified'>>
  ): Promise<ApiResponse<Certification>> {
    const client = getApiClient();
    return client.patch<Certification>(
      `${MARKET_ENDPOINTS.FREELANCERS}/me/certifications/${certId}`,
      data
    );
  },

  /**
   * Delete certification
   */
  async deleteCertification(certId: string): Promise<ApiResponse<void>> {
    const client = getApiClient();
    return client.delete<void>(`${MARKET_ENDPOINTS.FREELANCERS}/me/certifications/${certId}`);
  },
};

// =============================================================================
// Additional Types
// =============================================================================

export interface UserReview {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatarUrl?: string;
  contractId: string;
  jobTitle: string;
  rating: number;
  title?: string;
  comment?: string;
  skills?: { skillId: string; skillName: string; rating: number }[];
  isPublic: boolean;
  response?: string;
  respondedAt?: string;
  createdAt: string;
}

export default usersService;
