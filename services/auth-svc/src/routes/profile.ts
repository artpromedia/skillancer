// @ts-nocheck
/**
 * @module @skillancer/auth-svc/routes/profile
 * User profile management routes
 */

import { authMiddleware } from '../middleware/auth.js';
import { profileRateLimitHook, avatarUploadRateLimitHook } from '../middleware/rate-limit.js';
import {
  updateProfileSchema,
  usernameSchema,
  profileSearchSchema,
  addSkillSchema,
  updateSkillSchema,
  reorderSkillsSchema,
  setSkillsSchema,
} from '../schemas/profile.js';
import { getAvatarService } from '../services/avatar.service.js';
import { getProfileService } from '../services/profile.service.js';
import { getSkillsService } from '../services/skills.service.js';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

// =============================================================================
// TYPES
// =============================================================================

interface UsernameParams {
  username: string;
}

interface SkillIdParams {
  skillId: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get user ID from authenticated request
 */
function getUserId(request: FastifyRequest): string {
  if (!request.user?.id) {
    throw new Error('User not authenticated');
  }
  return request.user.id;
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /profile - Get current user's profile
 */
async function getProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const profileService = getProfileService();

  const profile = await profileService.getProfileWithSkills(userId);

  void reply.send({
    profile: {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      title: profile.title,
      bio: profile.bio,
      hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
      currency: profile.currency,
      yearsExperience: profile.yearsExperience,
      country: profile.country,
      city: profile.city,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      twitterUrl: profile.twitterUrl,
      avatarOriginal: profile.avatarOriginal,
      avatarThumbnail: profile.avatarThumbnail,
      avatarSmall: profile.avatarSmall,
      avatarMedium: profile.avatarMedium,
      avatarLarge: profile.avatarLarge,
      isPublic: profile.isPublic,
      showEmail: profile.showEmail,
      showRate: profile.showRate,
      showLocation: profile.showLocation,
      completenessScore: profile.completenessScore,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
    user: {
      id: profile.user.id,
      email: profile.user.email,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      displayName: profile.user.displayName,
      verificationLevel: profile.user.verificationLevel,
    },
    skills: profile.skills.map((us) => ({
      id: us.id,
      skillId: us.skillId,
      name: us.skill.name,
      slug: us.skill.slug,
      category: us.skill.category,
      level: us.level,
      yearsExp: us.yearsExp,
      isPrimary: us.isPrimary,
      sortOrder: us.sortOrder,
    })),
  });
}

/**
 * Helper to filter out undefined values from an object
 */
function filterUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/**
 * PUT/PATCH /profile - Update current user's profile
 */
async function updateProfileHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const parsed = updateProfileSchema.parse(request.body);
  // Filter out undefined values for Prisma compatibility
  const data = filterUndefined(parsed);
  const profileService = getProfileService();

  const profile = await profileService.updateProfile(userId, data);

  void reply.send({
    success: true,
    message: 'Profile updated successfully',
    profile: {
      id: profile.id,
      userId: profile.userId,
      username: profile.username,
      title: profile.title,
      bio: profile.bio,
      hourlyRate: profile.hourlyRate ? Number(profile.hourlyRate) : null,
      currency: profile.currency,
      yearsExperience: profile.yearsExperience,
      country: profile.country,
      city: profile.city,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      portfolioUrl: profile.portfolioUrl,
      twitterUrl: profile.twitterUrl,
      isPublic: profile.isPublic,
      showEmail: profile.showEmail,
      showRate: profile.showRate,
      showLocation: profile.showLocation,
      updatedAt: profile.updatedAt.toISOString(),
    },
  });
}

/**
 * POST /profile/avatar - Upload avatar
 */
async function uploadAvatarHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const avatarService = getAvatarService();

  const file = await request.file();
  if (!file) {
    void reply.status(400).send({
      success: false,
      error: 'No file uploaded',
      code: 'NO_FILE',
    });
    return;
  }

  const urls = await avatarService.uploadAvatar(userId, file);

  void reply.send({
    success: true,
    message: 'Avatar uploaded successfully',
    avatar: urls,
  });
}

/**
 * DELETE /profile/avatar - Delete avatar
 */
async function deleteAvatarHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const avatarService = getAvatarService();

  await avatarService.deleteAvatar(userId);

  void reply.send({
    success: true,
    message: 'Avatar deleted successfully',
  });
}

/**
 * PUT /profile/username - Set username
 */
async function setUsernameHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const { username } = usernameSchema.parse(request.body);
  const profileService = getProfileService();

  await profileService.setUsername(userId, username);

  void reply.send({
    success: true,
    message: 'Username set successfully',
    username,
  });
}

