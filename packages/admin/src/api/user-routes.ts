/**
 * @module @skillancer/admin/api
 * User management routes for platform users
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import type { AdminPermission } from '../models/admin-schema.js';
import type { AdminService } from '../services/admin-service.js';
import type { UserManagementService } from '../services/user-management-service.js';

export interface UserRoutesConfig {
  userService: UserManagementService;
  adminService: AdminService;
}

export function createUserRoutes(config: UserRoutesConfig): Router {
  const router = Router();
  const { userService, adminService } = config;

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

  // ==================== User Search & Lookup ====================

  router.get('/search', requirePermission('users:view'), async (req, res, next) => {
    try {
      const adminId = (req as any).adminUser?.id;
      const { query, status, role, verified, createdAfter, createdBefore, limit, offset } =
        req.query;

      const results = await userService.searchUsers(
        {
          query: query as string,
          status: status as any,
          accountType: role as any,
          emailVerified: verified === 'true' ? true : verified === 'false' ? false : undefined,
          createdAfter: createdAfter ? new Date(createdAfter as string) : undefined,
          createdBefore: createdBefore ? new Date(createdBefore as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          page: offset
            ? Math.floor(parseInt(offset as string) / (limit ? parseInt(limit as string) : 20)) + 1
            : undefined,
        },
        adminId
      );

      res.json(results);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requirePermission('users:view'), async (req, res, next) => {
    try {
      const adminId = (req as any).adminUser?.id;
      const user = await userService.getUserDetails(req.params.id, adminId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ data: user });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/stats', requirePermission('users:view'), async (req, res, next) => {
    try {
      const adminId = (req as any).adminUser?.id;
      const userDetails = await userService.getUserDetails(req.params.id, adminId);
      res.json({ data: userDetails.stats });
    } catch (error) {
      next(error);
    }
  });

  // ==================== User Actions ====================

  router.post('/:id/ban', requirePermission('users:ban'), async (req, res, next) => {
    try {
      const { reason, duration, notifyUser } = req.body;
      const adminId = (req as any).adminUser?.id;

      await userService.banUser(
        req.params.id,
        {
          reason,
          duration,
          notifyUser,
        },
        adminId
      );

      res.json({ success: true, message: 'User banned successfully' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/unban', requirePermission('users:ban'), async (req, res, next) => {
    try {
      const { reason } = req.body;
      const adminId = (req as any).adminUser?.id;

      await userService.unbanUser(req.params.id, reason, adminId);
      res.json({ success: true, message: 'User unbanned successfully' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/verify', requirePermission('users:edit'), async (req, res, next) => {
    try {
      const { verificationType } = req.body;
      const adminId = (req as any).adminUser?.id;

      await userService.verifyUser(req.params.id, adminId, verificationType);
      res.json({ success: true, message: 'User verified successfully' });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/:id/impersonate',
    requirePermission('users:impersonate'),
    async (req, res, next) => {
      try {
        const adminId = (req as any).adminUser?.id;
        const { token, expiresAt } = await userService.impersonateUser(req.params.id, adminId);

        res.json({
          data: { token, expiresAt },
          message: 'Impersonation session created',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/:id/notes', requirePermission('users:edit'), async (req, res, next) => {
    try {
      const { content } = req.body;
      const adminId = (req as any).adminUser?.id;

      await userService.addAdminNote(req.params.id, content, adminId);
      res.status(201).json({ success: true, message: 'Note added successfully' });
    } catch (error) {
      next(error);
    }
  });

  // ==================== Bulk Operations ====================

  router.post('/bulk/update', requirePermission('users:edit'), async (req, res, next) => {
    try {
      const { userIds, updates } = req.body;
      const adminId = (req as any).adminUser?.id;

      const result = await userService.bulkUpdateUsers(userIds, updates, adminId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/export', requirePermission('reports:export'), async (req, res, next) => {
    try {
      const { format, filters } = req.body;
      const adminId = (req as any).adminUser?.id;

      const result = await userService.exportUsers(filters, format, adminId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
