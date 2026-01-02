// @ts-nocheck
/**
 * Team Composition Service
 * Sprint M8: Guild & Agency Accounts
 *
 * Handles team building and skill matching for guild proposals
 */

import { db } from '@skillancer/database';
import { logger } from '@skillancer/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface SkillRequirement {
  skillId: string;
  skillName: string;
  minimumLevel: number; // 1-5
  required: boolean;
}

export interface TeamMemberSuggestion {
  memberId: string;
  displayName: string;
  avatarUrl: string | null;
  matchScore: number;
  matchingSkills: {
    skillId: string;
    skillName: string;
    memberLevel: number;
    requiredLevel: number;
  }[];
  missingSkills: string[];
  currentWorkload: number; // Percentage
  availableFrom: Date | null;
  hourlyRate: number | null;
  rating: number;
  projectsCompleted: number;
}

export interface TeamComposition {
  members: TeamMemberSuggestion[];
  overallMatchScore: number;
  skillCoverage: number;
  estimatedCost: number;
  gaps: string[];
}

// =============================================================================
// SERVICE
// =============================================================================

export class TeamCompositionService {
  private log = logger.child({ service: 'TeamCompositionService' });

  /**
   * Suggest optimal team composition for a project
   */
  async suggestTeamComposition(
    guildId: string,
    requirements: SkillRequirement[],
    options: {
      maxTeamSize?: number;
      budgetLimit?: number;
      prioritizeRating?: boolean;
    } = {}
  ): Promise<TeamComposition> {
    const { maxTeamSize = 5, budgetLimit, prioritizeRating = true } = options;

    // Get all active guild members with their skills
    const members = await db.guildMember.findMany({
      where: {
        guildId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            hourlyRate: true,
          },
        },
      },
    });

    // Get skills for all members
    const memberSkillsMap = new Map<string, { skillId: string; level: number; name: string }[]>();

    for (const member of members) {
      const skills = await db.userSkill.findMany({
        where: { userId: member.userId },
        include: { skill: { select: { id: true, name: true } } },
      });

      memberSkillsMap.set(
        member.userId,
        skills.map((s) => ({
          skillId: s.skill.id,
          level: s.proficiencyLevel,
          name: s.skill.name,
        }))
      );
    }

    // Get current workload for each member
    const workloadMap = new Map<string, number>();

    for (const member of members) {
      const activeAssignments = await db.guildProjectAssignment.findMany({
        where: {
          memberId: member.userId,
          guildProject: {
            status: { in: ['PLANNING', 'IN_PROGRESS'] },
          },
        },
      });

      const totalAllocation = activeAssignments.reduce((sum, a) => sum + a.allocation, 0);
      workloadMap.set(member.userId, Math.min(100, totalAllocation));
    }

    // Get ratings for members
    const ratingsMap = new Map<string, number>();

    for (const member of members) {
      const reviews = await db.review.aggregate({
        where: { freelancerId: member.userId },
        _avg: { rating: true },
      });
      ratingsMap.set(member.userId, reviews._avg.rating ?? 0);
    }

    // Score each member against requirements
    const suggestions: TeamMemberSuggestion[] = [];

    for (const member of members) {
      const memberSkills = memberSkillsMap.get(member.userId) || [];
      const matchingSkills: TeamMemberSuggestion['matchingSkills'] = [];
      const missingSkills: string[] = [];
      let matchScore = 0;

      for (const req of requirements) {
        const memberSkill = memberSkills.find((s) => s.skillId === req.skillId);

        if (memberSkill) {
          matchingSkills.push({
            skillId: req.skillId,
            skillName: req.skillName,
            memberLevel: memberSkill.level,
            requiredLevel: req.minimumLevel,
          });

          // Score based on how well skill meets requirement
          const levelDiff = memberSkill.level - req.minimumLevel;
          matchScore += Math.max(0, 20 + levelDiff * 5) * (req.required ? 1.5 : 1);
        } else if (req.required) {
          missingSkills.push(req.skillName);
        }
      }

      // Normalize match score
      const maxPossibleScore = requirements.reduce(
        (sum, r) => sum + 35 * (r.required ? 1.5 : 1),
        0
      );
      matchScore = maxPossibleScore > 0 ? (matchScore / maxPossibleScore) * 100 : 0;

      // Factor in rating if prioritizing
      if (prioritizeRating) {
        const rating = ratingsMap.get(member.userId) ?? 0;
        matchScore = matchScore * 0.7 + rating * 6; // Rating contributes 30%
      }

      // Factor in availability
      const workload = workloadMap.get(member.userId) ?? 0;
      if (workload >= 100) {
        matchScore *= 0.3; // Heavily penalize fully booked members
      } else if (workload >= 75) {
        matchScore *= 0.7;
      }

      suggestions.push({
        memberId: member.userId,
        displayName: member.user.displayName || `${member.user.firstName} ${member.user.lastName}`,
        avatarUrl: member.user.avatarUrl,
        matchScore: Math.round(matchScore),
        matchingSkills,
        missingSkills,
        currentWorkload: workload,
        availableFrom: workload >= 100 ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
        hourlyRate: member.user.hourlyRate ? Number(member.user.hourlyRate) : null,
        rating: ratingsMap.get(member.userId) ?? 0,
        projectsCompleted: member.projectsCompleted,
      });
    }

    // Sort by match score
    suggestions.sort((a, b) => b.matchScore - a.matchScore);

    // Select optimal team
    const selectedTeam: TeamMemberSuggestion[] = [];
    const coveredSkills = new Set<string>();
    let estimatedCost = 0;

    for (const suggestion of suggestions) {
      if (selectedTeam.length >= maxTeamSize) break;

      // Check if this member adds value
      const newSkills = suggestion.matchingSkills.filter((s) => !coveredSkills.has(s.skillId));

      if (newSkills.length === 0 && selectedTeam.length > 0) continue;

      // Check budget
      if (budgetLimit && suggestion.hourlyRate) {
        const memberCost = suggestion.hourlyRate * 160; // Assume full month
        if (estimatedCost + memberCost > budgetLimit) continue;
        estimatedCost += memberCost;
      }

      selectedTeam.push(suggestion);
      for (const skill of suggestion.matchingSkills) {
        coveredSkills.add(skill.skillId);
      }
    }

    // Calculate overall metrics
    const requiredSkills = requirements.filter((r) => r.required);
    const coveredRequired = requiredSkills.filter((r) => coveredSkills.has(r.skillId));
    const skillCoverage =
      requiredSkills.length > 0 ? (coveredRequired.length / requiredSkills.length) * 100 : 100;

    const overallMatchScore =
      selectedTeam.length > 0
        ? selectedTeam.reduce((sum, m) => sum + m.matchScore, 0) / selectedTeam.length
        : 0;

    const gaps = requiredSkills
      .filter((r) => !coveredSkills.has(r.skillId))
      .map((r) => r.skillName);

    this.log.debug(
      { guildId, teamSize: selectedTeam.length, skillCoverage },
      'Team composition suggested'
    );

    return {
      members: selectedTeam,
      overallMatchScore: Math.round(overallMatchScore),
      skillCoverage: Math.round(skillCoverage),
      estimatedCost,
      gaps,
    };
  }

  /**
   * Find members with specific skills
   */
  async findMembersBySkills(
    guildId: string,
    skillIds: string[],
    options: {
      minLevel?: number;
      excludeIds?: string[];
    } = {}
  ): Promise<TeamMemberSuggestion[]> {
    const { minLevel = 1, excludeIds = [] } = options;

    const members = await db.guildMember.findMany({
      where: {
        guildId,
        status: 'ACTIVE',
        userId: { notIn: excludeIds },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            hourlyRate: true,
          },
        },
      },
    });

    const results: TeamMemberSuggestion[] = [];

    for (const member of members) {
      const skills = await db.userSkill.findMany({
        where: {
          userId: member.userId,
          skillId: { in: skillIds },
          proficiencyLevel: { gte: minLevel },
        },
        include: { skill: { select: { id: true, name: true } } },
      });

      if (skills.length === 0) continue;

      const reviews = await db.review.aggregate({
        where: { freelancerId: member.userId },
        _avg: { rating: true },
      });

      const activeAssignments = await db.guildProjectAssignment.findMany({
        where: {
          memberId: member.userId,
          guildProject: { status: { in: ['PLANNING', 'IN_PROGRESS'] } },
        },
      });
      const workload = activeAssignments.reduce((sum, a) => sum + a.allocation, 0);

      results.push({
        memberId: member.userId,
        displayName: member.user.displayName || `${member.user.firstName} ${member.user.lastName}`,
        avatarUrl: member.user.avatarUrl,
        matchScore: skills.length * 20 + (reviews._avg.rating ?? 0) * 10,
        matchingSkills: skills.map((s) => ({
          skillId: s.skill.id,
          skillName: s.skill.name,
          memberLevel: s.proficiencyLevel,
          requiredLevel: minLevel,
        })),
        missingSkills: skillIds.filter((id) => !skills.find((s) => s.skillId === id)),
        currentWorkload: Math.min(100, workload),
        availableFrom: workload >= 100 ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
        hourlyRate: member.user.hourlyRate ? Number(member.user.hourlyRate) : null,
        rating: reviews._avg.rating ?? 0,
        projectsCompleted: member.projectsCompleted,
      });
    }

    return results.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Get team availability calendar
   */
  async getTeamAvailability(
    memberIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<
    {
      memberId: string;
      memberName: string;
      availability: { date: Date; allocatedPercent: number }[];
    }[]
  > {
    const members = await db.guildMember.findMany({
      where: { userId: { in: memberIds } },
      include: {
        user: { select: { displayName: true, firstName: true, lastName: true } },
      },
    });

    const results: {
      memberId: string;
      memberName: string;
      availability: { date: Date; allocatedPercent: number }[];
    }[] = [];

    for (const member of members) {
      // Get all project assignments in date range
      const assignments = await db.guildProjectAssignment.findMany({
        where: {
          memberId: member.userId,
          guildProject: {
            OR: [
              { startedAt: { lte: endDate }, completedAt: { gte: startDate } },
              { startedAt: { lte: endDate }, completedAt: null },
              { status: 'PLANNING' },
            ],
          },
        },
      });

      // Build daily availability
      const availability: { date: Date; allocatedPercent: number }[] = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        const dayAllocation = assignments.reduce((sum, a) => sum + a.allocation, 0);
        availability.push({
          date: new Date(current),
          allocatedPercent: Math.min(100, dayAllocation),
        });
        current.setDate(current.getDate() + 1);
      }

      results.push({
        memberId: member.userId,
        memberName: member.user.displayName || `${member.user.firstName} ${member.user.lastName}`,
        availability,
      });
    }

    return results;
  }

  /**
   * Validate team can handle project requirements
   */
  async validateTeamCapability(
    guildId: string,
    teamMemberIds: string[],
    requirements: SkillRequirement[]
  ): Promise<{
    isCapable: boolean;
    coverage: number;
    missingRequiredSkills: string[];
    warnings: string[];
  }> {
    const warnings: string[] = [];

    // Gather all team skills
    const allTeamSkills = new Map<string, number>();

    for (const memberId of teamMemberIds) {
      const skills = await db.userSkill.findMany({
        where: { userId: memberId },
        include: { skill: { select: { name: true } } },
      });

      for (const skill of skills) {
        const existing = allTeamSkills.get(skill.skillId) ?? 0;
        allTeamSkills.set(skill.skillId, Math.max(existing, skill.proficiencyLevel));
      }
    }

    // Check requirements
    const missingRequiredSkills: string[] = [];
    let coveredCount = 0;

    for (const req of requirements) {
      const teamLevel = allTeamSkills.get(req.skillId) ?? 0;

      if (teamLevel >= req.minimumLevel) {
        coveredCount++;
      } else if (req.required) {
        missingRequiredSkills.push(req.skillName);
      } else if (teamLevel > 0) {
        warnings.push(`Team has ${req.skillName} but below required level`);
      }
    }

    // Check workload
    for (const memberId of teamMemberIds) {
      const assignments = await db.guildProjectAssignment.findMany({
        where: {
          memberId,
          guildProject: { status: { in: ['PLANNING', 'IN_PROGRESS'] } },
        },
      });

      const workload = assignments.reduce((sum, a) => sum + a.allocation, 0);
      if (workload >= 100) {
        const member = await db.guildMember.findFirst({
          where: { userId: memberId, guildId },
          include: { user: { select: { displayName: true } } },
        });
        warnings.push(`${member?.user.displayName} is fully allocated to other projects`);
      }
    }

    const coverage = requirements.length > 0 ? (coveredCount / requirements.length) * 100 : 100;

    return {
      isCapable: missingRequiredSkills.length === 0,
      coverage: Math.round(coverage),
      missingRequiredSkills,
      warnings,
    };
  }
}

export const teamCompositionService = new TeamCompositionService();

