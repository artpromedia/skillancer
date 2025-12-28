import { apiClient, type ApiResponse } from './client';

// Types
export interface Credential {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  level: 'foundation' | 'associate' | 'professional' | 'expert';
  badge: string;
  gradient: string;
  holder: {
    id: string;
    name: string;
    avatar?: string;
  };
  issuer: {
    name: string;
    logo?: string;
    verified: boolean;
  };
  issuedAt: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'revoked';
  assessment: {
    id: string;
    title: string;
    score: number;
    completedAt: string;
  };
  skills: Array<{
    name: string;
    score: number;
  }>;
  verificationUrl: string;
  metadata?: Record<string, unknown>;
}

export interface ExternalCredential {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  status: 'pending' | 'verified' | 'failed' | 'rejected';
  category?: string;
  evidence?: {
    type: 'file' | 'url' | 'manual';
    fileUrl?: string;
    url?: string;
  };
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface CredentialVerification {
  valid: boolean;
  credential?: Credential;
  holder?: {
    name: string;
    avatar?: string;
  };
  issuer?: {
    name: string;
    verified: boolean;
  };
  verifiedAt: string;
  error?: string;
}

// API Functions
export const credentialsApi = {
  // List user's credentials
  async list(params?: {
    category?: string;
    status?: 'active' | 'expired' | 'all';
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Credential[]>> {
    return apiClient.get<Credential[]>('/credentials', { params });
  },

  // Get single credential
  async get(credentialId: string): Promise<ApiResponse<Credential>> {
    return apiClient.get<Credential>(`/credentials/${credentialId}`);
  },

  // Get credential by verification code
  async getByCode(code: string): Promise<ApiResponse<Credential>> {
    return apiClient.get<Credential>(`/credentials/code/${code}`);
  },

  // Verify a credential (public)
  async verify(code: string): Promise<ApiResponse<CredentialVerification>> {
    return apiClient.get<CredentialVerification>(`/verify/${code}`);
  },

  // Get credential stats
  async getStats(): Promise<
    ApiResponse<{
      total: number;
      active: number;
      expired: number;
      expiringWithin30Days: number;
      byCategory: Array<{ category: string; count: number }>;
      byLevel: Array<{ level: string; count: number }>;
    }>
  > {
    return apiClient.get('/credentials/stats');
  },

  // Get badge image URL
  getBadgeUrl(code: string, size?: 'sm' | 'md' | 'lg'): string {
    const sizeParam = size ? `?size=${size}` : '';
    return `/api/credential-badge/${code}${sizeParam}`;
  },

  // Share credential
  async share(
    credentialId: string,
    options: {
      platform?: 'linkedin' | 'twitter' | 'facebook' | 'email';
      expiresAt?: string;
    }
  ): Promise<
    ApiResponse<{
      shareUrl: string;
      embedCode?: string;
    }>
  > {
    return apiClient.post(`/credentials/${credentialId}/share`, options);
  },

  // Download credential
  async download(credentialId: string, format: 'pdf' | 'png' | 'json'): Promise<Blob> {
    const response = await fetch(`/api/credentials/${credentialId}/download?format=${format}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    return response.blob();
  },

  // Import external credential
  async importCredential(data: {
    type: 'file' | 'url' | 'manual';
    fileUrl?: string;
    url?: string;
    name?: string;
    issuer?: string;
    issueDate?: string;
    expiryDate?: string;
    credentialId?: string;
  }): Promise<ApiResponse<ExternalCredential>> {
    return apiClient.post('/credentials/import', data);
  },

  // List external credentials
  async listExternal(params?: {
    status?: 'pending' | 'verified' | 'failed' | 'all';
  }): Promise<ApiResponse<ExternalCredential[]>> {
    return apiClient.get('/credentials/external', { params });
  },

  // Verify external credential
  async verifyExternal(externalCredentialId: string): Promise<
    ApiResponse<{
      status: 'verified' | 'failed';
      message?: string;
    }>
  > {
    return apiClient.post(`/credentials/external/${externalCredentialId}/verify`);
  },

  // Delete external credential
  async deleteExternal(externalCredentialId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return apiClient.delete(`/credentials/external/${externalCredentialId}`);
  },

  // Get public profile credentials
  async getPublicCredentials(username: string): Promise<
    ApiResponse<{
      credentials: Credential[];
      stats: {
        total: number;
        topSkills: Array<{ name: string; score: number }>;
      };
    }>
  > {
    return apiClient.get(`/users/${username}/credentials`);
  },

  // Toggle credential visibility
  async toggleVisibility(
    credentialId: string,
    visible: boolean
  ): Promise<ApiResponse<{ visible: boolean }>> {
    return apiClient.patch(`/credentials/${credentialId}/visibility`, { visible });
  },

  // Get expiring credentials
  async getExpiring(days: number = 30): Promise<ApiResponse<Credential[]>> {
    return apiClient.get('/credentials/expiring', { params: { days } });
  },

  // Request renewal
  async requestRenewal(credentialId: string): Promise<
    ApiResponse<{
      assessmentId: string;
      scheduledAt?: string;
    }>
  > {
    return apiClient.post(`/credentials/${credentialId}/renew`);
  },

  // Get available categories
  async getCategories(): Promise<
    ApiResponse<
      Array<{
        id: string;
        name: string;
        count: number;
        icon?: string;
      }>
    >
  > {
    return apiClient.get('/credentials/categories');
  },

  // Generate embed code
  getEmbedCode(
    code: string,
    options?: { theme?: 'light' | 'dark'; size?: 'sm' | 'md' | 'lg' }
  ): string {
    const theme = options?.theme || 'light';
    const size = options?.size || 'md';
    const url = `https://skillancer.com/verify/${code}`;
    const badgeUrl = `https://skillancer.com/api/credential-badge/${code}?theme=${theme}&size=${size}`;

    return `<a href="${url}" target="_blank" rel="noopener noreferrer">
  <img src="${badgeUrl}" alt="Skillancer Verified Credential" />
</a>`;
  },
};

export default credentialsApi;
