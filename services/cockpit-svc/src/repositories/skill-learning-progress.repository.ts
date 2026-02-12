// @ts-nocheck
/**
 * Skill Learning Progress Repository
 */

import type { PrismaClient, SkillLearningProgress } from '../types/prisma-shim.js';

export class SkillLearningProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    userId: string;
    skillId: string;
    skillName: string;
    totalMinutes?: number;
    courseMinutes?: number;
    assessmentMinutes?: number;
    practiceMinutes?: number;
    coursesStarted?: number;
    coursesCompleted?: number;
    assessmentsTaken?: number;
    assessmentsPassed?: number;
    highestScore?: number;
    credentialsEarned?: string[];
    lastLearningDate?: Date;
    rateWhenStarted?: number;
  }): Promise<SkillLearningProgress> {
    return this.prisma.skillLearningProgress.create({
      data: {
        userId: data.userId,
        skillId: data.skillId,
        skillName: data.skillName,
        totalMinutes: data.totalMinutes ?? 0,
        courseMinutes: data.courseMinutes ?? 0,
        assessmentMinutes: data.assessmentMinutes ?? 0,
        practiceMinutes: data.practiceMinutes ?? 0,
        coursesStarted: data.coursesStarted ?? 0,
        coursesCompleted: data.coursesCompleted ?? 0,
        assessmentsTaken: data.assessmentsTaken ?? 0,
        assessmentsPassed: data.assessmentsPassed ?? 0,
        highestScore: data.highestScore,
        credentialsEarned: data.credentialsEarned ?? [],
        lastLearningDate: data.lastLearningDate,
        rateWhenStarted: data.rateWhenStarted,
      },
    });
  }

  async findByUserAndSkill(userId: string, skillId: string): Promise<SkillLearningProgress | null> {
    return this.prisma.skillLearningProgress.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });
  }

  async findByUser(userId: string): Promise<SkillLearningProgress[]> {
    return this.prisma.skillLearningProgress.findMany({
      where: { userId },
      orderBy: { totalMinutes: 'desc' },
    });
  }

  async update(id: string, data: Partial<SkillLearningProgress>): Promise<SkillLearningProgress> {
    return this.prisma.skillLearningProgress.update({ where: { id }, data });
  }

  async upsert(
    userId: string,
    skillId: string,
    skillName: string,
    updates: Partial<SkillLearningProgress>
  ): Promise<SkillLearningProgress> {
    return this.prisma.skillLearningProgress.upsert({
      where: { userId_skillId: { userId, skillId } },
      create: { userId, skillId, skillName, ...updates },
      update: updates,
    });
  }
}
