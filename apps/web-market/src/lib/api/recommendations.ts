import { apiClient, type ApiResponse } from './client';

// Types
export interface Recommendation {
  id: string;
  recommenderId: string;
  recommender: {
    id: string;
    name: string;
    title: string;
    avatar?: string;
    verified: boolean;
  };
  recipientId: string;
  relationship: 'client' | 'employer' | 'colleague' | 'other';
  duration: string;
  text: string;
  skillsHighlighted: string[];
  status: 'pending' | 'approved' | 'displayed' | 'hidden';
  displayOrder?: number;
  createdAt: string;
  approvedAt?: string;
}

export interface RecommendationRequest {
  id: string;
  requesterId: string;
  requester: {
    name: string;
    avatar?: string;
  };
  message?: string;
  status: 'pending' | 'completed' | 'declined';
  createdAt: string;
  respondedAt?: string;
}

export interface RecommendationInput {
  recipientId: string;
  relationship: 'client' | 'employer' | 'colleague' | 'other';
  duration: string;
  text: string;
  skillsHighlighted?: string[];
}

export interface RecommendationRequestInput {
  recipientId: string;
  message?: string;
}

// API Functions
export const recommendationsApi = {
  // Get recommendations for a user
  async getRecommendations(
    userId: string,
    params?: {
      status?: 'displayed' | 'hidden' | 'pending' | 'all';
      page?: number;
      limit?: number;
    }
  ): Promise<ApiResponse<Recommendation[]>> {
    return apiClient.get<Recommendation[]>(`/profiles/${userId}/recommendations`, { params });
  },

  // Get recommendations received by user
  async getRecommendationsReceived(userId: string): Promise<ApiResponse<Recommendation[]>> {
    return apiClient.get<Recommendation[]>(`/users/${userId}/recommendations/received`);
  },

  // Get recommendations given by user
  async getRecommendationsGiven(userId: string): Promise<ApiResponse<Recommendation[]>> {
    return apiClient.get<Recommendation[]>(`/users/${userId}/recommendations/given`);
  },

  // Write a recommendation
  async writeRecommendation(data: RecommendationInput): Promise<ApiResponse<Recommendation>> {
    return apiClient.post<Recommendation>('/recommendations', data);
  },

  // Request a recommendation
  async requestRecommendation(
    data: RecommendationRequestInput
  ): Promise<ApiResponse<RecommendationRequest>> {
    return apiClient.post<RecommendationRequest>('/recommendations/request', data);
  },

  // Get pending recommendation requests
  async getPendingRequests(): Promise<ApiResponse<RecommendationRequest[]>> {
    return apiClient.get<RecommendationRequest[]>('/recommendations/requests/pending');
  },

  // Respond to recommendation request
  async respondToRequest(
    requestId: string,
    response: {
      action: 'accept' | 'decline';
      recommendation?: RecommendationInput;
    }
  ): Promise<ApiResponse<{ success: boolean; recommendation?: Recommendation }>> {
    return apiClient.post(`/recommendations/requests/${requestId}/respond`, response);
  },

  // Approve recommendation (recipient approves for display)
  async approveRecommendation(
    recommendationId: string
  ): Promise<ApiResponse<{ approved: boolean }>> {
    return apiClient.patch(`/recommendations/${recommendationId}/approve`);
  },

  // Hide recommendation
  async hideRecommendation(recommendationId: string): Promise<ApiResponse<{ hidden: boolean }>> {
    return apiClient.patch(`/recommendations/${recommendationId}/hide`);
  },

  // Show recommendation
  async showRecommendation(recommendationId: string): Promise<ApiResponse<{ visible: boolean }>> {
    return apiClient.patch(`/recommendations/${recommendationId}/show`);
  },

  // Delete recommendation (only recommender can delete before approval)
  async deleteRecommendation(recommendationId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiClient.delete(`/recommendations/${recommendationId}`);
  },

  // Reorder recommendations for display
  async reorderRecommendations(
    userId: string,
    order: string[]
  ): Promise<ApiResponse<{ success: boolean }>> {
    return apiClient.post(`/profiles/${userId}/recommendations/reorder`, { order });
  },

  // Get recommendation stats
  async getRecommendationStats(userId: string): Promise<
    ApiResponse<{
      totalReceived: number;
      totalGiven: number;
      pending: number;
      displayed: number;
      byRelationship: Array<{
        relationship: string;
        count: number;
      }>;
    }>
  > {
    return apiClient.get(`/profiles/${userId}/recommendations/stats`);
  },

  // Get featured recommendations (top 3-5 for profile display)
  async getFeaturedRecommendations(
    userId: string,
    limit: number = 3
  ): Promise<ApiResponse<Recommendation[]>> {
    return apiClient.get(`/profiles/${userId}/recommendations/featured`, {
      params: { limit },
    });
  },
};

export default recommendationsApi;
