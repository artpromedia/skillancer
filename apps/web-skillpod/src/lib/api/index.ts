/**
 * Skillpod API Clients
 *
 * Central export for all API clients used in the Skillpod application.
 */

export { apiClient } from './client';
export type { ApiResponse, ApiError, RequestConfig } from './client';

export { learningApi } from './learning';
export type {
  Recommendation,
  LearningPath,
  LearningModule,
  LearningItem,
  LearningActivity,
  LearningGoal,
  LearningStats,
  LearningStreak,
} from './learning';

export { skillsApi } from './skills';
export type { Skill, SkillGap, MarketTrend, SkillHealth, SkillVerification } from './skills';

export { assessmentsApi } from './assessments';
export type { Assessment, Question, AssessmentAttempt, AssessmentResult } from './assessments';

export { credentialsApi } from './credentials';
export type { Credential, ExternalCredential, CredentialVerification } from './credentials';
