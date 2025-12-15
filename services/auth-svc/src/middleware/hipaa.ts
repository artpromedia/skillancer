/**
 * @module @skillancer/auth-svc/middleware/hipaa
 * HIPAA Compliance Middleware
 */

import { prisma, BaaStatus, TrainingStatus } from '@skillancer/database';
import { createLogger } from '@skillancer/logger';

import type { AuthenticatedUser } from './auth.js';
import type { PhiAccessType, PhiCategory } from '../types/hipaa.types.js';
import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

const logger = createLogger({ serviceName: 'hipaa-middleware' });

// =============================================================================
// TYPES
// =============================================================================

export interface HipaaMiddlewareOptions {
  /** Whether PHI access requires checking (default: true) */
  requirePhiCheck?: boolean;
  /** The type of PHI access being performed */
  accessType?: PhiAccessType;
  /** The category of PHI being accessed */
  phiCategory?: PhiCategory;
  /** Whether to allow access if HIPAA is not enabled (default: true) */
  allowNonHipaa?: boolean;
  /** Custom purpose for audit logging */
  purpose?: string;
}

export interface HipaaComplianceCheckResult {
  allowed: boolean;
  reason?: string;
  hipaaEnabled: boolean;
  checks: {
    baaStatus: boolean;
    trainingCompleted: boolean;
    mfaEnabled: boolean;
    identityVerified: boolean;
    ipWhitelisted: boolean;
  };
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * HIPAA compliance middleware factory
 * Checks user's compliance status before allowing access to PHI-related endpoints
 */
export function hipaaComplianceMiddleware(options: HipaaMiddlewareOptions = {}) {
  const { requirePhiCheck = true, allowNonHipaa = true } = options;

  return async function hipaaMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): Promise<void> {
    try {
      const user = request.user as AuthenticatedUser | undefined;

      if (!user) {
        return done(new Error('Authentication required'));
      }

      const tenantId = user.tenantId;

      if (!tenantId) {
        if (allowNonHipaa) {
          return done();
        }
        await reply.status(403).send({
          error: 'Tenant context required for HIPAA compliance',
        });
        return;
      }

      // Get HIPAA compliance status
      const compliance = await prisma.hipaaCompliance.findUnique({
        where: { tenantId },
      });

      // If HIPAA is not enabled for tenant
      if (!compliance?.hipaaEnabled) {
        if (allowNonHipaa) {
          return done();
        }
        await reply.status(403).send({
          error: 'HIPAA compliance not enabled for tenant',
          code: 'HIPAA_NOT_ENABLED',
        });
        return;
      }

      // Skip detailed checks if not required
      if (!requirePhiCheck) {
        return done();
      }

      // Perform compliance checks
      const checkResult = await performComplianceChecks(user.id, tenantId, compliance, request);

      if (!checkResult.allowed) {
        logger.warn(
          {
            userId: user.id,
            tenantId,
            reason: checkResult.reason,
            checks: checkResult.checks,
          },
          'HIPAA compliance check failed'
        );

        await reply.status(403).send({
          error: 'HIPAA compliance requirements not met',
          reason: checkResult.reason,
          checks: checkResult.checks,
          code: 'HIPAA_COMPLIANCE_FAILED',
        });
        return;
      }

      // Attach compliance info to request for downstream use
      (
        request as FastifyRequest & { hipaaCompliance?: HipaaComplianceCheckResult }
      ).hipaaCompliance = checkResult;

      done();
    } catch (error) {
      logger.error({ error }, 'Error in HIPAA compliance middleware');
      done(error as Error);
    }
  };
}

/**
 * Perform all HIPAA compliance checks
 */
