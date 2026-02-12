// @ts-nocheck
/**
 * Guild API Routes
 * Sprint M8: Guild & Agency Accounts
 */

import { logger } from '@skillancer/logger';
import { TRPCError } from '@trpc/server';
import { Router } from 'express';
import { z } from 'zod';

import {
  guildService,
  guildMembershipService,
  guildReputationService,
  guildProjectsService,
  CreateGuildSchema,
  UpdateGuildSchema,
  InviteMemberSchema,
  UpdateMemberRoleSchema,
  CreateGuildProjectSchema,
} from '../guilds';

const router = Router();
const log = logger.child({ module: 'guild-routes' });

// =============================================================================
// GUILD CRUD
// =============================================================================

/**
 * Create a new guild
 * POST /guilds
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const input = CreateGuildSchema.parse(req.body);

    const guild = await guildService.createGuild(userId, input);

    res.status(201).json({ data: guild });
  } catch (error) {
    next(error);
  }
});

/**
 * Get guild by ID
 * GET /guilds/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const guild = await guildService.getGuildById(id);

    res.json({ data: guild });
  } catch (error) {
    next(error);
  }
});

/**
 * Get guild by slug
 * GET /guilds/slug/:slug
 */
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const guild = await guildService.getGuildBySlug(slug);

    res.json({ data: guild });
  } catch (error) {
    next(error);
  }
});

/**
 * Update guild
 * PATCH /guilds/:id
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const input = UpdateGuildSchema.parse(req.body);

    const guild = await guildService.updateGuild(id, userId, input);

    res.json({ data: guild });
  } catch (error) {
    next(error);
  }
});

/**
 * Dissolve guild
 * DELETE /guilds/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await guildService.dissolveGuild(id, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * List guilds (discovery)
 * GET /guilds
 */
router.get('/', async (req, res, next) => {
  try {
    const options = {
      search: req.query.search as string | undefined,
      skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
      verified: req.query.verified === 'true' ? true : undefined,
      minRating: req.query.minRating ? parseFloat(req.query.minRating as string) : undefined,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? Number.parseInt(req.query.offset as string) : undefined,
    };

    const result = await guildService.listGuilds(options);

    res.json({ data: result.guilds, meta: { total: result.total } });
  } catch (error) {
    next(error);
  }
});

/**
 * Get user's guilds
 * GET /guilds/user/me
 */
router.get('/user/me', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const guilds = await guildService.getUserGuilds(userId);

    res.json({ data: guilds });
  } catch (error) {
    next(error);
  }
});

/**
 * Transfer leadership
 * POST /guilds/:id/transfer-leadership
 */
router.post('/:id/transfer-leadership', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { newLeaderId } = req.body;

    await guildService.transferLeadership(id, userId, newLeaderId);

    res.json({ message: 'Leadership transferred successfully' });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// MEMBERSHIP
// =============================================================================

/**
 * Get guild members
 * GET /guilds/:id/members
 */
router.get('/:id/members', async (req, res, next) => {
  try {
    const { id } = req.params;
    const options = {
      status: req.query.status
        ? ((req.query.status as string).split(',') as ('ACTIVE' | 'INVITED')[])
        : undefined,
      role: req.query.role
        ? ((req.query.role as string).split(',') as ('LEADER' | 'ADMIN' | 'MEMBER')[])
        : undefined,
    };

    const members = await guildMembershipService.getGuildMembers(id, options);

    res.json({ data: members });
  } catch (error) {
    next(error);
  }
});

/**
 * Invite member
 * POST /guilds/:id/members/invite
 */
router.post('/:id/members/invite', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const input = InviteMemberSchema.parse(req.body);

    const result = await guildMembershipService.inviteMember(id, userId, input);

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Accept invitation
 * POST /guilds/invitations/:token/accept
 */
router.post('/invitations/:token/accept', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { token } = req.params;

    const member = await guildMembershipService.acceptInvitation(token, userId);

    res.json({ data: member });
  } catch (error) {
    next(error);
  }
});

/**
 * Decline invitation
 * POST /guilds/invitations/:token/decline
 */
