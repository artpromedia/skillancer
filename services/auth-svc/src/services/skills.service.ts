/**
 * @module @skillancer/auth-svc/services/skills
 * Skills management service
 */

import { prisma, type Skill, type UserSkill, type SkillLevel } from '@skillancer/database';

import {
  SkillNotFoundError,
  SkillAlreadyExistsError,
  MaxSkillsExceededError,
} from '../errors/index.js';

// =============================================================================
// TYPES
// =============================================================================

export interface AddSkillDto {
  level?: SkillLevel | undefined;
  yearsExp?: number | null | undefined;
  isPrimary?: boolean | undefined;
}

export interface UpdateSkillDto {
  level?: SkillLevel | undefined;
  yearsExp?: number | null | undefined;
  isPrimary?: boolean | undefined;
}

export interface CreateCustomSkillDto {
  name: string;
  category: string;
  description?: string;
}

export interface UserSkillWithDetails extends UserSkill {
  skill: Skill;
}

export interface SkillCategory {
  name: string;
  skills: Skill[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_USER_SKILLS = 50;
const MAX_PRIMARY_SKILLS = 5;

// =============================================================================
// SKILLS SERVICE
// =============================================================================

/**
 * Skills management service
 *
 * Handles:
 * - Skill catalog management
 * - User skill CRUD operations
 * - Custom skill creation
 * - Skill search and filtering
 */
export class SkillsService {
  // ===========================================================================
  // SKILL CATALOG
  // ===========================================================================

  /**
   * Get all skills grouped by category
   */
  async getAllSkillsByCategory(): Promise<SkillCategory[]> {
    const skills = await prisma.skill.findMany({
      where: {
        OR: [{ isCustom: false }, { isApproved: true }],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Group by category
    const categoryMap = new Map<string, Skill[]>();

    for (const skill of skills) {
      const existing = categoryMap.get(skill.category) ?? [];
      existing.push(skill);
      categoryMap.set(skill.category, existing);
    }

    return Array.from(categoryMap.entries()).map(([name, skills]) => ({
      name,
      skills,
    }));
  }

  /**
   * Get all skills (flat list)
   */
  async getAllSkills(): Promise<Skill[]> {
    return prisma.skill.findMany({
      where: {
        OR: [{ isCustom: false }, { isApproved: true }],
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get skills by category
   */
  async getSkillsByCategory(category: string): Promise<Skill[]> {
    return prisma.skill.findMany({
      where: {
        category,
        OR: [{ isCustom: false }, { isApproved: true }],
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Search skills by name
   */
  async searchSkills(query: string, limit = 20): Promise<Skill[]> {
    return prisma.skill.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { slug: { contains: query.toLowerCase() } },
            ],
          },
          {
            OR: [{ isCustom: false }, { isApproved: true }],
          },
        ],
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get skill by ID
   */
  async getSkillById(skillId: string): Promise<Skill | null> {
    return prisma.skill.findUnique({
      where: { id: skillId },
    });
  }

  /**
   * Get skill by slug
   */
  async getSkillBySlug(slug: string): Promise<Skill | null> {
    return prisma.skill.findUnique({
      where: { slug },
    });
  }

  // ===========================================================================
  // USER SKILLS
  // ===========================================================================

  /**
   * Get user's skills with details
   */
  async getUserSkills(userId: string): Promise<UserSkillWithDetails[]> {
    return prisma.userSkill.findMany({
      where: { userId },
      include: { skill: true },
      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  /**
   * Add skill to user's profile
   */
  async addUserSkill(
    userId: string,
    skillId: string,
    data: AddSkillDto = {}
  ): Promise<UserSkillWithDetails> {
    // Check if skill exists
    const skill = await this.getSkillById(skillId);
    if (!skill) {
      throw new SkillNotFoundError(skillId);
    }

    // Check if user already has this skill
    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });

    if (existing) {
      throw new SkillAlreadyExistsError(skill.name);
    }

    // Check max skills limit
    const userSkillCount = await prisma.userSkill.count({
      where: { userId },
    });

    if (userSkillCount >= MAX_USER_SKILLS) {
      throw new MaxSkillsExceededError(MAX_USER_SKILLS);
    }

    // Check primary skills limit if adding as primary
    if (data.isPrimary) {
      const primaryCount = await prisma.userSkill.count({
        where: { userId, isPrimary: true },
      });

      if (primaryCount >= MAX_PRIMARY_SKILLS) {
        // Just add as non-primary instead of throwing
        data.isPrimary = false;
      }
    }

    // Get next sort order
    const maxSortOrder = await prisma.userSkill.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });

    const sortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

    // Create user skill
    return prisma.userSkill.create({
      data: {
        userId,
        skillId,
        level: data.level ?? 'INTERMEDIATE',
        yearsExp: data.yearsExp ?? null,
        isPrimary: data.isPrimary ?? false,
        sortOrder,
      },
      include: { skill: true },
    });
  }

  /**
   * Update user's skill
   */
  async updateUserSkill(
    userId: string,
    skillId: string,
    data: UpdateSkillDto
  ): Promise<UserSkillWithDetails> {
    // Check if user has this skill
    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });

    if (!existing) {
      throw new SkillNotFoundError(skillId);
    }

    // Check primary skills limit if setting as primary
    if (data.isPrimary && !existing.isPrimary) {
      const primaryCount = await prisma.userSkill.count({
        where: { userId, isPrimary: true },
      });

      if (primaryCount >= MAX_PRIMARY_SKILLS) {
        // Remove isPrimary from oldest primary skill
        const oldestPrimary = await prisma.userSkill.findFirst({
          where: { userId, isPrimary: true },
          orderBy: { createdAt: 'asc' },
        });

        if (oldestPrimary) {
          await prisma.userSkill.update({
            where: { id: oldestPrimary.id },
            data: { isPrimary: false },
          });
        }
      }
    }

    return prisma.userSkill.update({
      where: { userId_skillId: { userId, skillId } },
      data: {
        ...(data.level !== undefined && { level: data.level }),
        ...(data.yearsExp !== undefined && { yearsExp: data.yearsExp }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
      },
      include: { skill: true },
    });
  }

  /**
   * Remove skill from user's profile
   */
  async removeUserSkill(userId: string, skillId: string): Promise<void> {
    // Check if user has this skill
    const existing = await prisma.userSkill.findUnique({
      where: { userId_skillId: { userId, skillId } },
    });

    if (!existing) {
      throw new SkillNotFoundError(skillId);
    }

    await prisma.userSkill.delete({
      where: { userId_skillId: { userId, skillId } },
    });
  }

  /**
   * Reorder user's skills
   */
  async reorderUserSkills(userId: string, skillIds: string[]): Promise<UserSkillWithDetails[]> {
    // Verify all skill IDs belong to user
    const userSkills = await prisma.userSkill.findMany({
      where: { userId },
      select: { skillId: true },
    });

    const userSkillIds = new Set(userSkills.map((s) => s.skillId));

    for (const skillId of skillIds) {
      if (!userSkillIds.has(skillId)) {
        throw new SkillNotFoundError(skillId);
      }
    }

    // Update sort orders using interactive transaction
    await prisma.$transaction(async (tx) => {
      for (let index = 0; index < skillIds.length; index++) {
        const skillId = skillIds[index];
        if (!skillId) continue; // Type guard for TypeScript
        await tx.userSkill.update({
          where: { userId_skillId: { userId, skillId } },
          data: { sortOrder: index },
        });
      }
    });

    return this.getUserSkills(userId);
  }

  /**
   * Set user's skills (replace all)
   */
  async setUserSkills(
    userId: string,
    skills: Array<{ skillId: string } & AddSkillDto>
  ): Promise<UserSkillWithDetails[]> {
    // Validate skill count
    if (skills.length > MAX_USER_SKILLS) {
      throw new MaxSkillsExceededError(MAX_USER_SKILLS);
    }

    // Validate all skills exist
    const skillIds = skills.map((s) => s.skillId);
    const existingSkills = await prisma.skill.findMany({
      where: { id: { in: skillIds } },
      select: { id: true },
    });

    const existingSkillIds = new Set(existingSkills.map((s) => s.id));
    for (const skillId of skillIds) {
      if (!existingSkillIds.has(skillId)) {
        throw new SkillNotFoundError(skillId);
      }
    }

    // Delete existing skills and create new ones in interactive transaction
    await prisma.$transaction(async (tx) => {
      // Delete all existing user skills
      await tx.userSkill.deleteMany({ where: { userId } });

      // Create new user skills
      for (let index = 0; index < skills.length; index++) {
        const skill = skills[index];
        if (!skill) continue; // Type guard for TypeScript
        await tx.userSkill.create({
          data: {
            userId,
            skillId: skill.skillId,
            level: skill.level ?? 'INTERMEDIATE',
            yearsExp: skill.yearsExp ?? null,
            isPrimary: skill.isPrimary ?? false,
            sortOrder: index,
          },
        });
      }
    });

    return this.getUserSkills(userId);
  }

  // ===========================================================================
  // CUSTOM SKILLS
  // ===========================================================================

  /**
   * Create custom skill (requires approval for public catalog)
   */
  async createCustomSkill(userId: string, data: CreateCustomSkillDto): Promise<Skill> {
    const slug = this.generateSlug(data.name);

    // Check if skill with same name or slug exists
    const existing = await prisma.skill.findFirst({
      where: {
        OR: [{ name: { equals: data.name, mode: 'insensitive' } }, { slug }],
      },
    });

    if (existing) {
      throw new SkillAlreadyExistsError(data.name);
    }

    return prisma.skill.create({
      data: {
        name: data.name,
        slug,
        category: data.category,
        description: data.description ?? null,
        isCustom: true,
        createdById: userId,
        isApproved: false, // Custom skills need approval
      },
    });
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let skillsServiceInstance: SkillsService | null = null;

export function initializeSkillsService(): SkillsService {
  skillsServiceInstance = new SkillsService();
  return skillsServiceInstance;
}

export function getSkillsService(): SkillsService {
  if (!skillsServiceInstance) {
    throw new Error('SkillsService not initialized. Call initializeSkillsService first.');
  }
  return skillsServiceInstance;
}
