/**
 * @module @skillancer/admin/api
 * Operations management routes
 */

import { Router, type Request, type Response, type NextFunction } from 'express';

import type { AdminPermission } from '../models/admin-schema.js';
import type { AdminService } from '../services/admin-service.js';
import type { CacheManagementService } from '../services/ops/cache-management-service.js';
import type { DatabaseOpsService } from '../services/ops/database-ops-service.js';
import type { DeploymentService } from '../services/ops/deployment-service.js';
import type { QueueManagementService } from '../services/ops/queue-management-service.js';
import type { SystemHealthService } from '../services/ops/system-health-service.js';

export interface OpsRoutesConfig {
  healthService: SystemHealthService;
  queueService: QueueManagementService;
  cacheService: CacheManagementService;
  dbService: DatabaseOpsService;
  deploymentService: DeploymentService;
  adminService: AdminService;
}

export function createOpsRoutes(config: OpsRoutesConfig): Router {
  const router = Router();
  const { healthService, queueService, cacheService, dbService, deploymentService, adminService } =
    config;

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

  // ==================== System Health ====================

  router.get('/health', requirePermission('system:view'), async (req, res, next) => {
    try {
      const health = await healthService.getSystemHealth();
      res.json({ data: health });
    } catch (error) {
      next(error);
    }
  });

  router.get('/health/alerts', requirePermission('system:view'), async (req, res, next) => {
    try {
      const { status } = req.query;
      const alerts = await healthService.getActiveAlerts(status as any);
      res.json({ data: alerts });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/health/alerts/:id/acknowledge',
    requirePermission('system:manage'),
    async (req, res, next) => {
      try {
        const adminId = (req as any).adminUser?.id;
        await healthService.acknowledgeAlert(req.params.id, adminId);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/health/incidents', requirePermission('system:manage'), async (req, res, next) => {
    try {
      const adminId = (req as any).adminUser?.id;
      const incident = await healthService.createIncident(req.body, adminId);
      res.status(201).json({ data: incident });
    } catch (error) {
      next(error);
    }
  });

  // ==================== Queue Management ====================

  router.get('/queues', requirePermission('system:view'), async (req, res, next) => {
    try {
      const queues = await queueService.getAllQueues();
      res.json({ data: queues });
    } catch (error) {
      next(error);
    }
  });

  router.get('/queues/:name', requirePermission('system:view'), async (req, res, next) => {
    try {
      const queue = await queueService.getQueueInfo(req.params.name);
      res.json({ data: queue });
    } catch (error) {
      next(error);
    }
  });

  router.get('/queues/:name/jobs', requirePermission('system:view'), async (req, res, next) => {
    try {
      const { status, limit, offset } = req.query;
      const jobs = await queueService.getJobs(req.params.name, {
        status: status as any,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(jobs);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/queues/:name/jobs/:jobId/retry',
    requirePermission('system:manage'),
    async (req, res, next) => {
      try {
        await queueService.retryJob(req.params.name, req.params.jobId);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    '/queues/:name/jobs/:jobId',
    requirePermission('system:manage'),
    async (req, res, next) => {
      try {
        await queueService.removeJob(req.params.name, req.params.jobId);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/queues/:name/retry-failed',
    requirePermission('system:manage'),
    async (req, res, next) => {
      try {
        const result = await queueService.retryAllFailed(req.params.name);
        res.json({ data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post('/queues/:name/pause', requirePermission('system:manage'), async (req, res, next) => {
    try {
      await queueService.pauseQueue(req.params.name);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/queues/:name/resume',
    requirePermission('system:manage'),
    async (req, res, next) => {
      try {
        await queueService.resumeQueue(req.params.name);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Cache Management ====================

  router.get('/cache/stats', requirePermission('system:view'), async (req, res, next) => {
    try {
      const stats = await cacheService.getCacheStats();
      res.json({ data: stats });
    } catch (error) {
      next(error);
    }
  });

  router.get('/cache/keys', requirePermission('system:view'), async (req, res, next) => {
    try {
      const { pattern, limit } = req.query;
      const keys = await cacheService.scanKeys(
        (pattern as string) || '*',
        limit ? parseInt(limit as string) : undefined
      );
      res.json({ data: keys });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/cache/keys/:key', requirePermission('system:manage'), async (req, res, next) => {
    try {
      await cacheService.deleteKey(req.params.key);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.post('/cache/invalidate', requirePermission('system:manage'), async (req, res, next) => {
    try {
      const { pattern } = req.body;
      const count = await cacheService.invalidateByPattern(pattern);
      res.json({ data: { deletedCount: count } });
    } catch (error) {
      next(error);
    }
  });

  router.get('/cache/groups', requirePermission('system:view'), async (req, res, next) => {
    try {
      const groups = await cacheService.getCacheGroups();
      res.json({ data: groups });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/cache/groups/:name/invalidate',
    requirePermission('system:manage'),
    async (req, res, next) => {
      try {
        const count = await cacheService.invalidateCacheGroup(req.params.name);
        res.json({ data: { deletedCount: count } });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Database Ops ====================

  router.get('/database/stats', requirePermission('system:view'), async (req, res, next) => {
    try {
      const stats = await dbService.getDatabaseStats();
      res.json({ data: stats });
    } catch (error) {
      next(error);
    }
  });

  router.get('/database/queries', requirePermission('system:view'), async (req, res, next) => {
    try {
      const queries = await dbService.getActiveQueries();
      res.json({ data: queries });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/database/queries/:pid/cancel',
    requirePermission('system:manage'),
    async (req, res, next) => {
      try {
        const cancelled = await dbService.cancelQuery(parseInt(req.params.pid));
        res.json({ success: cancelled });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/database/tables', requirePermission('system:view'), async (req, res, next) => {
    try {
      const tables = await dbService.getTableStats();
      res.json({ data: tables });
    } catch (error) {
      next(error);
    }
  });

  router.get('/database/indexes', requirePermission('system:view'), async (req, res, next) => {
    try {
      const indexes = await dbService.getIndexStats();
      res.json({ data: indexes });
    } catch (error) {
      next(error);
    }
  });

  router.get('/database/locks', requirePermission('system:view'), async (req, res, next) => {
    try {
      const locks = await dbService.getActiveLocks();
      res.json({ data: locks });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/database/vacuum/:table',
    requirePermission('system:manage'),
    async (req, res, next) => {
      try {
        const { full, analyze } = req.body;
        await dbService.vacuumTable(req.params.table, { full, analyze });
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Deployments ====================

  router.get('/deployments', requirePermission('system:view'), async (req, res, next) => {
    try {
      const { service, environment, status, limit, offset } = req.query;
      const deployments = await deploymentService.getDeployments({
        service: service as string,
        environment: environment as string,
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });
      res.json(deployments);
    } catch (error) {
      next(error);
    }
  });

  router.get('/deployments/:id', requirePermission('system:view'), async (req, res, next) => {
    try {
      const deployment = await deploymentService.getDeployment(req.params.id);
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }
      res.json({ data: deployment });
    } catch (error) {
      next(error);
    }
  });

  router.get('/deployments/versions', requirePermission('system:view'), async (req, res, next) => {
    try {
      const versions = await deploymentService.getServiceVersions();
      res.json({ data: versions });
    } catch (error) {
      next(error);
    }
  });

  router.post('/deployments', requirePermission('system:deploy'), async (req, res, next) => {
    try {
      const adminId = (req as any).adminUser?.id;
      const deployment = await deploymentService.triggerDeployment(req.body, adminId);
      res.status(201).json({ data: deployment });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/deployments/:id/rollback',
    requirePermission('system:deploy'),
    async (req, res, next) => {
      try {
        const { reason } = req.body;
        const adminId = (req as any).adminUser?.id;
        const deployment = await deploymentService.rollback(req.params.id, adminId, reason);
        res.json({ data: deployment });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