/**
 * GET /profile/username/available/:username - Check username availability
 */
async function checkUsernameHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { username } = request.params as UsernameParams;
  const profileService = getProfileService();

  const available = await profileService.isUsernameAvailable(username);

  void reply.send({
    username,
    available,
  });
}

/**
 * GET /profile/completeness - Get profile completeness
 */
async function getCompletenessHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const profileService = getProfileService();

  const completeness = await profileService.calculateCompleteness(userId);

  void reply.send(completeness);
}

// =============================================================================
// SKILLS HANDLERS
// =============================================================================

/**
 * GET /profile/skills - Get user's skills
 */
async function getUserSkillsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const skillsService = getSkillsService();

  const skills = await skillsService.getUserSkills(userId);

  void reply.send({
    skills: skills.map((us) => ({
      id: us.id,
      skillId: us.skillId,
      name: us.skill.name,
      slug: us.skill.slug,
      category: us.skill.category,
      level: us.level,
      yearsExp: us.yearsExp,
      isPrimary: us.isPrimary,
      sortOrder: us.sortOrder,
    })),
  });
}

/**
 * PUT /profile/skills - Set all skills (replace)
 */
async function setUserSkillsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const { skills } = setSkillsSchema.parse(request.body);
  const skillsService = getSkillsService();

  // Map skills to ensure proper null handling for Prisma
  const mappedSkills = skills.map((s) => ({
    skillId: s.skillId,
    level: s.level ?? 'INTERMEDIATE',
    yearsExp: s.yearsExp ?? null,
    isPrimary: s.isPrimary ?? false,
  }));

  const updatedSkills = await skillsService.setUserSkills(userId, mappedSkills);

  void reply.send({
    success: true,
    message: 'Skills updated successfully',
    skills: updatedSkills.map((us) => ({
      id: us.id,
      skillId: us.skillId,
      name: us.skill.name,
      slug: us.skill.slug,
      category: us.skill.category,
      level: us.level,
      yearsExp: us.yearsExp,
      isPrimary: us.isPrimary,
      sortOrder: us.sortOrder,
    })),
  });
}

/**
 * POST /profile/skills/:skillId - Add skill
 */
async function addSkillHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const { skillId } = request.params as SkillIdParams;
  const parsed = addSkillSchema.parse(request.body || {});
  const skillsService = getSkillsService();

  // Ensure proper null/default handling for Prisma
  const data = {
    level: parsed.level ?? 'INTERMEDIATE',
    yearsExp: parsed.yearsExp ?? null,
    isPrimary: parsed.isPrimary ?? false,
  };

  const userSkill = await skillsService.addUserSkill(userId, skillId, data);

  void reply.status(201).send({
    success: true,
    message: 'Skill added successfully',
    skill: {
      id: userSkill.id,
      skillId: userSkill.skillId,
      name: userSkill.skill.name,
      slug: userSkill.skill.slug,
      category: userSkill.skill.category,
      level: userSkill.level,
      yearsExp: userSkill.yearsExp,
      isPrimary: userSkill.isPrimary,
      sortOrder: userSkill.sortOrder,
    },
  });
}

/**
 * PATCH /profile/skills/:skillId - Update skill
 */
async function updateSkillHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const { skillId } = request.params as SkillIdParams;
  const parsed = updateSkillSchema.parse(request.body);
  const skillsService = getSkillsService();

  // Filter out undefined and use proper null handling
  const data = filterUndefined(parsed);

  const userSkill = await skillsService.updateUserSkill(userId, skillId, data);

  void reply.send({
    success: true,
    message: 'Skill updated successfully',
    skill: {
      id: userSkill.id,
      skillId: userSkill.skillId,
      name: userSkill.skill.name,
      slug: userSkill.skill.slug,
      category: userSkill.skill.category,
      level: userSkill.level,
      yearsExp: userSkill.yearsExp,
      isPrimary: userSkill.isPrimary,
      sortOrder: userSkill.sortOrder,
    },
  });
}

/**
 * DELETE /profile/skills/:skillId - Remove skill
 */
async function deleteSkillHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const { skillId } = request.params as SkillIdParams;
  const skillsService = getSkillsService();

  await skillsService.removeUserSkill(userId, skillId);

  void reply.send({
    success: true,
    message: 'Skill removed successfully',
  });
}

/**
 * PUT /profile/skills/reorder - Reorder skills
 */
