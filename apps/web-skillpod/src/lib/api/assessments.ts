import { apiClient, type ApiResponse } from './client';

// Types
export interface Assessment {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  duration: number; // minutes
  questionsCount: number;
  passingScore: number;
  skills: string[];
  prerequisites?: string[];
  proctored: boolean;
  credentialId?: string;
  status: 'available' | 'locked' | 'completed';
  lastAttempt?: {
    date: string;
    score: number;
    passed: boolean;
  };
  nextAttemptAt?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'code-challenge' | 'short-answer' | 'practical-task';
  content: string;
  options?: Array<{
    id: string;
    text: string;
    isCorrect?: boolean; // Only in review mode
  }>;
  codeTemplate?: string;
  language?: string;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isHidden?: boolean;
  }>;
  hints?: string[];
  points: number;
  timeLimit?: number;
}

export interface AssessmentAttempt {
  id: string;
  assessmentId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  expiresAt: string;
  status: 'in-progress' | 'completed' | 'expired' | 'abandoned';
  currentQuestionIndex: number;
  answers: Record<string, unknown>;
  flaggedQuestions: string[];
  proctoringData?: {
    violations: Array<{
      type: string;
      timestamp: string;
      severity: 'warning' | 'critical';
    }>;
    confidenceScore: number;
  };
}

export interface AssessmentResult {
  id: string;
  attemptId: string;
  assessmentId: string;
  score: number;
  passed: boolean;
  questionsBreakdown: Array<{
    questionId: string;
    correct: boolean;
    points: number;
    maxPoints: number;
    feedback?: string;
  }>;
  skillsBreakdown: Array<{
    skill: string;
    score: number;
    level: string;
  }>;
  timeSpent: number;
  completedAt: string;
  credentialAwarded?: {
    id: string;
    code: string;
  };
}

// API Functions
export const assessmentsApi = {
  // List assessments
  async list(params?: {
    category?: string;
    difficulty?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<Assessment[]>> {
    return apiClient.get<Assessment[]>('/assessments', { params });
  },

  // Get single assessment
  async get(assessmentId: string): Promise<ApiResponse<Assessment>> {
    return apiClient.get<Assessment>(`/assessments/${assessmentId}`);
  },

  // Get assessment questions (starts attempt if not exists)
  async getQuestions(assessmentId: string): Promise<
    ApiResponse<{
      attempt: AssessmentAttempt;
      questions: Question[];
    }>
  > {
    return apiClient.get(`/assessments/${assessmentId}/questions`);
  },

  // Start a new attempt
  async startAttempt(assessmentId: string): Promise<ApiResponse<AssessmentAttempt>> {
    return apiClient.post(`/assessments/${assessmentId}/attempts`);
  },

  // Save answer
  async saveAnswer(
    attemptId: string,
    questionId: string,
    answer: unknown
  ): Promise<ApiResponse<{ success: boolean }>> {
    return apiClient.post(`/attempts/${attemptId}/answers`, {
      questionId,
      answer,
    });
  },

  // Flag/unflag question
  async toggleFlag(
    attemptId: string,
    questionId: string
  ): Promise<ApiResponse<{ flagged: boolean }>> {
    return apiClient.post(`/attempts/${attemptId}/flags/${questionId}`);
  },

  // Submit attempt for grading
  async submitAttempt(attemptId: string): Promise<ApiResponse<AssessmentResult>> {
    return apiClient.post(`/attempts/${attemptId}/submit`);
  },

  // Get attempt details
  async getAttempt(attemptId: string): Promise<ApiResponse<AssessmentAttempt>> {
    return apiClient.get(`/attempts/${attemptId}`);
  },

  // Get results
  async getResults(attemptId: string): Promise<ApiResponse<AssessmentResult>> {
    return apiClient.get(`/attempts/${attemptId}/results`);
  },

  // Get user's assessment history
  async getHistory(params?: {
    status?: 'completed' | 'in-progress' | 'all';
    page?: number;
    limit?: number;
  }): Promise<
    ApiResponse<
      Array<{
        assessment: Assessment;
        attempt: AssessmentAttempt;
        result?: AssessmentResult;
      }>
    >
  > {
    return apiClient.get('/assessments/history', { params });
  },

  // Submit proctoring event
  async submitProctoringEvent(
    attemptId: string,
    event: {
      type: string;
      severity: 'warning' | 'critical';
      data?: unknown;
    }
  ): Promise<ApiResponse<{ recorded: boolean }>> {
    return apiClient.post(`/attempts/${attemptId}/proctoring-events`, event);
  },

  // Run code for code challenge question
  async runCode(
    attemptId: string,
    questionId: string,
    code: string,
    language: string
  ): Promise<
    ApiResponse<{
      results: Array<{
        testCase: number;
        passed: boolean;
        output?: string;
        error?: string;
        executionTime: number;
      }>;
    }>
  > {
    return apiClient.post(`/attempts/${attemptId}/run-code`, {
      questionId,
      code,
      language,
    });
  },

  // Get scheduled assessments
  async getScheduled(): Promise<
    ApiResponse<
      Array<{
        assessment: Assessment;
        scheduledAt: string;
        reminderSent: boolean;
      }>
    >
  > {
    return apiClient.get('/assessments/scheduled');
  },

  // Schedule an assessment
  async schedule(
    assessmentId: string,
    scheduledAt: string
  ): Promise<ApiResponse<{ scheduled: boolean }>> {
    return apiClient.post(`/assessments/${assessmentId}/schedule`, {
      scheduledAt,
    });
  },

  // Cancel scheduled assessment
  async cancelSchedule(assessmentId: string): Promise<ApiResponse<{ cancelled: boolean }>> {
    return apiClient.delete(`/assessments/${assessmentId}/schedule`);
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
    return apiClient.get('/assessments/categories');
  },
};

export default assessmentsApi;
