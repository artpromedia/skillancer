/**
 * Security API Routes
 *
 * Express router with endpoints for audit, data protection, DSR,
 * retention, threat detection, and compliance management.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';

import type { AuditService } from '../audit/audit-service';
import type { ComplianceReportingService } from '../compliance/compliance-reporting-service';
import type { DataProtectionService } from '../data-protection/data-protection-service';
import type { ThreatDetectionService } from '../threat-detection/threat-detection-service';

// ==================== Request Validation Schemas ====================

const queryEventsSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  eventType: z.string().optional(),
  category: z.string().optional(),
  actorId: z.string().optional(),
  targetId: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  limit: z.coerce.number().min(1).max(1000).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const encryptSchema = z.object({
  data: z.string(),
});

const consentSchema = z.object({
  userId: z.string(),
  consentType: z.string(),
  granted: z.boolean(),
  metadata: z.record(z.any()).optional(),
});

const dsrSchema = z.object({
  userId: z.string(),
  type: z.enum(['access', 'deletion', 'portability', 'rectification', 'restriction', 'objection']),
  details: z.record(z.any()).optional(),
});

const retentionPolicySchema = z.object({
  name: z.string(),
  dataType: z.string(),
  retentionDays: z.number().min(1),
  action: z.enum(['delete', 'anonymize', 'archive']),
  criteria: z.record(z.any()).optional(),
});

const blockIpSchema = z.object({
  ip: z.string(),
  reason: z.string(),
  duration: z.number().optional(),
});

const complianceReportSchema = z.object({
  type: z.enum([
    'gdpr_audit',
    'ccpa_audit',
    'soc2_audit',
    'security_audit',
    'access_audit',
    'data_processing',
    'incident_report',
    'dsr_report',
  ]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// ==================== Middleware ====================

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.roles?.includes('admin') && !req.user?.roles?.includes('security_admin')) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};

const validate =
  <T extends z.ZodSchema>(schema: T) =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req.method === 'GET' ? req.query : req.body;
      schema.parse(data);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  };

// ==================== Router Factory ====================

export interface SecurityRouterDependencies {
  auditService: AuditService;
  dataProtectionService: DataProtectionService;
  threatDetectionService: ThreatDetectionService;
  complianceReportingService: ComplianceReportingService;
}

export function createSecurityRouter(deps: SecurityRouterDependencies): Router {
  const router = Router();
  const {
    auditService,
    dataProtectionService,
    threatDetectionService,
    complianceReportingService,
  } = deps;

  // ==================== Audit Routes ====================

  /**
   * GET /audit/events
   * Query audit events with filters
   */
  router.get(
    '/audit/events',
    requireAuth,
    requireAdmin,
    validate(queryEventsSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = queryEventsSchema.parse(req.query);

        const result = await auditService.queryEvents({
          startDate: query.startDate ? new Date(query.startDate) : undefined,
          endDate: query.endDate ? new Date(query.endDate) : undefined,
          eventType: query.eventType,
          category: query.category as any,
          actorId: query.actorId,
          targetId: query.targetId,
          severity: query.severity,
          limit: query.limit,
          offset: query.offset,
        });

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /audit/events/:id
   * Get a specific audit event
   */
  router.get(
    '/audit/events/:id',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const event = await auditService.getEventById(req.params.id);

        if (!event) {
          res.status(404).json({ error: 'Event not found' });
          return;
        }

        res.json(event);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /audit/actor/:id
   * Get activity for a specific actor
   */
  router.get(
    '/audit/actor/:id',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const events = await auditService.getActorActivity(req.params.id, limit);

        res.json({ events, total: events.length });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /audit/alerts
   * Get security alerts
   */
  router.get(
    '/audit/alerts',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const startDate = req.query.startDate
          ? new Date(req.query.startDate as string)
          : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

        const alerts = await auditService.getSecurityAlerts(startDate, endDate);

        res.json({ alerts, total: alerts.length });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /audit/stats
   * Get audit event statistics
   */
  router.get(
    '/audit/stats',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const startDate = req.query.startDate
          ? new Date(req.query.startDate as string)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

        const stats = await auditService.getEventStats(startDate, endDate);

        res.json(stats);
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Data Protection Routes ====================

  /**
   * POST /data-protection/encrypt
   * Encrypt sensitive data
   */
  router.post(
    '/data-protection/encrypt',
    requireAuth,
    requireAdmin,
    validate(encryptSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { data } = encryptSchema.parse(req.body);
        const encrypted = dataProtectionService.encrypt(data);

        res.json({ encrypted });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /data-protection/decrypt
   * Decrypt sensitive data
   */
  router.post(
    '/data-protection/decrypt',
    requireAuth,
    requireAdmin,
    validate(encryptSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { data } = encryptSchema.parse(req.body);
        const decrypted = dataProtectionService.decrypt(data);

        res.json({ decrypted });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /data-protection/classify
   * Classify data sensitivity
   */
  router.post(
    '/data-protection/classify',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const classification = dataProtectionService.classifyData(req.body.data);

        res.json(classification);
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Consent Routes ====================

  /**
   * POST /consent
   * Record user consent
   */
  router.post(
    '/consent',
    requireAuth,
    validate(consentSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const data = consentSchema.parse(req.body);

        await dataProtectionService.recordConsent(
          data.userId,
          data.consentType as any,
          data.granted,
          req.ip || 'unknown',
          data.metadata
        );

        // Audit log
        await auditService.logComplianceEvent(
          'consent_recorded',
          {
            type: 'user',
            id: req.user?.id || 'system',
            ipAddress: req.ip || 'unknown',
          },
          {
            target: { type: 'user', id: data.userId },
            regulations: ['GDPR', 'CCPA'],
            metadata: { consentType: data.consentType, granted: data.granted },
          }
        );

        res.status(201).json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /consent/:userId
   * Get user consents
   */
  router.get(
    '/consent/:userId',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Users can only view their own consent, admins can view all
        if (req.user?.id !== req.params.userId && !req.user?.roles?.includes('admin')) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        const consents = await dataProtectionService.getConsents(req.params.userId);

        res.json({ consents });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /consent/:userId
   * Withdraw all consents for a user
   */
  router.delete(
    '/consent/:userId',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (req.user?.id !== req.params.userId && !req.user?.roles?.includes('admin')) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        await dataProtectionService.withdrawAllConsents(req.params.userId, req.ip || 'unknown');

        // Audit log
        await auditService.logComplianceEvent(
          'consent_withdrawn',
          {
            type: 'user',
            id: req.user?.id || 'system',
            ipAddress: req.ip || 'unknown',
          },
          {
            target: { type: 'user', id: req.params.userId },
            regulations: ['GDPR', 'CCPA'],
            metadata: { action: 'withdraw_all' },
          }
        );

        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Data Subject Request Routes ====================

  /**
   * POST /dsr
   * Create a data subject request
   */
  router.post(
    '/dsr',
    requireAuth,
    validate(dsrSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const data = dsrSchema.parse(req.body);

        // Users can only create DSRs for themselves, admins can create for others
        if (req.user?.id !== data.userId && !req.user?.roles?.includes('admin')) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        const dsr = await dataProtectionService.createDataSubjectRequest(
          data.userId,
          data.type,
          data.details
        );

        res.status(201).json(dsr);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /dsr
   * List data subject requests
   */
  router.get(
    '/dsr',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const _status = req.query.status as string;
        const _type = req.query.type as string;
        const _limit = parseInt(req.query.limit as string) || 50;

        // Query from database - simplified for now
        res.json({ requests: [], total: 0, message: 'Use database query for full list' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /dsr/:id/process
   * Process a data subject request
   */
  router.post(
    '/dsr/:id/process',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        // Get DSR details (would fetch from database)
        const dsrId = req.params.id;
        const dsrType = req.body.type as
          | 'access'
          | 'deletion'
          | 'portability'
          | 'rectification'
          | 'restriction'
          | 'objection';
        const userId = req.body.userId as string;

        if (!dsrType || !userId) {
          res.status(400).json({ error: 'Type and userId are required' });
          return;
        }

        let result: any;

        switch (dsrType) {
          case 'access':
            result = await dataProtectionService.processAccessRequest(dsrId, userId);
            break;
          case 'deletion':
            result = await dataProtectionService.processDeletionRequest(dsrId, userId);
            break;
          default:
            result = { success: true, message: `${dsrType} request processed` };
        }

        // Audit log
        await auditService.logComplianceEvent(
          'dsr_processed',
          {
            type: 'admin',
            id: req.user?.id || 'system',
            ipAddress: req.ip || 'unknown',
          },
          {
            target: { type: 'user', id: userId },
            regulations: ['GDPR', 'CCPA'],
            metadata: { dsrId, dsrType, result: result.success },
          }
        );

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Retention Policy Routes ====================

  /**
   * GET /retention-policies
   * List retention policies
   */
  router.get(
    '/retention-policies',
    requireAuth,
    requireAdmin,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const policies = await dataProtectionService.getRetentionPolicies();

        res.json({ policies });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /retention-policies
   * Create a retention policy
   */
  router.post(
    '/retention-policies',
    requireAuth,
    requireAdmin,
    validate(retentionPolicySchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const data = retentionPolicySchema.parse(req.body);

        const policy = await dataProtectionService.createRetentionPolicy(data);

        // Audit log
        await auditService.logComplianceEvent(
          'retention_policy_created',
          {
            type: 'admin',
            id: req.user?.id || 'system',
            ipAddress: req.ip || 'unknown',
          },
          {
            target: { type: 'retention_policy', id: policy.id },
            regulations: ['GDPR'],
            metadata: { policy },
          }
        );

        res.status(201).json(policy);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /retention-policies/:id/run
   * Execute a retention policy
   */
  router.post(
    '/retention-policies/:id/run',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await dataProtectionService.runRetentionPolicy(req.params.id);

        // Audit log
        await auditService.logComplianceEvent(
          'retention_policy_executed',
          {
            type: 'admin',
            id: req.user?.id || 'system',
            ipAddress: req.ip || 'unknown',
          },
          {
            target: { type: 'retention_policy', id: req.params.id },
            regulations: ['GDPR'],
            metadata: { result },
          }
        );

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Threat Detection Routes ====================

  /**
   * GET /threats/blocked-ips
   * List blocked IP addresses
   */
  router.get(
    '/threats/blocked-ips',
    requireAuth,
    requireAdmin,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const blockedIPs = await threatDetectionService.getBlockedIPs();

        res.json({ blockedIPs });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /threats/block-ip
   * Block an IP address
   */
  router.post(
    '/threats/block-ip',
    requireAuth,
    requireAdmin,
    validate(blockIpSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { ip, reason, duration } = blockIpSchema.parse(req.body);

        await threatDetectionService.blockIP(ip, reason, duration);

        // Audit log
        await auditService.logSecurityAlert(
          'ip_blocked',
          {
            type: 'admin',
            id: req.user?.id || 'system',
            ipAddress: req.ip || 'unknown',
          },
          'high',
          { ip, reason, duration }
        );

        res.status(201).json({ success: true, message: `IP ${ip} blocked` });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /threats/block-ip/:ip
   * Unblock an IP address
   */
  router.delete(
    '/threats/block-ip/:ip',
    requireAuth,
    requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const ip = req.params.ip;

        await threatDetectionService.unblockIP(ip);

        // Audit log
        await auditService.logSecurityAlert(
          'ip_unblocked',
          {
            type: 'admin',
            id: req.user?.id || 'system',
            ipAddress: req.ip || 'unknown',
          },
          'medium',
          { ip }
        );

        res.json({ success: true, message: `IP ${ip} unblocked` });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /threats/devices/:userId
   * Get known devices for a user
   */
  router.get(
    '/threats/devices/:userId',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (req.user?.id !== req.params.userId && !req.user?.roles?.includes('admin')) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        const devices = await threatDetectionService.getKnownDevices(req.params.userId);

        res.json({ devices });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * DELETE /threats/devices/:userId/:fingerprint
   * Remove a known device
   */
  router.delete(
    '/threats/devices/:userId/:fingerprint',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        if (req.user?.id !== req.params.userId && !req.user?.roles?.includes('admin')) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        await threatDetectionService.removeKnownDevice(req.params.userId, req.params.fingerprint);

        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==================== Compliance Routes ====================

  /**
   * GET /compliance/gdpr/status
   * Get GDPR compliance status
   */
  router.get(
    '/compliance/gdpr/status',
    requireAuth,
    requireAdmin,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const status = await complianceReportingService.getGDPRComplianceStatus();

        res.json(status);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /compliance/check/:regulation
   * Run compliance check for a regulation
   */
  router.post(
    '/compliance/check/:regulation',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await complianceReportingService.runComplianceCheck(req.params.regulation);

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /compliance/reports
   * Generate a compliance report
   */
  router.post(
    '/compliance/reports',
    requireAuth,
    requireAdmin,
    validate(complianceReportSchema),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const data = complianceReportSchema.parse(req.body);

        const report = await complianceReportingService.generateComplianceReport(
          data.type,
          new Date(data.startDate),
          new Date(data.endDate),
          req.user?.id || 'system'
        );

        res.status(201).json(report);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /compliance/reports
   * List compliance reports
   */
  router.get(
    '/compliance/reports',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const type = req.query.type as any;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const limit = parseInt(req.query.limit as string) || 20;

        const reports = await complianceReportingService.getReports({
          type,
          startDate,
          endDate,
          limit,
        });

        res.json({ reports, total: reports.length });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /compliance/reports/:id
   * Get a specific compliance report
   */
  router.get(
    '/compliance/reports/:id',
    requireAuth,
    requireAdmin,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const report = await complianceReportingService.getReport(req.params.id);

        if (!report) {
          res.status(404).json({ error: 'Report not found' });
          return;
        }

        res.json(report);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default createSecurityRouter;
