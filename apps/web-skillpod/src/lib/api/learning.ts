/**
 * Learning API Client
 *
 * Provides methods for interacting with the learning and recommendation services.
 * Handles course recommendations, learning paths, activity tracking, and goals.
 */

import { apiClient, type ApiResponse } from './client';

// Types
export interface Recommendation {
  id: string;
  title: string;
  type: 'course' | 'certification' | 'project' | 'tutorial';
  provider: string;
  duration: string;
  relevanceScore: number;
  reasons: string[];
  thumbnail?: string;
  rating: number;
  enrollments: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  skills: string[];
  careerImpact: {
    rateIncrease: string;
    opportunityIncrease: string;
  };
  price?: string;
  url?: string;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  moduleCount: number;
  enrollments: number;
  rating: number;
  skills: string[];
  outcomes: string[];
  progress?: number;
  enrolled?: boolean;
  instructor?: {
    name: string;
    avatar?: string;
    title: string;
  };
  modules?: LearningModule[];
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  status: 'completed' | 'in-progress' | 'available' | 'locked';
  progress?: number;
  items: LearningItem[];
}

export interface LearningItem {
  id: string;
  title: string;
  type: 'video' | 'reading' | 'quiz' | 'exercise' | 'project';
  duration: string;
  status: 'completed' | 'in-progress' | 'available' | 'locked';
  url?: string;
}

export interface LearningActivity {
  id: string;
  type: 'progress' | 'completed' | 'started' | 'achievement' | 'project';
  title: string;
  subtitle: string;
  time: string;
  duration?: string;
  progress?: number;
  badge?: string;
  contentId?: string;
  contentType?: 'course' | 'path' | 'project';
}

export interface LearningGoal {
  id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  target: number;
  current: number;
  unit: string;
  dueDate?: string;
  status: 'on-track' | 'behind' | 'completed' | 'overdue';
}

export interface LearningStats {
  totalHours: number;
  thisWeek: number;
  streak: number;
  coursesCompleted: number;
  certificationsEarned: number;
  projectsFinished: number;
  skillsImproved: number;
}

export interface LearningStreak {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  lastActivityDate: string;
  heatmap: {
    date: string;
    level: 0 | 1 | 2 | 3 | 4;
  }[];
  weeklyGoal: {
    target: number;
    completed: number;
  };
}

// API Methods

/**
 * Get personalized learning recommendations
 */
export async function getRecommendations(params?: {
  limit?: number;
  types?: string[];
  levels?: string[];
  minRelevance?: number;
  skills?: string[];
}): Promise<ApiResponse<Recommendation[]>> {
  return apiClient.get('/learning/recommendations', { params });
}

/**
 * Dismiss a recommendation
 */
export async function dismissRecommendation(id: string): Promise<ApiResponse<void>> {
  return apiClient.post(`/learning/recommendations/${id}/dismiss`);
}

/**
 * Save a recommendation for later
 */
export async function saveRecommendation(id: string): Promise<ApiResponse<void>> {
  return apiClient.post(`/learning/recommendations/${id}/save`);
}

/**
 * Get saved recommendations
 */
export async function getSavedRecommendations(): Promise<ApiResponse<Recommendation[]>> {
  return apiClient.get('/learning/recommendations/saved');
}

/**
 * Get all learning paths
 */
export async function getLearningPaths(params?: {
  category?: string;
  difficulty?: string;
  enrolled?: boolean;
  search?: string;
}): Promise<ApiResponse<LearningPath[]>> {
  return apiClient.get('/learning/paths', { params });
}

/**
 * Get a specific learning path
 */
export async function getLearningPath(id: string): Promise<ApiResponse<LearningPath>> {
  return apiClient.get(`/learning/paths/${id}`);
}

/**
 * Enroll in a learning path
 */
export async function enrollInPath(id: string): Promise<ApiResponse<{ enrolledAt: string }>> {
  return apiClient.post(`/learning/paths/${id}/enroll`);
}

/**
 * Unenroll from a learning path
 */
