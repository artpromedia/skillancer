/**
 * Skills API Client
 *
 * Provides methods for interacting with skill-related services.
 * Handles skills inventory, skill gaps, market trends, and skill health.
 */

import { apiClient, type ApiResponse } from './client';

// Types
export interface Skill {
  id: string;
  name: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  levelScore: number; // 0-100
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  lastUsed?: string;
  experience: string; // e.g., "3 years"
  projects: number;
  endorsements: number;
  marketDemand: 'high' | 'medium' | 'low';
  demandGrowth: number; // percentage
  certifications?: {
    id: string;
    name: string;
    issuer: string;
    issuedAt: string;
    expiresAt?: string;
    url?: string;
  }[];
  relatedSkills?: string[];
}

export interface SkillGap {
  id: string;
  skillName: string;
  currentLevel: 'None' | 'Beginner' | 'Intermediate' | 'Advanced';
  requiredLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: {
    missedJobs: number;
    potentialRateIncrease: string;
    opportunityScore: number;
  };
  relatedJobs: string[];
  learningPaths: string[];
  estimatedTimeToLearn: string;
}

export interface MarketTrend {
  id: string;
  skillName: string;
  category: string;
  demandLevel: 'emerging' | 'growing' | 'stable' | 'declining';
  demandScore: number; // 0-100
  growthRate: number; // percentage year-over-year
  salaryImpact: string;
  jobCount: number;
  projectedGrowth: string;
  relatedSkills: string[];
  history: {
    date: string;
    demand: number;
  }[];
}

export interface SkillHealth {
  overallScore: number; // 0-100
  breakdown: {
    coverage: number;
    recency: number;
    verification: number;
    marketAlignment: number;
  };
  peerComparison: {
    percentile: number;
    averageScore: number;
  };
  recommendations: string[];
}

export interface SkillVerification {
  id: string;
  skillId: string;
  type: 'assessment' | 'project' | 'certification' | 'endorsement';
  status: 'pending' | 'passed' | 'failed' | 'expired';
  score?: number;
  completedAt?: string;
  expiresAt?: string;
  badge?: {
    id: string;
    name: string;
    imageUrl: string;
  };
}

// API Methods

/**
 * Get user's skill inventory
 */
export async function getSkills(params?: {
  category?: string;
  level?: string;
  verified?: boolean;
  search?: string;
}): Promise<ApiResponse<Skill[]>> {
  return apiClient.get('/skills', { params });
}

/**
 * Get a specific skill
 */
export async function getSkill(id: string): Promise<ApiResponse<Skill>> {
  return apiClient.get(`/skills/${id}`);
}

/**
 * Add a skill to inventory
 */
export async function addSkill(skill: {
  name: string;
  level: Skill['level'];
  experience?: string;
}): Promise<ApiResponse<Skill>> {
  return apiClient.post('/skills', skill);
}

/**
 * Update a skill
 */
export async function updateSkill(
  id: string,
  updates: Partial<Skill>
): Promise<ApiResponse<Skill>> {
  return apiClient.patch(`/skills/${id}`, updates);
}

/**
 * Remove a skill from inventory
 */
export async function removeSkill(id: string): Promise<ApiResponse<void>> {
  return apiClient.delete(`/skills/${id}`);
}

/**
 * Get skill gaps analysis
 */
export async function getSkillGaps(params?: {
  severity?: string;
  category?: string;
  limit?: number;
}): Promise<ApiResponse<SkillGap[]>> {
  return apiClient.get('/skills/gaps', { params });
}

/**
 * Get gap analysis summary
 */
export async function getGapsSummary(): Promise<
  ApiResponse<{
    criticalCount: number;
    totalGaps: number;
    potentialEarnings: string;
    missedOpportunities: number;
    topGaps: SkillGap[];
  }>
> {
  return apiClient.get('/skills/gaps/summary');
}

/**
 * Get market trends
 */
export async function getMarketTrends(params?: {
  category?: string;
  timeRange?: '3m' | '6m' | '1y' | '2y';
  demandLevel?: string;
  limit?: number;
}): Promise<ApiResponse<MarketTrend[]>> {
  return apiClient.get('/skills/trends', { params });
}

