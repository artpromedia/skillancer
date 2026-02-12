// @ts-nocheck
/**
 * Learning Time Sync Service
 * Handles SkillPod learning events and syncs to Cockpit time tracking
 */

import { type PrismaClient, type LearningContentType, GoalStatus } from '../types/prisma-shim.js';
import { logger } from '@skillancer/logger';

import { LearningGoalRepository } from '../repositories/learning-goal.repository';
import { LearningTimeEntryRepository } from '../repositories/learning-time-entry.repository';
import { SkillLearningProgressRepository } from '../repositories/skill-learning-progress.repository';

import type {
  LearningSessionEndedEvent,
  LearningMilestoneAchievedEvent,
  DailyLearningSummaryEvent,
} from '@skillancer/types/cockpit/learning-time.events';

export class LearningTimeSyncService {
  private timeRepo: LearningTimeEntryRepository;
  private goalRepo: LearningGoalRepository;
  private skillRepo: SkillLearningProgressRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.timeRepo = new LearningTimeEntryRepository(prisma);
    this.goalRepo = new LearningGoalRepository(prisma);
    this.skillRepo = new SkillLearningProgressRepository(prisma);
  }

  async handleSessionEnded(event: LearningSessionEndedEvent): Promise<void> {
    const { payload } = event;

    if (payload.activeDurationMinutes < 1) return;

    // Check for duplicate
    const existing = await this.timeRepo.findBySessionId(payload.sessionId);
    if (existing) {
      logger.debug('Duplicate session skipped', { sessionId: payload.sessionId });
      return;
    }

    // Create learning time entry
    await this.timeRepo.create({
      userId: payload.userId,
      skillPodSessionId: payload.sessionId,
      contentType: payload.contentType as LearningContentType,
      contentId: payload.contentId,
      contentTitle: payload.contentTitle,
      courseId: payload.courseId,
      courseTitle: payload.courseTitle,
      date: new Date(payload.startTime),
      startTime: new Date(payload.startTime),
      endTime: new Date(payload.endTime),
      totalMinutes: payload.totalDurationMinutes,
      activeMinutes: payload.activeDurationMinutes,
      skillIds: payload.skillIds,
      skillNames: payload.skillNames,
      primarySkillId: payload.skillIds[0],
      primarySkillName: payload.skillNames[0],
      category: 'Professional Development',
      subcategory: this.mapContentTypeToSubcategory(payload.contentType),
      progressGained: payload.progressGained,
      isCompleted: payload.isCompleted,
      isDeductible: true,
      deductionCategory: 'Education',
    });

    // Update skill progress
    for (let i = 0; i < payload.skillIds.length; i++) {
      await this.updateSkillProgress(
        payload.userId,
        payload.skillIds[i],
        payload.skillNames[i],
        Math.round(payload.activeDurationMinutes / payload.skillIds.length),
        payload.contentType
      );
    }

    // Update goal progress
    await this.checkGoalProgress(payload.userId);

    logger.info('Learning session synced', {
      sessionId: payload.sessionId,
      userId: payload.userId,
    });
  }

  async handleMilestoneAchieved(event: LearningMilestoneAchievedEvent): Promise<void> {
    const { payload } = event;

    for (let i = 0; i < payload.skillIds.length; i++) {
      const existing = await this.skillRepo.findByUserAndSkill(payload.userId, payload.skillIds[i]);
      if (existing) {
        const updates: any = { lastLearningDate: new Date() };

        if (payload.milestoneType === 'COURSE_COMPLETE') {
          updates.coursesCompleted = existing.coursesCompleted + 1;
        }
        if (payload.milestoneType === 'ASSESSMENT_PASSED') {
          updates.assessmentsPassed = existing.assessmentsPassed + 1;
          if (
            payload.score &&
            (!existing.highestScore || payload.score > Number(existing.highestScore))
          ) {
            updates.highestScore = payload.score;
          }
        }
        if (payload.credentialEarned) {
          updates.credentialsEarned = [...existing.credentialsEarned, payload.credentialEarned.id];
        }

        await this.skillRepo.update(existing.id, updates);
      }
    }

    // Check certification/course goals
    if (payload.milestoneType === 'CERTIFICATION_EARNED' && payload.credentialEarned) {
      await this.checkCertificationGoals(payload.userId, payload.credentialEarned.id);
    }

    logger.info('Milestone processed', {
      milestoneType: payload.milestoneType,
      userId: payload.userId,
    });
  }

  async handleDailySummary(event: DailyLearningSummaryEvent): Promise<void> {
    const { payload } = event;

    // Store daily summary in learning_time_summaries
    const summaryDate = new Date(payload.date);
    summaryDate.setHours(0, 0, 0, 0);

    await this.prisma.learningTimeSummary.upsert({
      where: {
        userId_periodType_periodStart: {
          userId: payload.userId,
          periodType: 'DAILY',
          periodStart: summaryDate,
        },
      },
      create: {
        userId: payload.userId,
        periodType: 'DAILY',
        periodStart: summaryDate,
        periodEnd: new Date(summaryDate.getTime() + 86400000 - 1),
        totalMinutes: payload.totalMinutes,
        activeMinutes: payload.activeMinutes,
        courseMinutes: payload.courseMinutes,
        assessmentMinutes: payload.assessmentMinutes,
        practiceMinutes: payload.practiceMinutes,
        readingMinutes: payload.readingMinutes,
        lessonsCompleted: payload.lessonsCompleted,
        assessmentsPassed: payload.assessmentsPassed,
        skillBreakdown: payload.skills.reduce(
          (acc, s) => ({
            ...acc,
            [s.skillId]: { name: s.skillName, minutes: s.minutes, progress: s.progressGained },
          }),
          {}
        ),
        longestStreak: payload.longestStreak,
        learningDays: 1,
        generatedAt: new Date(),
        isStale: false,
      },
      update: {
        totalMinutes: payload.totalMinutes,
        activeMinutes: payload.activeMinutes,
        courseMinutes: payload.courseMinutes,
        assessmentMinutes: payload.assessmentMinutes,
        practiceMinutes: payload.practiceMinutes,
        readingMinutes: payload.readingMinutes,
        lessonsCompleted: payload.lessonsCompleted,
        assessmentsPassed: payload.assessmentsPassed,
        skillBreakdown: payload.skills.reduce(
          (acc, s) => ({
            ...acc,
            [s.skillId]: { name: s.skillName, minutes: s.minutes, progress: s.progressGained },
          }),
          {}
        ),
        longestStreak: payload.longestStreak,
        generatedAt: new Date(),
        isStale: false,
      },
    });

    logger.info('Daily summary synced', { date: payload.date, userId: payload.userId });
  }

  private async updateSkillProgress(
    userId: string,
    skillId: string,
    skillName: string,
    minutes: number,
    contentType: string
  ): Promise<void> {
    const existing = await this.skillRepo.findByUserAndSkill(userId, skillId);

    if (existing) {
      const updates: any = {
        totalMinutes: existing.totalMinutes + minutes,
        lastLearningDate: new Date(),
      };

      if (['COURSE', 'LESSON'].includes(contentType)) {
        updates.courseMinutes = existing.courseMinutes + minutes;
      } else if (contentType === 'ASSESSMENT') {
        updates.assessmentMinutes = existing.assessmentMinutes + minutes;
      } else if (['PRACTICE', 'PROJECT'].includes(contentType)) {
        updates.practiceMinutes = existing.practiceMinutes + minutes;
      }

      await this.skillRepo.update(existing.id, updates);
    } else {
      await this.skillRepo.create({
        userId,
        skillId,
        skillName,
        totalMinutes: minutes,
        courseMinutes: ['COURSE', 'LESSON'].includes(contentType) ? minutes : 0,
        assessmentMinutes: contentType === 'ASSESSMENT' ? minutes : 0,
        practiceMinutes: ['PRACTICE', 'PROJECT'].includes(contentType) ? minutes : 0,
        coursesStarted: 1,
        lastLearningDate: new Date(),
      });
    }
  }

  private async checkGoalProgress(userId: string): Promise<void> {
    const goals = await this.goalRepo.findByUser(userId, { status: [GoalStatus.ACTIVE] });
    const now = new Date();

    for (const goal of goals) {
      if (goal.goalType === 'WEEKLY_HOURS' || goal.goalType === 'MONTHLY_HOURS') {
        const totalMinutes = await this.timeRepo.getTotalMinutes(
          userId,
          goal.periodStart,
          goal.periodEnd
        );
        const currentValue = totalMinutes / 60;
        const progressPercent = Math.min(100, (currentValue / Number(goal.targetValue)) * 100);

        await this.goalRepo.update(goal.id, {
          currentValue,
          progressPercent,
          status: progressPercent >= 100 ? GoalStatus.ACHIEVED : GoalStatus.ACTIVE,
          achievedAt: progressPercent >= 100 && !goal.achievedAt ? now : goal.achievedAt,
        });
      }
    }
  }

  private async checkCertificationGoals(userId: string, certificationId: string): Promise<void> {
    const goals = await this.goalRepo.findByUser(userId, { status: [GoalStatus.ACTIVE] });

    for (const goal of goals) {
      if (goal.goalType === 'CERTIFICATION' && goal.targetCertificationId === certificationId) {
        await this.goalRepo.update(goal.id, {
          currentValue: 1,
          progressPercent: 100,
          status: GoalStatus.ACHIEVED,
          achievedAt: new Date(),
        });
      }
    }
  }

  private mapContentTypeToSubcategory(contentType: string): string {
    const map: Record<string, string> = {
      COURSE: 'Online Courses',
      LESSON: 'Online Courses',
      ASSESSMENT: 'Skills Assessment',
      PROJECT: 'Practical Training',
      ARTICLE: 'Reading & Research',
      PRACTICE: 'Practical Training',
    };
    return map[contentType] ?? 'General Learning';
  }
}
