/**
 * @module @skillancer/admin/api
 * Content moderation routes
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import type { AdminPermission } from '../models/admin-schema.js';
import type { AdminService } from '../services/admin-service.js';
import type { ModerationService } from '../services/moderation-service.js';

export interface ModerationRoutesConfig {
  moderationService: ModerationService;
  adminService: AdminService;
}

export function createModerationRoutes(config: ModerationRoutesConfig): Router {
  const router = Router();
  const { moderationService, adminService } = config;

  const requirePermission = (permission: AdminPermission) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const adminId = (req as any).adminUser?.id;
        if (!adminId) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const hasPermission = await adminService.hasPermission(adminId, permission);
        if (!hasPermission) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  };

  // ==================== Moderation Queue ====================

  router.get('/queue', requirePermission('content:moderate'), async (req, res, next) => {
    try {
      const { contentType, status, priority, assignedTo, limit, offset } = req.query;

      const queue = await moderationService.getModerationQueue({
        contentType: contentType as any,
        status: status as any,
        priority: priority as any,
        assignedTo: assignedTo as string,
        limit: limit ? Number.parseInt(limit as string) : undefined,
        offset: offset ? Number.parseInt(offset as string) : undefined,
      });

      res.json(queue);
    } catch (error) {
      next(error);
    }
  });

  router.get('/queue/:id', requirePermission('content:moderate'), async (req, res, next) => {
    try {
      const item = await moderationService.getQueueItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Queue item not found' });
      }
      res.json({ data: item });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/queue/:id/assign',
    requirePermission('content:moderate'),
    async (req, res, next) => {
      try {
        const { moderatorId } = req.body;
        await moderationService.assignToModerator(req.params.id, moderatorId);
        res.json({ success: true, message: 'Item assigned successfully' });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Moderation Decisions ====================

  router.post(
    '/queue/:id/approve',
    requirePermission('content:moderate'),
    async (req, res, next) => {
      try {
        const { notes } = req.body;
        const adminId = (req as any).adminUser?.id;

        await moderationService.approveContentById(req.params.id, adminId, notes);
        res.json({ success: true, message: 'Content approved' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/queue/:id/reject',
    requirePermission('content:moderate'),
    async (req, res, next) => {
      try {
        const { reason, violationTypes, notes, notifyUser } = req.body;
        const adminId = (req as any).adminUser?.id;

        await moderationService.rejectContentById(req.params.id, adminId, {
          reason,
          violationTypes,
          notes,
          notifyUser,
        });
        res.json({ success: true, message: 'Content rejected' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/queue/:id/request-changes',
    requirePermission('content:moderate'),
    async (req, res, next) => {
      try {
        const { changes, deadline } = req.body;
        const adminId = (req as any).adminUser?.id;

        await moderationService.requestChangesById(req.params.id, adminId, changes, deadline);
        res.json({ success: true, message: 'Changes requested' });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/queue/:id/escalate',
    requirePermission('content:moderate'),
    async (req, res, next) => {
      try {
        const { reason, priority } = req.body;
        const adminId = (req as any).adminUser?.id;

        await moderationService.escalateContentById(req.params.id, adminId, reason, priority);
        res.json({ success: true, message: 'Content escalated' });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Content Filters ====================

  router.get('/filters', requirePermission('content:moderate'), async (req, res, next) => {
    try {
      const filters = await moderationService.getContentFilters();
      res.json({ data: filters });
    } catch (error) {
      next(error);
    }
  });

  router.post('/filters', requirePermission('settings:manage'), async (req, res, next) => {
    try {
      const { name, type, pattern, action, severity, isActive } = req.body;
      const adminId = (req as any).adminUser?.id;

      const filter = await moderationService.createContentFilter(
        { name, type, pattern, action, severity, isActive },
        adminId
      );
      res.status(201).json({ data: filter });
    } catch (error) {
      next(error);
    }
  });

  router.put('/filters/:id', requirePermission('settings:manage'), async (req, res, next) => {
    try {
      const { name, pattern, action, severity, isActive } = req.body;
      const adminId = (req as any).adminUser?.id;

      const filter = await moderationService.updateContentFilter(
        req.params.id,
        { name, pattern, action, severity, isActive },
        adminId
      );
      res.json({ data: filter });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/filters/:id', requirePermission('settings:manage'), async (req, res, next) => {
    try {
      const adminId = (req as any).adminUser?.id;
      await moderationService.deleteContentFilter(req.params.id, adminId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // ==================== Moderation Stats ====================

  router.get('/stats', requirePermission('reports:view'), async (req, res, next) => {
    try {
      const adminId = (req as any).adminUser?.id;
      const stats = await moderationService.getModerationStats(adminId);
      res.json({ data: stats });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