/**
 * Get emerging skills
 */
export async function getEmergingSkills(params?: { category?: string; limit?: number }): Promise<
  ApiResponse<{
    hotOpportunities: MarketTrend[];
    growingWithYou: MarketTrend[];
    futureProof: MarketTrend[];
  }>
> {
  return apiClient.get('/skills/trends/emerging', { params });
}

/**
 * Get skill health score
 */
export async function getSkillHealth(): Promise<ApiResponse<SkillHealth>> {
  return apiClient.get('/skills/health');
}

/**
 * Get skill categories
 */
export async function getCategories(): Promise<
  ApiResponse<
    {
      id: string;
      name: string;
      skillCount: number;
      icon?: string;
    }[]
  >
> {
  return apiClient.get('/skills/categories');
}

/**
 * Start skill verification
 */
export async function startVerification(params: {
  skillId: string;
  type: SkillVerification['type'];
}): Promise<ApiResponse<SkillVerification>> {
  return apiClient.post('/skills/verification/start', params);
}

/**
 * Get verification status
 */
export async function getVerification(id: string): Promise<ApiResponse<SkillVerification>> {
  return apiClient.get(`/skills/verification/${id}`);
}

/**
 * Get all verifications for user
 */
export async function getVerifications(params?: {
  status?: string;
  skillId?: string;
}): Promise<ApiResponse<SkillVerification[]>> {
  return apiClient.get('/skills/verification', { params });
}

/**
 * Submit verification assessment
 */
export async function submitAssessment(params: {
  verificationId: string;
  answers: Record<string, unknown>;
}): Promise<
  ApiResponse<{
    passed: boolean;
    score: number;
    feedback?: string;
  }>
> {
  return apiClient.post('/skills/verification/submit', params);
}

/**
 * Get skill endorsements
 */
export async function getEndorsements(skillId: string): Promise<
  ApiResponse<
    {
      id: string;
      endorserId: string;
      endorserName: string;
      endorserAvatar?: string;
      relationship: string;
      message?: string;
      createdAt: string;
    }[]
  >
> {
  return apiClient.get(`/skills/${skillId}/endorsements`);
}

/**
 * Request skill endorsement
 */
export async function requestEndorsement(params: {
  skillId: string;
  recipientEmail: string;
  message?: string;
}): Promise<ApiResponse<{ requestId: string }>> {
  return apiClient.post('/skills/endorsement/request', params);
}

/**
 * Compare skills with job requirements
 */
export async function compareWithJob(jobId: string): Promise<
  ApiResponse<{
    matchScore: number;
    matchedSkills: string[];
    missingSkills: string[];
    recommendations: {
      skillName: string;
      priority: 'high' | 'medium' | 'low';
      learningPath?: string;
    }[];
  }>
> {
  return apiClient.get(`/skills/compare/job/${jobId}`);
}

/**
 * Get skill history/progression
 */
export async function getSkillHistory(skillId: string): Promise<
  ApiResponse<{
    timeline: {
      date: string;
      event: string;
      levelChange?: string;
    }[];
    levelProgression: {
      date: string;
      level: number;
    }[];
  }>
> {
  return apiClient.get(`/skills/${skillId}/history`);
}

/**
 * Bulk import skills (e.g., from LinkedIn)
 */
export async function importSkills(params: {
  source: 'linkedin' | 'resume' | 'github' | 'manual';
  data: Record<string, unknown>;
}): Promise<
  ApiResponse<{
    imported: number;
    updated: number;
    skipped: number;
    skills: Skill[];
  }>
> {
  return apiClient.post('/skills/import', params);
}

export const skillsApi = {
  getSkills,
  getSkill,
  addSkill,
  updateSkill,
  removeSkill,
  getSkillGaps,
  getGapsSummary,
  getMarketTrends,
  getEmergingSkills,
  getSkillHealth,
  getCategories,
  startVerification,
  getVerification,
  getVerifications,
  submitAssessment,
  getEndorsements,
  requestEndorsement,
  compareWithJob,
  getSkillHistory,
  importSkills,
};

export default skillsApi;
