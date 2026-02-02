/**
 * @module @skillancer/api-client/services/user
 * User service client for profiles, settings, and verification
 */

import type { HttpClient, ApiResponse } from '../http/base-client';

// =============================================================================
// Types
// =============================================================================

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  userType: 'freelancer' | 'client';
  avatar?: string;
  bio?: string;
  location?: UserLocation;
  timezone: string;
  languages: UserLanguage[];
  isEmailVerified: boolean;
  isProfileComplete: boolean;
  onlineStatus: 'online' | 'away' | 'offline';
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserLocation {
  city?: string;
  state?: string;
  country: string;
  countryCode: string;
}

export interface UserLanguage {
  code: string;
  name: string;
  proficiency: 'basic' | 'conversational' | 'fluent' | 'native';
}

export interface FreelancerProfile extends UserProfile {
  title: string;
  hourlyRate: number;
  currency: string;
  availability: 'full-time' | 'part-time' | 'not-available';
  skills: Skill[];
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  portfolio: PortfolioItem[];
  stats: FreelancerStats;
}

export interface Skill {
  id: string;
  name: string;
  level: 'beginner' | 'intermediate' | 'expert';
  yearsOfExperience?: number;
  verified?: boolean;
}

export interface Experience {
  id: string;
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: string;
}

export interface Education {
  id: string;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  images: string[];
  link?: string;
  skills: string[];
  createdAt: string;
}

export interface FreelancerStats {
  jobsCompleted: number;
  totalEarnings: number;
  avgRating: number;
  totalReviews: number;
  responseRate: number;
  onTimeDeliveryRate: number;
  repeatClientRate: number;
}

export interface ClientProfile extends UserProfile {
  company?: CompanyInfo;
  totalJobsPosted: number;
  totalSpent: number;
  avgRating: number;
  totalReviews: number;
  paymentVerified: boolean;
}

export interface CompanyInfo {
  name: string;
  size: string;
  industry: string;
  website?: string;
  description?: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  bio?: string;
  location?: Partial<UserLocation>;
  timezone?: string;
  languages?: UserLanguage[];
}

export interface UpdateFreelancerProfileRequest extends UpdateProfileRequest {
  title?: string;
  hourlyRate?: number;
  currency?: string;
  availability?: 'full-time' | 'part-time' | 'not-available';
  skills?: Omit<Skill, 'id' | 'verified'>[];
}

export interface NotificationSettings {
  email: {
    jobAlerts: boolean;
    messages: boolean;
    contractUpdates: boolean;
    promotions: boolean;
    newsletter: boolean;
  };
  push: {
    messages: boolean;
    contractUpdates: boolean;
    reminders: boolean;
  };
  sms: {
    criticalAlerts: boolean;
    paymentUpdates: boolean;
  };
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'contacts-only';
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  showEarnings: boolean;
  allowSearchEngines: boolean;
}

// =============================================================================
// User Service Client
// =============================================================================

export class UserServiceClient {
  private httpClient: HttpClient;
  private basePath: string;

  constructor(httpClient: HttpClient, basePath: string = '/users') {
    this.httpClient = httpClient;
    this.basePath = basePath;
  }

