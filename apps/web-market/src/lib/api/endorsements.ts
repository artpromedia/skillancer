import { apiClient, type ApiResponse } from './client';

// Types
export interface Endorsement {
  id: string;
  endorserId: string;
  endorser: {
    id: string;
    name: string;
    title: string;
    avatar?: string;
    verified: boolean;
  };
  skillId: string;
  skillName: string;
  relationship: 'client' | 'collaborator' | 'other';
  testimonialText?: string;
  projectContext?: string;
  isStrong: boolean;
  isVisible: boolean;
  createdAt: string;
}

export interface EndorsementRequest {
  id: string;
  requesterId: string;
  requester: {
    name: string;
    avatar?: string;
  };
  skillName: string;
  message?: string;
  status: 'pending' | 'completed' | 'declined';
  createdAt: string;
  respondedAt?: string;
}

export interface EndorsementStats {
  totalReceived: number;
  totalGiven: number;
  bySkill: Array<{
    skillName: string;
    count: number;
    notableEndorsers: Array<{
      name: string;
      avatar?: string;
    }>;
  }>;
  pending: number;
}

export interface EndorsementInput {
  endorseeId: string;
  skillName: string;
  relationship: 'client' | 'collaborator' | 'other';
  testimonialText?: string;
  projectContext?: string;
  isStrong?: boolean;
}

export interface EndorsementRequestInput {
  endorseeId: string;
  skillName: string;
  message?: string;
}

// API Functions
export const endorsementsApi = {
  // Get received endorsements
  async getEndorsementsReceived(
    userId: string,
    params?: {
      skillId?: string;
      visible?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<ApiResponse<Endorsement[]>> {
    return apiClient.get<Endorsement[]>(`/profiles/${userId}/endorsements`, { params });
  },

  // Get given endorsements
  async getEndorsementsGiven(
    userId: string,
    params?: {
      page?: number;
      limit?: number;
    }
  ): Promise<ApiResponse<Endorsement[]>> {
    return apiClient.get<Endorsement[]>(`/users/${userId}/endorsements/given`, { params });
  },

  // Get endorsement stats
  async getEndorsementStats(userId: string): Promise<ApiResponse<EndorsementStats>> {
    return apiClient.get<EndorsementStats>(`/profiles/${userId}/endorsements/stats`);
  },

  // Give an endorsement
  async giveEndorsement(data: EndorsementInput): Promise<ApiResponse<Endorsement>> {
    return apiClient.post<Endorsement>('/endorsements', data);
  },

  // Request an endorsement
  async requestEndorsement(
    data: EndorsementRequestInput
  ): Promise<ApiResponse<EndorsementRequest>> {
    return apiClient.post<EndorsementRequest>('/endorsements/request', data);
  },

  // Get pending requests
  async getPendingRequests(): Promise<ApiResponse<EndorsementRequest[]>> {
    return apiClient.get<EndorsementRequest[]>('/endorsements/requests/pending');
  },

  // Respond to endorsement request
  async respondToRequest(
    requestId: string,
    response: {
      action: 'accept' | 'decline';
      testimonialText?: string;
      projectContext?: string;
    }
  ): Promise<ApiResponse<{ success: boolean; endorsement?: Endorsement }>> {
    return apiClient.post(`/endorsements/requests/${requestId}/respond`, response);
  },

  // Hide endorsement
  async hideEndorsement(endorsementId: string): Promise<ApiResponse<{ hidden: boolean }>> {
    return apiClient.patch(`/endorsements/${endorsementId}/visibility`, { visible: false });
  },

  // Show endorsement
  async showEndorsement(endorsementId: string): Promise<ApiResponse<{ visible: boolean }>> {
    return apiClient.patch(`/endorsements/${endorsementId}/visibility`, { visible: true });
  },

  // Delete endorsement (only endorser can delete)
  async deleteEndorsement(endorsementId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiClient.delete(`/endorsements/${endorsementId}`);
  },

  // Get endorsements grouped by skill
  async getEndorsementsBySkill(userId: string): Promise<
    ApiResponse<
      Array<{
        skillName: string;
        endorsements: Endorsement[];
        count: number;
      }>
    >
  > {
    return apiClient.get(`/profiles/${userId}/endorsements/by-skill`);
  },

  // Get top endorsed skills
  async getTopEndorsedSkills(
    userId: string,
    limit: number = 5
  ): Promise<
    ApiResponse<
      Array<{
        skillName: string;
        count: number;
        notableEndorsers: Array<{
          name: string;
          avatar?: string;
          verified: boolean;
        }>;
      }>
    >
  > {
    return apiClient.get(`/profiles/${userId}/endorsements/top`, {
      params: { limit },
    });
  },

  // Check if user can endorse (prevents duplicate endorsements)
  async canEndorse(
    endorseeId: string,
    skillName: string
  ): Promise<ApiResponse<{ canEndorse: boolean; reason?: string }>> {
    return apiClient.get(`/endorsements/can-endorse`, {
      params: { endorseeId, skillName },
    });
  },
};

export default endorsementsApi;
