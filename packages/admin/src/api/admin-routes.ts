/**
 * @module @skillancer/admin/api
 * Admin user management routes
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import type { AdminPermission } from '../models/admin-schema.js';
import type { AdminService } from '../services/admin-service.js';

export interface AdminRoutesConfig {
  adminService: AdminService;
}

export function createAdminRoutes(config: AdminRoutesConfig): Router {
  const router = Router();
  const { adminService } = config;

  // Middleware to require specific permission
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

  // ==================== Admin Users ====================

  router.get('/users', requirePermission('admin:manage'), async (req, res, next) => {
    try {
      const admins = await adminService.getAdminUsers();
      res.json({ data: admins });
    } catch (error) {
      next(error);
    }
  });

  router.get('/users/:id', requirePermission('admin:manage'), async (req, res, next) => {
    try {
      const admin = await adminService.getAdminUser(req.params.id);
      if (!admin) {
        return res.status(404).json({ error: 'Admin user not found' });
      }
      res.json({ data: admin });
    } catch (error) {
      next(error);
    }
  });

  router.post('/users', requirePermission('admin:manage'), async (req, res, next) => {
    try {
      const { email, name, role, permissions } = req.body;
      const adminId = (req as any).adminUser?.id;

      const admin = await adminService.createAdminUser({ email, name, role, permissions }, adminId);

      res.status(201).json({ data: admin });
    } catch (error) {
      next(error);
    }
  });

  router.put('/users/:id', requirePermission('admin:manage'), async (req, res, next) => {
    try {
      const { name, role, permissions, isActive } = req.body;
      const adminId = (req as any).adminUser?.id;

      const admin = await adminService.updateAdminUser(
        req.params.id,
        { name, role, permissions, isActive },
        adminId
      );

      res.json({ data: admin });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/users/:id', requirePermission('admin:manage'), async (req, res, next) => {
    try {
      const adminId = (req as any).adminUser?.id;
      await adminService.deleteAdminUser(req.params.id, adminId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // ==================== Audit Logs ====================

  router.get('/audit-logs', requirePermission('audit:view'), async (req, res, next) => {
    try {
      const { action, adminId, resourceType, startDate, endDate, limit, offset } = req.query;

      const logs = await adminService.getAuditLogs({
        action: action as string,
        adminId: adminId as string,
        resourceType: resourceType as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // ==================== Feature Flags ====================

  router.get('/feature-flags', requirePermission('settings:view'), async (req, res, next) => {
    try {
      const flags = await adminService.getFeatureFlags();
      res.json({ data: flags });
    } catch (error) {
      next(error);
    }
  });

  router.put(
    '/feature-flags/:key',
    requirePermission('settings:manage'),
    async (req, res, next) => {
      try {
        const { enabled, rolloutPercentage, allowedUserIds, metadata } = req.body;
        const adminId = (req as any).adminUser?.id;

        const flag = await adminService.updateFeatureFlag(
          req.params.key,
          { enabled, rolloutPercentage, allowedUserIds, metadata },
          adminId
        );

        res.json({ data: flag });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== System Settings ====================

  router.get('/settings', requirePermission('settings:view'), async (req, res, next) => {
    try {
      const { category } = req.query;
      const settings = await adminService.getSettings(category as string);
      res.json({ data: settings });
    } catch (error) {
      next(error);
    }
  });

  router.put('/settings/:key', requirePermission('settings:manage'), async (req, res, next) => {
    try {
      const { value } = req.body;
      const adminId = (req as any).adminUser?.id;

      const setting = await adminService.updateSetting(req.params.key, value, adminId);
      res.json({ data: setting });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
