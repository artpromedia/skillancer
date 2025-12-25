/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/**
 * Skills API Client
 *
 * Functions for skill taxonomy, search, and verification
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001/api/v1';
const SKILLPOD_API_URL = process.env.NEXT_PUBLIC_SKILLPOD_API_URL ?? 'http://localhost:4003/api/v1';

// ============================================================================
// Types
// ============================================================================

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description?: string;
  categoryId: string;
  category: string;
  parentId?: string;
  synonyms?: string[];
  isActive: boolean;
  usageCount: number;
}

export interface SkillCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  iconUrl?: string;
  parentId?: string;
  children?: SkillCategory[];
  skillCount: number;
  displayOrder: number;
}

export interface SkillSearchResult {
  skills: Skill[];
  total: number;
  categories: { id: string; name: string; count: number }[];
}

export interface SkillVerification {
  id: string;
  userId: string;
  skillId: string;
  skillName: string;
  verificationType:
    | 'ASSESSMENT'
    | 'COURSE_COMPLETION'
    | 'CERTIFICATION'
    | 'PEER_ENDORSEMENT'
    | 'PROJECT_COMPLETION';
  score: number;
  maxScore: number;
  percentile?: number;
  proficiencyLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  confidenceScore: number;
  proctored: boolean;
  verifiedAt: string;
  validUntil?: string;
  isActive: boolean;
  showOnProfile: boolean;
  assessmentId?: string;
  credentialId?: string;
}

export interface SkillEndorsement {
  id: string;
  skillId: string;
  skillName: string;
  endorserId: string;
  endorserName: string;
  endorserAvatarUrl?: string;
  endorserTitle?: string;
  relationship: 'WORKED_TOGETHER' | 'MANAGED' | 'SUPERVISED' | 'COLLEAGUE' | 'CLIENT';
  message?: string;
  isVerified: boolean;
  createdAt: string;
}

export interface SkillConfidence {
  skillId: string;
  skillName: string;
  overallConfidence: number;
  assessmentScore?: number;
  learningScore?: number;
  experienceScore?: number;
  endorsementScore?: number;
  projectScore?: number;
  calculatedLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  claimedLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  levelMatch: boolean;
  confidenceTrend: number;
  lastActivityDate?: string;
}

export interface SkillAssessment {
  id: string;
  skillId: string;
  skillName: string;
  title: string;
  description: string;
  duration: number; // minutes
  questionCount: number;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  passingScore: number;
  isProctored: boolean;
  isFree: boolean;
  price?: number;
  currency?: string;
  totalAttempts: number;
  passRate: number;
  avgScore: number;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  userId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
  score?: number;
  passed?: boolean;
  percentile?: number;
  startedAt: string;
  completedAt?: string;
  timeSpent?: number;
  canRetake: boolean;
  retakeAvailableAt?: string;
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

// ============================================================================
// API Functions - Skill Taxonomy
// ============================================================================

/**
 * Search skills (autocomplete)
 */
export async function searchSkills(
  query: string,
  options: { limit?: number; categoryId?: string } = {}
): Promise<SkillSearchResult> {
  const params = new URLSearchParams({
    q: query,
    limit: String(options.limit ?? 20),
  });
  if (options.categoryId) {
    params.append('categoryId', options.categoryId);
  }

  return apiFetch<SkillSearchResult>(`${API_BASE_URL}/skills/search?${params.toString()}`);
}

/**
 * Get skill by ID
 */
export async function getSkillById(skillId: string): Promise<Skill> {
  return apiFetch<Skill>(`${API_BASE_URL}/skills/${skillId}`);
}

/**
 * Get skill by slug
 */
export async function getSkillBySlug(slug: string): Promise<Skill> {
  return apiFetch<Skill>(`${API_BASE_URL}/skills/slug/${slug}`);
}

/**
 * Get all skill categories
 */
export async function getSkillCategories(): Promise<SkillCategory[]> {
  return apiFetch<SkillCategory[]>(`${API_BASE_URL}/skills/categories`);
}

/**
 * Get skills in a category
 */
export async function getSkillsByCategory(categoryId: string): Promise<Skill[]> {
  return apiFetch<Skill[]>(`${API_BASE_URL}/skills/categories/${categoryId}/skills`);
}

/**
 * Get popular skills
 */
export async function getPopularSkills(limit = 20): Promise<Skill[]> {
  return apiFetch<Skill[]>(`${API_BASE_URL}/skills/popular?limit=${limit}`);
}

/**
 * Get trending skills
 */
export async function getTrendingSkills(limit = 10): Promise<Skill[]> {
  return apiFetch<Skill[]>(`${API_BASE_URL}/skills/trending?limit=${limit}`);
}

/**
 * Get related skills
 */
export async function getRelatedSkills(skillId: string, limit = 5): Promise<Skill[]> {
  return apiFetch<Skill[]>(`${API_BASE_URL}/skills/${skillId}/related?limit=${limit}`);
}

// ============================================================================
// API Functions - Skill Verification
// ============================================================================

/**
 * Get user's skill verifications
 */
export async function getUserSkillVerifications(userId: string): Promise<SkillVerification[]> {
  return apiFetch<SkillVerification[]>(`${API_BASE_URL}/credentials/verifications/${userId}`);
}

/**
 * Get verification for a specific skill
 */
export async function getSkillVerification(
  userId: string,
  skillId: string
): Promise<SkillVerification | null> {
  try {
    return await apiFetch<SkillVerification>(
      `${API_BASE_URL}/credentials/verifications/${userId}/${skillId}`
    );
  } catch {
    return null;
  }
}

/**
 * Get skill confidence scores for user
 */