async function reorderSkillsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const userId = getUserId(request);
  const { skillIds } = reorderSkillsSchema.parse(request.body);
  const skillsService = getSkillsService();

  const skills = await skillsService.reorderUserSkills(userId, skillIds);

  void reply.send({
    success: true,
    message: 'Skills reordered successfully',
    skills: skills.map((us) => ({
      id: us.id,
      skillId: us.skillId,
      name: us.skill.name,
      slug: us.skill.slug,
      category: us.skill.category,
      level: us.level,
      yearsExp: us.yearsExp,
      isPrimary: us.isPrimary,
      sortOrder: us.sortOrder,
    })),
  });
}

// =============================================================================
// SKILLS CATALOG HANDLERS
// =============================================================================

/**
 * GET /skills - Get all skills (public)
 */
async function getAllSkillsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const skillsService = getSkillsService();
  const { category } = request.query as { category?: string };

  if (category) {
    const skills = await skillsService.getSkillsByCategory(category);
    void reply.send({ skills });
  } else {
    const categories = await skillsService.getAllSkillsByCategory();
    void reply.send({ categories });
  }
}

/**
 * GET /skills/search - Search skills
 */
async function searchSkillsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const skillsService = getSkillsService();
  const { q, limit } = request.query as { q?: string; limit?: string };

  if (!q) {
    void reply.send({ skills: [] });
    return;
  }

  const skills = await skillsService.searchSkills(q, limit ? Number.parseInt(limit, 10) : undefined);
  void reply.send({ skills });
}

// =============================================================================
// PUBLIC PROFILE HANDLERS
// =============================================================================

/**
 * GET /profiles/:username - Get public profile
 */
async function getPublicProfileHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { username } = request.params as UsernameParams;
  const profileService = getProfileService();

  const profile = await profileService.getPublicProfile(username);

  void reply.send({ profile });
}

/**
 * GET /profiles/search - Search public profiles
 */
async function searchProfilesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const parsed = profileSearchSchema.parse(request.query);
  // Filter out undefined values for Prisma compatibility
  const filters = {
    page: parsed.page,
    limit: parsed.limit,
    sortBy: parsed.sortBy,
    query: parsed.query,
    skills: parsed.skills,
    country: parsed.country,
    minRate: parsed.minRate,
    maxRate: parsed.maxRate,
  };
  const profileService = getProfileService();

  const result = await profileService.searchProfiles(filters);

  void reply.send(result);
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
  await Promise.resolve();
  // =========================================================================
  // AUTHENTICATED PROFILE ROUTES
  // =========================================================================

  // Profile CRUD
  fastify.get(
    '/profile',
    {
      preHandler: [authMiddleware],
    },
    getProfileHandler
  );

  fastify.put(
    '/profile',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    updateProfileHandler
  );

  fastify.patch(
    '/profile',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    updateProfileHandler
  );

  // Avatar
  fastify.post(
    '/profile/avatar',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: [authMiddleware, avatarUploadRateLimitHook],
    },
    uploadAvatarHandler
  );

  fastify.delete(
    '/profile/avatar',
    {
      preHandler: [authMiddleware],
    },
    deleteAvatarHandler
  );

  // Username
  fastify.put(
    '/profile/username',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    setUsernameHandler
  );

  fastify.get(
    '/profile/username/available/:username',
    {
      preHandler: [authMiddleware],
    },
    checkUsernameHandler
  );

  // Completeness
  fastify.get(
    '/profile/completeness',
    {
      preHandler: [authMiddleware],
    },
    getCompletenessHandler
  );

  // =========================================================================
  // USER SKILLS ROUTES
  // =========================================================================

  fastify.get(
    '/profile/skills',
    {
      preHandler: [authMiddleware],
    },
    getUserSkillsHandler
  );

  fastify.put(
    '/profile/skills',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    setUserSkillsHandler
  );

  fastify.put(
    '/profile/skills/reorder',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    reorderSkillsHandler
  );

  fastify.post(
    '/profile/skills/:skillId',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    addSkillHandler
  );

  fastify.patch(
    '/profile/skills/:skillId',
    {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      preHandler: [authMiddleware, profileRateLimitHook],
    },
    updateSkillHandler
  );

  fastify.delete(
    '/profile/skills/:skillId',
    {
      preHandler: [authMiddleware],
    },
    deleteSkillHandler
  );

  // =========================================================================
  // SKILLS CATALOG ROUTES (PUBLIC)
  // =========================================================================

  fastify.get('/skills', getAllSkillsHandler);
  fastify.get('/skills/search', searchSkillsHandler);

  // =========================================================================
  // PUBLIC PROFILE ROUTES
  // =========================================================================

  fastify.get('/profiles/search', searchProfilesHandler);
  fastify.get('/profiles/:username', getPublicProfileHandler);
}
