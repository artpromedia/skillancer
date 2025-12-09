/**
 * @module @skillancer/service-client/clients/cockpit-client
 * Cockpit service client for user dashboard and profile management
 */

import { BaseServiceClient, type ServiceClientConfig, type Pagination } from '../base-client.js';

// ============================================================================
// Types
// ============================================================================

export interface FreelancerProfile {
  id: string;
  userId: string;
  title: string;
  bio: string;
  skills: Skill[];
  hourlyRate?: Money;
  availability: Availability;
  portfolio?: PortfolioItem[];
  certifications?: Certification[];
  education?: Education[];
  workHistory?: WorkHistory[];
  languages?: Language[];
  rating?: number;
  reviewsCount?: number;
  completedJobs?: number;
  successRate?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientProfile {
  id: string;
  userId: string;
  companyName?: string;
  companySize?: string;
  industry?: string;
  description?: string;
  website?: string;
  postedJobsCount?: number;
  totalSpent?: Money;
  rating?: number;
  reviewsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  name: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  yearsOfExperience?: number;
  verified?: boolean;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface Availability {
  status: 'available' | 'partially_available' | 'not_available';
  hoursPerWeek?: number;
  preferredSchedule?: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  url?: string;
  images?: string[];
  skills?: string[];
  createdAt: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  verificationUrl?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface WorkHistory {
  id: string;
  company: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
}

export interface Language {
  code: string;
  name: string;
  proficiency: 'basic' | 'conversational' | 'fluent' | 'native';
}

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  contractId: string;
  rating: number;
  comment?: string;
  type: 'client_to_freelancer' | 'freelancer_to_client';
  createdAt: string;
}

export interface DashboardStats {
  earnings?: {
    total: Money;
    thisMonth: Money;
    pending: Money;
  };
  jobs?: {
    active: number;
    completed: number;
    pending: number;
  };
  contracts?: {
    active: number;
    completed: number;
  };
  proposals?: {
    sent: number;
    accepted: number;
    pending: number;
  };
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  type: 'jobs' | 'freelancers' | 'services';
  filters: Record<string, unknown>;
  alertEnabled: boolean;
  createdAt: string;
}

export interface CreateFreelancerProfileInput {
  title: string;
  bio: string;
  skills?: Omit<Skill, 'id'>[];
  hourlyRate?: Money;
  availability?: Availability;
}

export interface UpdateFreelancerProfileInput {
  title?: string;
  bio?: string;
  skills?: Omit<Skill, 'id'>[];
  hourlyRate?: Money;
  availability?: Availability;
  languages?: Language[];
}

export interface CreateClientProfileInput {
  companyName?: string;
  companySize?: string;
  industry?: string;
  description?: string;
  website?: string;
}

// ============================================================================
// Cockpit Service Client
// ============================================================================

export class CockpitServiceClient extends BaseServiceClient {
  constructor(config?: Partial<ServiceClientConfig>) {
    super({
      baseUrl: process.env['COCKPIT_SERVICE_URL'] ?? 'http://cockpit-svc:3004',
      serviceName: 'cockpit-svc',
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
  // Freelancer Profiles
  // ==========================================================================

  /**
   * Get freelancer profile by ID
   */
  async getFreelancerProfile(profileId: string): Promise<FreelancerProfile> {
    return this.get<FreelancerProfile>(`freelancers/${profileId}`);
  }

  /**
   * Get freelancer profile by user ID
   */
  async getFreelancerProfileByUserId(userId: string): Promise<FreelancerProfile> {
    return this.get<FreelancerProfile>(`freelancers/by-user/${userId}`);
  }

  /**
   * List freelancer profiles
   */
  async listFreelancerProfiles(params?: {
    skills?: string[];
    availability?: Availability['status'];
    minHourlyRate?: number;
    maxHourlyRate?: number;
    minRating?: number;
    search?: string;
    pagination?: Pagination;
  }): Promise<{ profiles: FreelancerProfile[]; total: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.skills?.length) searchParams['skills'] = params.skills.join(',');
    if (params?.availability) searchParams['availability'] = params.availability;
    if (params?.minHourlyRate) searchParams['minHourlyRate'] = String(params.minHourlyRate);
    if (params?.maxHourlyRate) searchParams['maxHourlyRate'] = String(params.maxHourlyRate);
    if (params?.minRating) searchParams['minRating'] = String(params.minRating);
    if (params?.search) searchParams['search'] = params.search;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ profiles: FreelancerProfile[]; total: number }>('freelancers', {
      searchParams,
    });
  }

  /**
   * Create freelancer profile
   */
  async createFreelancerProfile(data: CreateFreelancerProfileInput): Promise<FreelancerProfile> {
    return this.post<FreelancerProfile>('freelancers', data);
  }

  /**
   * Update freelancer profile
   */
  async updateFreelancerProfile(
    profileId: string,
    data: UpdateFreelancerProfileInput
  ): Promise<FreelancerProfile> {
    return this.patch<FreelancerProfile>(`freelancers/${profileId}`, data);
  }

  // ==========================================================================
  // Client Profiles
  // ==========================================================================

  /**
   * Get client profile by ID
   */
  async getClientProfile(profileId: string): Promise<ClientProfile> {
    return this.get<ClientProfile>(`clients/${profileId}`);
  }

  /**
   * Get client profile by user ID
   */
  async getClientProfileByUserId(userId: string): Promise<ClientProfile> {
    return this.get<ClientProfile>(`clients/by-user/${userId}`);
  }

  /**
   * Create client profile
   */
  async createClientProfile(data: CreateClientProfileInput): Promise<ClientProfile> {
    return this.post<ClientProfile>('clients', data);
  }

  /**
   * Update client profile
   */
  async updateClientProfile(
    profileId: string,
    data: Partial<CreateClientProfileInput>
  ): Promise<ClientProfile> {
    return this.patch<ClientProfile>(`clients/${profileId}`, data);
  }

  // ==========================================================================
  // Portfolio
  // ==========================================================================

  /**
   * Add portfolio item
   */
  async addPortfolioItem(
    profileId: string,
    data: Omit<PortfolioItem, 'id' | 'createdAt'>
  ): Promise<PortfolioItem> {
    return this.post<PortfolioItem>(`freelancers/${profileId}/portfolio`, data);
  }

  /**
   * Update portfolio item
   */
  async updatePortfolioItem(
    profileId: string,
    itemId: string,
    data: Partial<Omit<PortfolioItem, 'id' | 'createdAt'>>
  ): Promise<PortfolioItem> {
    return this.patch<PortfolioItem>(`freelancers/${profileId}/portfolio/${itemId}`, data);
  }

  /**
   * Delete portfolio item
   */
  async deletePortfolioItem(profileId: string, itemId: string): Promise<void> {
    await this.delete(`freelancers/${profileId}/portfolio/${itemId}`);
  }

  // ==========================================================================
  // Certifications
  // ==========================================================================

  /**
   * Add certification
   */
  async addCertification(
    profileId: string,
    data: Omit<Certification, 'id'>
  ): Promise<Certification> {
    return this.post<Certification>(`freelancers/${profileId}/certifications`, data);
  }

  /**
   * Delete certification
   */
  async deleteCertification(profileId: string, certificationId: string): Promise<void> {
    await this.delete(`freelancers/${profileId}/certifications/${certificationId}`);
  }

  // ==========================================================================
  // Education & Work History
  // ==========================================================================

  /**
   * Add education
   */
  async addEducation(profileId: string, data: Omit<Education, 'id'>): Promise<Education> {
    return this.post<Education>(`freelancers/${profileId}/education`, data);
  }

  /**
   * Delete education
   */
  async deleteEducation(profileId: string, educationId: string): Promise<void> {
    await this.delete(`freelancers/${profileId}/education/${educationId}`);
  }

  /**
   * Add work history
   */
  async addWorkHistory(profileId: string, data: Omit<WorkHistory, 'id'>): Promise<WorkHistory> {
    return this.post<WorkHistory>(`freelancers/${profileId}/work-history`, data);
  }

  /**
   * Delete work history
   */
  async deleteWorkHistory(profileId: string, workHistoryId: string): Promise<void> {
    await this.delete(`freelancers/${profileId}/work-history/${workHistoryId}`);
  }

  // ==========================================================================
  // Reviews
  // ==========================================================================

  /**
   * Get reviews for user
   */
  async getReviews(
    userId: string,
    params?: {
      type?: Review['type'];
      minRating?: number;
      pagination?: Pagination;
    }
  ): Promise<{ reviews: Review[]; total: number; averageRating: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.type) searchParams['type'] = params.type;
    if (params?.minRating) searchParams['minRating'] = String(params.minRating);
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ reviews: Review[]; total: number; averageRating: number }>(
      `users/${userId}/reviews`,
      { searchParams }
    );
  }

  /**
   * Create review
   */
  async createReview(data: {
    contractId: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    return this.post<Review>('reviews', data);
  }

  // ==========================================================================
  // Dashboard
  // ==========================================================================

  /**
   * Get dashboard stats
   */
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    return this.get<DashboardStats>(`dashboard/${userId}/stats`);
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(
    userId: string,
    pagination?: Pagination
  ): Promise<{ activities: ActivityItem[]; total: number }> {
    const searchParams = this.buildPaginationParams(pagination);
    return this.get<{ activities: ActivityItem[]; total: number }>(`dashboard/${userId}/activity`, {
      searchParams,
    });
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  /**
   * Get notifications
   */
  async getNotifications(
    userId: string,
    params?: {
      unreadOnly?: boolean;
      type?: string;
      pagination?: Pagination;
    }
  ): Promise<{ notifications: Notification[]; total: number; unreadCount: number }> {
    const searchParams: Record<string, string> = {};

    if (params?.unreadOnly) searchParams['unreadOnly'] = 'true';
    if (params?.type) searchParams['type'] = params.type;
    if (params?.pagination) {
      Object.assign(searchParams, this.buildPaginationParams(params.pagination));
    }

    return this.get<{ notifications: Notification[]; total: number; unreadCount: number }>(
      `users/${userId}/notifications`,
      { searchParams }
    );
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(userId: string, notificationId: string): Promise<Notification> {
    return this.post<Notification>(`users/${userId}/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
    return this.post<{ updated: number }>(`users/${userId}/notifications/read-all`);
  }

  // ==========================================================================
  // Saved Searches
  // ==========================================================================

  /**
   * Get saved searches
   */
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return this.get<SavedSearch[]>(`users/${userId}/saved-searches`);
  }

  /**
   * Create saved search
   */
  async createSavedSearch(
    userId: string,
    data: Omit<SavedSearch, 'id' | 'userId' | 'createdAt'>
  ): Promise<SavedSearch> {
    return this.post<SavedSearch>(`users/${userId}/saved-searches`, data);
  }

  /**
   * Delete saved search
   */
  async deleteSavedSearch(userId: string, searchId: string): Promise<void> {
    await this.delete(`users/${userId}/saved-searches/${searchId}`);
  }

  /**
   * Toggle saved search alerts
   */
  async toggleSavedSearchAlerts(
    userId: string,
    searchId: string,
    enabled: boolean
  ): Promise<SavedSearch> {
    return this.patch<SavedSearch>(`users/${userId}/saved-searches/${searchId}`, {
      alertEnabled: enabled,
    });
  }
}

// Export singleton instance
export const cockpitClient = new CockpitServiceClient();