export async function unenrollFromPath(id: string): Promise<ApiResponse<void>> {
  return apiClient.delete(`/learning/paths/${id}/enroll`);
}

/**
 * Update progress on a learning item
 */
export async function updateProgress(params: {
  pathId?: string;
  moduleId?: string;
  itemId: string;
  progress: number;
  completed?: boolean;
}): Promise<ApiResponse<void>> {
  return apiClient.post('/learning/progress', params);
}

/**
 * Get learning activity feed
 */
export async function getActivity(params?: {
  limit?: number;
  offset?: number;
  type?: string;
}): Promise<ApiResponse<LearningActivity[]>> {
  return apiClient.get('/learning/activity', { params });
}

/**
 * Get learning statistics
 */
export async function getStats(): Promise<ApiResponse<LearningStats>> {
  return apiClient.get('/learning/stats');
}

/**
 * Get learning streak data
 */
export async function getStreak(): Promise<ApiResponse<LearningStreak>> {
  return apiClient.get('/learning/streak');
}

/**
 * Use a streak freeze
 */
export async function useStreakFreeze(): Promise<ApiResponse<{ freezesRemaining: number }>> {
  return apiClient.post('/learning/streak/freeze');
}

/**
 * Get learning goals
 */
export async function getGoals(): Promise<ApiResponse<LearningGoal[]>> {
  return apiClient.get('/learning/goals');
}

/**
 * Create a learning goal
 */
export async function createGoal(
  goal: Omit<LearningGoal, 'id' | 'current' | 'status'>
): Promise<ApiResponse<LearningGoal>> {
  return apiClient.post('/learning/goals', goal);
}

/**
 * Update a learning goal
 */
export async function updateGoal(
  id: string,
  updates: Partial<LearningGoal>
): Promise<ApiResponse<LearningGoal>> {
  return apiClient.patch(`/learning/goals/${id}`, updates);
}

/**
 * Delete a learning goal
 */
export async function deleteGoal(id: string): Promise<ApiResponse<void>> {
  return apiClient.delete(`/learning/goals/${id}`);
}

/**
 * Log learning time manually
 */
export async function logLearningTime(params: {
  contentId?: string;
  contentType?: 'course' | 'path' | 'project' | 'other';
  duration: number; // in minutes
  notes?: string;
}): Promise<ApiResponse<void>> {
  return apiClient.post('/learning/time', params);
}

/**
 * Get weekly learning summary
 */
export async function getWeeklySummary(): Promise<
  ApiResponse<{
    days: { date: string; hours: number; target: number }[];
    totalHours: number;
    targetHours: number;
    skillsProgressed: string[];
    completions: number;
  }>
> {
  return apiClient.get('/learning/summary/weekly');
}

/**
 * Get course/content details
 */
export async function getCourse(id: string): Promise<
  ApiResponse<{
    id: string;
    title: string;
    description: string;
    provider: string;
    duration: string;
    modules: LearningModule[];
    skills: string[];
    prerequisites: string[];
    rating: number;
    reviews: number;
  }>
> {
  return apiClient.get(`/learning/courses/${id}`);
}

/**
 * Start a course or content item
 */
export async function startCourse(id: string): Promise<ApiResponse<{ startedAt: string }>> {
  return apiClient.post(`/learning/courses/${id}/start`);
}

/**
 * Mark course as complete
 */
export async function completeCourse(id: string): Promise<
  ApiResponse<{
    completedAt: string;
    certificate?: {
      id: string;
      url: string;
    };
  }>
> {
  return apiClient.post(`/learning/courses/${id}/complete`);
}

export const learningApi = {
  getRecommendations,
  dismissRecommendation,
  saveRecommendation,
  getSavedRecommendations,
  getLearningPaths,
  getLearningPath,
  enrollInPath,
  unenrollFromPath,
  updateProgress,
  getActivity,
  getStats,
  getStreak,
  useStreakFreeze,
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  logLearningTime,
  getWeeklySummary,
  getCourse,
  startCourse,
  completeCourse,
};

export default learningApi;
