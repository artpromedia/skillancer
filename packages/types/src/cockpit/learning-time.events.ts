/**
 * Learning Time Events
 * Event definitions for SkillPod ↔ Cockpit learning time integration
 */

// ============================================================================
// SkillPod → Cockpit Events
// ============================================================================

export interface LearningSessionStartedEvent {
  eventType: 'learning.session.started';
  timestamp: Date;
  payload: {
    userId: string;
    sessionId: string;
    contentType: 'COURSE' | 'LESSON' | 'ASSESSMENT' | 'PROJECT' | 'ARTICLE' | 'PRACTICE';
    contentId: string;
    contentTitle: string;
    courseId?: string;
    courseTitle?: string;
    skillIds: string[];
    skillNames: string[];
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
    estimatedDuration?: number;
    device: 'WEB' | 'MOBILE' | 'TABLET';
  };
}

export interface LearningSessionEndedEvent {
  eventType: 'learning.session.ended';
  timestamp: Date;
  payload: {
    userId: string;
    sessionId: string;
    contentType: string;
    contentId: string;
    contentTitle: string;
    courseId?: string;
    courseTitle?: string;
    skillIds: string[];
    skillNames: string[];
    startTime: Date;
    endTime: Date;
    totalDurationMinutes: number;
    activeDurationMinutes: number;
    pausedDurationMinutes: number;
    progressBefore: number;
    progressAfter: number;
    progressGained: number;
    videoWatchedMinutes?: number;
    articleReadMinutes?: number;
    exercisesCompleted?: number;
    questionsAnswered?: number;
    codeExecutions?: number;
    isCompleted: boolean;
    completionPercentage: number;
  };
}

export interface LearningMilestoneAchievedEvent {
  eventType: 'learning.milestone.achieved';
  timestamp: Date;
  payload: {
    userId: string;
    milestoneType:
      | 'LESSON_COMPLETE'
      | 'MODULE_COMPLETE'
      | 'COURSE_COMPLETE'
      | 'ASSESSMENT_PASSED'
      | 'CERTIFICATION_EARNED'
      | 'LEARNING_PATH_COMPLETE';
    contentId: string;
    contentTitle: string;
    courseId?: string;
    courseTitle?: string;
    skillIds: string[];
    skillNames: string[];
    score?: number;
    percentile?: number;
    timeInvested: number;
    credentialEarned?: {
      id: string;
      title: string;
      type: string;
    };
  };
}

export interface DailyLearningSummaryEvent {
  eventType: 'learning.daily.summary';
  timestamp: Date;
  payload: {
    userId: string;
    date: Date;
    totalMinutes: number;
    activeMinutes: number;
    courseMinutes: number;
    assessmentMinutes: number;
    practiceMinutes: number;
    readingMinutes: number;
    lessonsCompleted: number;
    exercisesCompleted: number;
    assessmentsTaken: number;
    assessmentsPassed: number;
    skills: Array<{
      skillId: string;
      skillName: string;
      minutes: number;
      progressGained: number;
    }>;
    currentStreak: number;
    longestStreak: number;
  };
}

// ============================================================================
// Cockpit → SkillPod Events
// ============================================================================

export interface LearningGoalSetEvent {
  eventType: 'learning.goal.set';
  timestamp: Date;
  payload: {
    userId: string;
    goalId: string;
    goalType:
      | 'WEEKLY_HOURS'
      | 'MONTHLY_HOURS'
      | 'COURSE_COMPLETION'
      | 'SKILL_LEVEL'
      | 'CERTIFICATION';
    targetValue: number;
    targetSkillId?: string;
    targetCourseId?: string;
    targetCertificationId?: string;
    deadline?: Date;
  };
}

export interface LearningBudgetSetEvent {
  eventType: 'learning.budget.set';
  timestamp: Date;
  payload: {
    userId: string;
    period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    budgetAmount: number;
    budgetHours: number;
    startDate: Date;
    categories?: Array<{
      category: string;
      amount: number;
      hours: number;
    }>;
  };
}

export type LearningTimeEvent =
  | LearningSessionStartedEvent
  | LearningSessionEndedEvent
  | LearningMilestoneAchievedEvent
  | DailyLearningSummaryEvent
  | LearningGoalSetEvent
  | LearningBudgetSetEvent;