router.post('/invitations/:token/decline', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { token } = req.params;

    await guildMembershipService.declineInvitation(token, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Update member role
 * PATCH /guilds/:id/members/:memberId
 */
router.patch('/:id/members/:memberId', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id, memberId } = req.params;
    const input = UpdateMemberRoleSchema.parse(req.body);

    const member = await guildMembershipService.updateMemberRole(id, userId, memberId, input);

    res.json({ data: member });
  } catch (error) {
    next(error);
  }
});

/**
 * Remove member
 * DELETE /guilds/:id/members/:memberId
 */
router.delete('/:id/members/:memberId', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id, memberId } = req.params;

    await guildMembershipService.removeMember(id, userId, memberId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Leave guild
 * POST /guilds/:id/leave
 */
router.post('/:id/leave', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await guildMembershipService.leaveGuild(id, userId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Set primary guild
 * POST /guilds/:id/set-primary
 */
router.post('/:id/set-primary', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await guildMembershipService.setPrimaryGuild(userId, id);

    res.json({ message: 'Primary guild updated' });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// REPUTATION
// =============================================================================

/**
 * Get guild reputation
 * GET /guilds/:id/reputation
 */
router.get('/:id/reputation', async (req, res, next) => {
  try {
    const { id } = req.params;
    const reputation = await guildReputationService.calculateGuildReputation(id);

    res.json({ data: reputation });
  } catch (error) {
    next(error);
  }
});

/**
 * Get reputation trend
 * GET /guilds/:id/reputation/trend
 */
router.get('/:id/reputation/trend', async (req, res, next) => {
  try {
    const { id } = req.params;
    const days = req.query.days ? Number.parseInt(req.query.days as string) : 90;

    const trend = await guildReputationService.getReputationTrend(id, days);

    res.json({ data: trend });
  } catch (error) {
    next(error);
  }
});

/**
 * Get guild reviews
 * GET /guilds/:id/reviews
 */
router.get('/:id/reviews', async (req, res, next) => {
  try {
    const { id } = req.params;
    const options = {
      limit: req.query.limit ? Number.parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? Number.parseInt(req.query.offset as string) : undefined,
    };

    const result = await guildReputationService.getGuildReviews(id, options);

    res.json({ data: result.reviews, meta: { total: result.total } });
  } catch (error) {
    next(error);
  }
});

/**
 * Get market comparison
 * GET /guilds/:id/reputation/comparison
 */
router.get('/:id/reputation/comparison', async (req, res, next) => {
  try {
    const { id } = req.params;
    const comparison = await guildReputationService.getMarketComparison(id);

    res.json({ data: comparison });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// PROJECTS
// =============================================================================

/**
 * Create guild project
 * POST /guilds/:id/projects
 */
router.post('/:id/projects', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const input = CreateGuildProjectSchema.parse(req.body);

    const project = await guildProjectsService.createProject(id, userId, input);

    res.status(201).json({ data: project });
  } catch (error) {
    next(error);
  }
});

/**
 * Get guild projects
 * GET /guilds/:id/projects
 */
router.get('/:id/projects', async (req, res, next) => {
  try {
    const { id } = req.params;
    const options = {
      status: req.query.status
        ? ((req.query.status as string).split(',') as ('PLANNING' | 'IN_PROGRESS' | 'COMPLETED')[])
        : undefined,
      limit: req.query.limit ? Number.parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? Number.parseInt(req.query.offset as string) : undefined,
    };

    const result = await guildProjectsService.listGuildProjects(id, options);

    res.json({ data: result.projects, meta: { total: result.total } });
  } catch (error) {
    next(error);
  }
});

/**
 * Get project by ID
 * GET /guilds/projects/:projectId
 */
router.get('/projects/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const project = await guildProjectsService.getProject(projectId);

    res.json({ data: project });
  } catch (error) {
    next(error);
  }
});

/**
 * Start project
 * POST /guilds/projects/:projectId/start
 */
router.post('/projects/:projectId/start', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const project = await guildProjectsService.startProject(projectId, userId);

    res.json({ data: project });
  } catch (error) {
    next(error);
  }
});

/**
 * Complete project
 * POST /guilds/projects/:projectId/complete
 */
router.post('/projects/:projectId/complete', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const project = await guildProjectsService.completeProject(projectId, userId);

    res.json({ data: project });
  } catch (error) {
    next(error);
  }
});

export default router;