  // ===========================================================================
  // Profile Management
  // ===========================================================================

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string): Promise<UserProfile> {
    return this.httpClient.get<UserProfile>(`${this.basePath}/${userId}`);
  }

  /**
   * Get freelancer profile by ID
   */
  async getFreelancerProfile(userId: string): Promise<FreelancerProfile> {
    return this.httpClient.get<FreelancerProfile>(`${this.basePath}/${userId}/freelancer`);
  }

  /**
   * Get client profile by ID
   */
  async getClientProfile(userId: string): Promise<ClientProfile> {
    return this.httpClient.get<ClientProfile>(`${this.basePath}/${userId}/client`);
  }

  /**
   * Get current user's profile
   */
  async getMyProfile(): Promise<UserProfile | FreelancerProfile | ClientProfile> {
    return this.httpClient.get<UserProfile>(`${this.basePath}/me`);
  }

  /**
   * Update current user's profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    return this.httpClient.patch<UserProfile>(`${this.basePath}/me`, data);
  }

  /**
   * Update freelancer-specific profile
   */
  async updateFreelancerProfile(data: UpdateFreelancerProfileRequest): Promise<FreelancerProfile> {
    return this.httpClient.patch<FreelancerProfile>(`${this.basePath}/me/freelancer`, data);
  }

  // ===========================================================================
  // Avatar
  // ===========================================================================

  /**
   * Upload avatar image
   */
  async uploadAvatar(file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.httpClient.post<ApiResponse<{ url: string }>>(
      `${this.basePath}/me/avatar`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
  }

  /**
   * Delete avatar
   */
  async deleteAvatar(): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(`${this.basePath}/me/avatar`);
  }

  // ===========================================================================
  // Skills & Portfolio
  // ===========================================================================

  /**
   * Add skill to profile
   */
  async addSkill(skill: Omit<Skill, 'id' | 'verified'>): Promise<Skill> {
    return this.httpClient.post<Skill>(`${this.basePath}/me/skills`, skill);
  }

  /**
   * Update skill
   */
  async updateSkill(skillId: string, data: Partial<Skill>): Promise<Skill> {
    return this.httpClient.patch<Skill>(`${this.basePath}/me/skills/${skillId}`, data);
  }

  /**
   * Remove skill
   */
  async removeSkill(skillId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(`${this.basePath}/me/skills/${skillId}`);
  }

  /**
   * Add portfolio item
   */
  async addPortfolioItem(item: Omit<PortfolioItem, 'id' | 'createdAt'>): Promise<PortfolioItem> {
    return this.httpClient.post<PortfolioItem>(`${this.basePath}/me/portfolio`, item);
  }

  /**
   * Update portfolio item
   */
  async updatePortfolioItem(itemId: string, data: Partial<PortfolioItem>): Promise<PortfolioItem> {
    return this.httpClient.patch<PortfolioItem>(`${this.basePath}/me/portfolio/${itemId}`, data);
  }

  /**
   * Delete portfolio item
   */
  async deletePortfolioItem(itemId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(`${this.basePath}/me/portfolio/${itemId}`);
  }

  // ===========================================================================
  // Experience & Education
  // ===========================================================================

  /**
   * Add experience
   */
  async addExperience(experience: Omit<Experience, 'id'>): Promise<Experience> {
    return this.httpClient.post<Experience>(`${this.basePath}/me/experience`, experience);
  }

  /**
   * Update experience
   */
  async updateExperience(experienceId: string, data: Partial<Experience>): Promise<Experience> {
    return this.httpClient.patch<Experience>(
      `${this.basePath}/me/experience/${experienceId}`,
      data
    );
  }

  /**
   * Delete experience
   */
  async deleteExperience(experienceId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(
      `${this.basePath}/me/experience/${experienceId}`
    );
  }

  /**
   * Add education
   */
  async addEducation(education: Omit<Education, 'id'>): Promise<Education> {
    return this.httpClient.post<Education>(`${this.basePath}/me/education`, education);
  }

  /**
   * Update education
   */
  async updateEducation(educationId: string, data: Partial<Education>): Promise<Education> {
    return this.httpClient.patch<Education>(`${this.basePath}/me/education/${educationId}`, data);
  }

  /**
   * Delete education
   */
  async deleteEducation(educationId: string): Promise<ApiResponse<void>> {
    return this.httpClient.delete<ApiResponse<void>>(
      `${this.basePath}/me/education/${educationId}`
    );
  }

  // ===========================================================================
  // Settings
  // ===========================================================================

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    return this.httpClient.get<NotificationSettings>(`${this.basePath}/me/settings/notifications`);
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    return this.httpClient.patch<NotificationSettings>(
      `${this.basePath}/me/settings/notifications`,
      settings
    );
  }

  /**
   * Get privacy settings
   */
  async getPrivacySettings(): Promise<PrivacySettings> {
    return this.httpClient.get<PrivacySettings>(`${this.basePath}/me/settings/privacy`);
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<PrivacySettings> {
    return this.httpClient.patch<PrivacySettings>(`${this.basePath}/me/settings/privacy`, settings);
  }

  // ===========================================================================
  // Account Management
  // ===========================================================================

  /**
   * Delete account (requires confirmation)
   */
  async deleteAccount(password: string, reason?: string): Promise<ApiResponse<void>> {
    return this.httpClient.post<ApiResponse<void>>(`${this.basePath}/me/delete`, {
      password,
      reason,
    });
  }

  /**
   * Export user data (GDPR compliance)
   */
  async exportData(): Promise<ApiResponse<{ downloadUrl: string }>> {
    return this.httpClient.post<ApiResponse<{ downloadUrl: string }>>(`${this.basePath}/me/export`);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createUserServiceClient(
  httpClient: HttpClient,
  basePath?: string
): UserServiceClient {
  return new UserServiceClient(httpClient, basePath);
}