export async function getUserSkillConfidence(userId: string): Promise<SkillConfidence[]> {
  return apiFetch<SkillConfidence[]>(`${API_BASE_URL}/credentials/confidence/${userId}`);
}

/**
 * Get confidence for a specific skill
 */
export async function getSkillConfidenceScore(
  userId: string,
  skillId: string
): Promise<SkillConfidence | null> {
  try {
    return await apiFetch<SkillConfidence>(
      `${API_BASE_URL}/credentials/confidence/${userId}/${skillId}`
    );
  } catch {
    return null;
  }
}

// ============================================================================
// API Functions - Endorsements
// ============================================================================

/**
 * Get endorsements for a user's skill
 */
export async function getSkillEndorsements(
  userId: string,
  skillId: string
): Promise<SkillEndorsement[]> {
  return apiFetch<SkillEndorsement[]>(
    `${API_BASE_URL}/profiles/${userId}/skills/${skillId}/endorsements`
  );
}

/**
 * Get all endorsements for a user
 */
export async function getUserEndorsements(userId: string): Promise<SkillEndorsement[]> {
  return apiFetch<SkillEndorsement[]>(`${API_BASE_URL}/profiles/${userId}/endorsements`);
}

/**
 * Request an endorsement
 */
export async function requestEndorsement(
  token: string,
  data: {
    skillId: string;
    endorserEmail: string;
    message?: string;
  }
): Promise<{ requestId: string; status: string }> {
  return apiFetch<{ requestId: string; status: string }>(
    `${API_BASE_URL}/profiles/me/endorsements/request`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }
  );
}

/**
 * Respond to an endorsement request
 */
export async function respondToEndorsement(
  token: string,
  requestId: string,
  data: {
    approve: boolean;
    message?: string;
    relationship: 'WORKED_TOGETHER' | 'MANAGED' | 'SUPERVISED' | 'COLLEAGUE' | 'CLIENT';
  }
): Promise<void> {
  await apiFetch<void>(`${API_BASE_URL}/endorsements/requests/${requestId}/respond`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

// ============================================================================
// API Functions - Assessments (SkillPod Integration)
// ============================================================================

/**
 * Get available assessments for a skill
 */
export async function getSkillAssessments(skillId: string): Promise<SkillAssessment[]> {
  return apiFetch<SkillAssessment[]>(`${SKILLPOD_API_URL}/assessments/skill/${skillId}`);
}

/**
 * Get assessment by ID
 */
export async function getAssessmentById(assessmentId: string): Promise<SkillAssessment> {
  return apiFetch<SkillAssessment>(`${SKILLPOD_API_URL}/assessments/${assessmentId}`);
}

/**
 * Get user's assessment attempts
 */
export async function getUserAssessmentAttempts(
  token: string,
  skillId?: string
): Promise<AssessmentAttempt[]> {
  const url = skillId
    ? `${SKILLPOD_API_URL}/assessments/attempts?skillId=${skillId}`
    : `${SKILLPOD_API_URL}/assessments/attempts`;

  return apiFetch<AssessmentAttempt[]>(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Start a skill assessment
 */
export async function startSkillAssessment(
  token: string,
  assessmentId: string
): Promise<{
  attemptId: string;
  sessionUrl: string;
  expiresAt: string;
}> {
  return apiFetch<{ attemptId: string; sessionUrl: string; expiresAt: string }>(
    `${SKILLPOD_API_URL}/assessments/${assessmentId}/start`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
}

/**
 * Get assessment attempt details
 */
export async function getAssessmentAttempt(
  token: string,
  attemptId: string
): Promise<AssessmentAttempt> {
  return apiFetch<AssessmentAttempt>(`${SKILLPOD_API_URL}/assessments/attempts/${attemptId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ============================================================================
// Skill Display Helpers
// ============================================================================

/**
 * Get proficiency level label
 */
export function getProficiencyLabel(
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'
): string {
  const labels = {
    BEGINNER: 'Beginner',
    INTERMEDIATE: 'Intermediate',
    ADVANCED: 'Advanced',
    EXPERT: 'Expert',
  };
  return labels[level];
}

/**
 * Get proficiency level color
 */
export function getProficiencyColor(
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'
): string {
  const colors = {
    BEGINNER: 'bg-gray-100 text-gray-700',
    INTERMEDIATE: 'bg-blue-100 text-blue-700',
    ADVANCED: 'bg-purple-100 text-purple-700',
    EXPERT: 'bg-emerald-100 text-emerald-700',
  };
  return colors[level];
}

/**
 * Get confidence score color
 */
export function getConfidenceColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-gray-600';
}

/**
 * Get verification badge info
 */
export function getVerificationBadgeInfo(
  type:
    | 'ASSESSMENT'
    | 'COURSE_COMPLETION'
    | 'CERTIFICATION'
    | 'PEER_ENDORSEMENT'
    | 'PROJECT_COMPLETION'
): { label: string; icon: string; color: string } {
  const badges = {
    ASSESSMENT: { label: 'SkillPod Verified', icon: 'Shield', color: 'text-emerald-600' },
    COURSE_COMPLETION: { label: 'Course Completed', icon: 'GraduationCap', color: 'text-blue-600' },
    CERTIFICATION: { label: 'Certified', icon: 'Award', color: 'text-purple-600' },
    PEER_ENDORSEMENT: { label: 'Peer Endorsed', icon: 'Users', color: 'text-indigo-600' },
    PROJECT_COMPLETION: { label: 'Project Verified', icon: 'Briefcase', color: 'text-amber-600' },
  };
  return badges[type];
}

/**
 * Format confidence score
 */
export function formatConfidenceScore(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Format assessment score
 */
export function formatAssessmentScore(score: number, maxScore: number): string {
  const percentage = (score / maxScore) * 100;
  return `${Math.round(percentage)}%`;
}