async function performComplianceChecks(
  userId: string,
  tenantId: string,
  compliance: {
    baaStatus: BaaStatus;
    trainingRequired: boolean;
    mfaRequired: boolean;
    ipWhitelist: string[];
  },
  request: FastifyRequest
): Promise<HipaaComplianceCheckResult> {
  const checks = {
    baaStatus: false,
    trainingCompleted: false,
    mfaEnabled: false,
    identityVerified: false,
    ipWhitelisted: true, // Default true if no whitelist
  };

  const failedReasons: string[] = [];

  // 1. Check BAA status
  checks.baaStatus = compliance.baaStatus === BaaStatus.SIGNED;
  if (!checks.baaStatus) {
    failedReasons.push('Business Associate Agreement not signed');
  }

  // 2. Check training status
  if (compliance.trainingRequired) {
    const trainings = await prisma.hipaaTraining.findMany({
      where: { userId, tenantId },
    });

    checks.trainingCompleted = trainings.some(
      (t) =>
        t.status === TrainingStatus.COMPLETED &&
        t.passed &&
        (!t.expiresAt || t.expiresAt > new Date())
    );

    if (!checks.trainingCompleted) {
      failedReasons.push('HIPAA training not completed or expired');
    }
  } else {
    checks.trainingCompleted = true;
  }

  // 3. Check MFA status
  if (compliance.mfaRequired) {
    const mfa = await prisma.userMfa.findUnique({
      where: { userId },
    });

    checks.mfaEnabled = mfa?.enabled ?? false;

    if (!checks.mfaEnabled) {
      failedReasons.push('Multi-factor authentication not enabled');
    }
  } else {
    checks.mfaEnabled = true;
  }

  // 4. Check identity verification
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { verificationLevel: true },
  });

  checks.identityVerified =
    user?.verificationLevel === 'ENHANCED' || user?.verificationLevel === 'PREMIUM';

  if (!checks.identityVerified) {
    failedReasons.push('Enhanced identity verification required');
  }

  // 5. Check IP whitelist (if configured)
  if (compliance.ipWhitelist.length > 0) {
    const clientIp = getClientIp(request);
    checks.ipWhitelisted = compliance.ipWhitelist.includes(clientIp);

    if (!checks.ipWhitelisted) {
      failedReasons.push('IP address not in whitelist');
    }
  }

  return {
    allowed: failedReasons.length === 0,
    reason: failedReasons.join('; '),
    hipaaEnabled: true,
    checks,
  };
}

/**
 * Get client IP from request
 */
function getClientIp(request: FastifyRequest): string {
  // Check various headers for proxied IP
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips?.trim() ?? request.ip;
  }

  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? (realIp[0] ?? request.ip) : realIp;
  }

  return request.ip;
}

/**
 * Simple middleware that just checks if HIPAA is enabled for the tenant
 */
export function requireHipaaEnabled() {
  return hipaaComplianceMiddleware({
    requirePhiCheck: false,
    allowNonHipaa: false,
  });
}

/**
 * Middleware that requires full PHI access compliance
 */
export function requirePhiAccess(options?: {
  accessType?: PhiAccessType;
  phiCategory?: PhiCategory;
  purpose?: string;
}) {
  return hipaaComplianceMiddleware({
    requirePhiCheck: true,
    allowNonHipaa: false,
    ...options,
  });
}

/**
 * Session timeout middleware for HIPAA compliance
 * Enforces tenant-specific session timeout settings using JWT session ID
 * Note: For HIPAA compliance, this middleware validates that the JWT is still within
 * the HIPAA-compliant session window. Full session invalidation requires token blacklisting.
 */
export function hipaaSessionTimeoutMiddleware() {
  // In-memory activity tracking (should be replaced with Redis in production)
  const activityMap = new Map<string, number>();

  return async function sessionTimeoutMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction
  ): Promise<void> {
    try {
      const user = request.user as AuthenticatedUser | undefined;

      if (!user?.tenantId || !user?.sessionId) {
        return done();
      }

      const compliance = await prisma.hipaaCompliance.findUnique({
        where: { tenantId: user.tenantId },
        select: { hipaaEnabled: true, sessionTimeout: true },
      });

      if (!compliance?.hipaaEnabled) {
        return done();
      }

      const sessionKey = `${user.id}:${user.sessionId}`;
      const lastActivity = activityMap.get(sessionKey);
      const now = Date.now();

      // Check if session has exceeded HIPAA timeout
      const sessionTimeout = compliance.sessionTimeout * 60 * 1000; // Convert to ms

      if (lastActivity && now - lastActivity > sessionTimeout) {
        logger.info(
          { userId: user.id, sessionId: user.sessionId, timeSinceActivity: now - lastActivity },
          'HIPAA session timeout exceeded'
        );

        // Remove from activity tracking
        activityMap.delete(sessionKey);

        await reply.status(401).send({
          error: 'Session expired due to HIPAA timeout policy',
          code: 'HIPAA_SESSION_TIMEOUT',
        });
        return;
      }

      // Update activity timestamp
      activityMap.set(sessionKey, now);

      done();
    } catch (error) {
      logger.error({ error }, 'Error in HIPAA session timeout middleware');
      done();
    }
  };
}

/**
 * Decorator to add HIPAA compliance checking to route options
 */
export function withHipaaCompliance(options: HipaaMiddlewareOptions = {}) {
  return {
    preHandler: [hipaaComplianceMiddleware(options)],
  };
}
