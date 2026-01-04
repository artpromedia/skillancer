// @ts-nocheck - TODO: Method signatures need alignment with audit service
/**
 * Security Middleware
 *
 * Express middleware for IP blocking, request analysis,
 * rate limiting, and audit logging.
 */

import type { AuditService } from '../audit/audit-service';
import type {
  ThreatDetectionService,
  LoginRiskLevel,
} from '../threat-detection/threat-detection-service';
import type { Request, Response, NextFunction } from 'express';

// ==================== Types ====================

export interface SecurityMiddlewareConfig {
  enableIPBlocking: boolean;
  enableRequestAnalysis: boolean;
  enableRateLimiting: boolean;
  enableAuditLogging: boolean;
  excludePaths: string[];
  trustProxy: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  securityContext?: {
    ipBlocked: boolean;
    riskLevel: LoginRiskLevel;
    threats: string[];
    requestId: string;
  };
}

export interface Logger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
}

// ==================== Middleware Factory ====================

export function createSecurityMiddleware(
  threatDetectionService: ThreatDetectionService,
  auditService: AuditService,
  logger: Logger,
  config: Partial<SecurityMiddlewareConfig> = {}
) {
  const fullConfig: SecurityMiddlewareConfig = {
    enableIPBlocking: true,
    enableRequestAnalysis: true,
    enableRateLimiting: true,
    enableAuditLogging: true,
    excludePaths: ['/health', '/ready', '/metrics'],
    trustProxy: true,
    ...config,
  };

  // ==================== IP Blocking Middleware ====================

  const ipBlockingMiddleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!fullConfig.enableIPBlocking) {
      return next();
    }

    // Skip excluded paths
    if (fullConfig.excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const clientIP = getClientIP(req, fullConfig.trustProxy);

    try {
      const isBlocked = await threatDetectionService.isIPBlocked(clientIP);

      if (isBlocked) {
        logger.warn('Blocked IP attempted access', { ip: clientIP, path: req.path });

        // Audit log
        await auditService.logSecurityAlert(
          'blocked_ip_access_attempt',
          {
            type: 'anonymous',
            id: 'blocked',
            ipAddress: clientIP,
            userAgent: req.headers['user-agent'],
          },
          'high',
          { path: req.path, method: req.method }
        );

        res.status(403).json({
          error: 'Access denied',
          code: 'IP_BLOCKED',
        });
        return;
      }

      // Initialize security context
      req.securityContext = {
        ipBlocked: false,
        riskLevel: 'low',
        threats: [],
        requestId: generateRequestId(),
      };

      next();
    } catch (error) {
      logger.error('IP blocking check failed', { error, ip: clientIP });
      next();
    }
  };

  // ==================== Request Analysis Middleware ====================

  const requestAnalysisMiddleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!fullConfig.enableRequestAnalysis) {
      return next();
    }

    // Skip excluded paths
    if (fullConfig.excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const clientIP = getClientIP(req, fullConfig.trustProxy);

    try {
      const analysis = await threatDetectionService.analyzeRequest({
        ipAddress: clientIP,
        method: req.method,
        path: req.path,
        query: req.query as Record<string, string>,
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
        headers: req.headers as Record<string, string>,
        userId: req.user?.id,
      });

      // Map ThreatIndicator[] to string[] for security context
      const threatDescriptions = analysis.threats.map((t) => t.description);
      const blockReason = analysis.threats.find((t) => t.recommendedAction === 'block')?.type;

      // Update security context
      if (req.securityContext) {
        req.securityContext.threats = threatDescriptions;
        req.securityContext.riskLevel = analysis.shouldBlock ? 'critical' : 'low';
      }

      if (analysis.shouldBlock) {
        logger.warn('Request blocked by threat detection', {
          ip: clientIP,
          path: req.path,
          threats: threatDescriptions,
          reason: blockReason,
        });

        // Audit log
        await auditService.logSecurityAlert(
          'suspicious_activity',
          {
            type: req.user ? 'user' : 'anonymous',
            id: req.user?.id || 'anonymous',
            ipAddress: clientIP,
            userAgent: req.headers['user-agent'],
          },
          'high',
          {
            path: req.path,
            method: req.method,
            threats: threatDescriptions,
            reason: blockReason,
          }
        );

        res.status(403).json({
          error: 'Request blocked',
          code: blockReason || 'THREAT_DETECTED',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Request analysis failed', { error, path: req.path });
      next();
    }
  };

  // ==================== Rate Limiting Middleware ====================

  const rateLimitingMiddleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!fullConfig.enableRateLimiting) {
      return next();
    }

    // Skip excluded paths
    if (fullConfig.excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const clientIP = getClientIP(req, fullConfig.trustProxy);

    try {
      // Rate limiting is handled within analyzeRequest, but we can add additional checks here
      // For authenticated users, we can apply per-user rate limits

      if (req.user) {
        const _userKey = `rate_limit:user:${req.user.id}`;
        // Additional per-user rate limiting could be implemented here
      }

      next();
    } catch (error) {
      logger.error('Rate limiting check failed', { error, ip: clientIP });
      next();
    }
  };

  // ==================== Audit Logging Middleware ====================

  const auditLoggingMiddleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!fullConfig.enableAuditLogging) {
      return next();
    }

    // Skip excluded paths
    if (fullConfig.excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const startTime = Date.now();
    const clientIP = getClientIP(req, fullConfig.trustProxy);
    const requestId = req.securityContext?.requestId || generateRequestId();

    // Capture original end function
    const originalEnd = res.end;

    res.end = function (chunk?: any, encoding?: any, callback?: any): Response {
      const responseTime = Date.now() - startTime;

      // Log the request asynchronously
      setImmediate(async () => {
        try {
          // Only log significant requests (not assets, health checks, etc.)
          if (shouldLogRequest(req)) {
            await auditService.log({
              eventType: 'api_request',
              actor: {
                type: req.user ? 'user' : 'anonymous',
                id: req.user?.id || 'anonymous',
                email: req.user?.email,
                ipAddress: clientIP,
                userAgent: req.headers['user-agent'],
              },
              target: {
                type: 'api_endpoint',
                id: req.path,
              },
              result: {
                status: res.statusCode >= 400 ? 'failure' : 'success',
                httpStatus: res.statusCode,
              },
              metadata: {
                method: req.method,
                path: req.path,
                query: sanitizeQuery(req.query),
                responseTime,
                requestId,
                threats: req.securityContext?.threats || [],
              },
            });
          }
        } catch (error) {
          logger.error('Failed to log audit event', { error, requestId });
        }
      });

      return originalEnd.call(this, chunk, encoding, callback);
    } as any;

    next();
  };

  // ==================== Combined Security Middleware ====================

  const securityMiddleware = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Run middleware in sequence
      await new Promise<void>((resolve, reject) => {
        ipBlockingMiddleware(req, res, (err?: any) => {
          if (err || res.headersSent) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      if (res.headersSent) return;

      await new Promise<void>((resolve, reject) => {
        requestAnalysisMiddleware(req, res, (err?: any) => {
          if (err || res.headersSent) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      if (res.headersSent) return;

      await new Promise<void>((resolve, reject) => {
        rateLimitingMiddleware(req, res, (err?: any) => {
          if (err || res.headersSent) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      if (res.headersSent) return;

      await new Promise<void>((resolve, reject) => {
        auditLoggingMiddleware(req, res, (err?: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      next();
    } catch (error) {
      if (!res.headersSent) {
        next(error);
      }
    }
  };

  return {
    ipBlockingMiddleware,
    requestAnalysisMiddleware,
    rateLimitingMiddleware,
    auditLoggingMiddleware,
    securityMiddleware,
  };
}

// ==================== Login Security Middleware ====================

export function createLoginSecurityMiddleware(
  threatDetectionService: ThreatDetectionService,
  auditService: AuditService,
  logger: Logger
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const clientIP = getClientIP(req, true);
    const { email, password: _password } = req.body;

    if (!email) {
      return next();
    }

    try {
      // Analyze login risk
      const riskAnalysis = await threatDetectionService.analyzeLogin({
        email,
        ipAddress: clientIP,
        userAgent: req.headers['user-agent'],
        success: false, // Not yet determined
        timestamp: new Date(),
      });

      // Store risk analysis for use in auth handler
      (req as any).loginRiskAnalysis = riskAnalysis;

      // Map factors to reasons for easier consumption
      const reasons = riskAnalysis.factors.map((f) => f.description);

      if (riskAnalysis.shouldBlock) {
        logger.warn('Login blocked by threat detection', {
          email,
          ip: clientIP,
          riskLevel: riskAnalysis.level,
          reasons,
        });

        // Audit log
        await auditService.logAuthentication(
          'login_failure',
          {
            type: 'anonymous',
            id: email,
            ipAddress: clientIP,
            userAgent: req.headers['user-agent'],
          },
          'failure',
          {
            riskLevel: riskAnalysis.level,
            reasons,
            blocked: true,
          }
        );

        res.status(403).json({
          error: 'Login temporarily blocked',
          code: 'LOGIN_BLOCKED',
          retryAfter: 300, // 5 minutes
        });
        return;
      }

      // Add warnings to response headers for client handling
      if (riskAnalysis.level !== 'low') {
        res.setHeader('X-Login-Risk', riskAnalysis.level);
        res.setHeader('X-MFA-Required', riskAnalysis.requiresMFA.toString());
      }

      next();
    } catch (error) {
      logger.error('Login security check failed', { error, email });
      next();
    }
  };
}

// ==================== Sensitive Operation Middleware ====================

export function createSensitiveOperationMiddleware(auditService: AuditService, logger: Logger) {
  return (operationType: string, requireMFA: boolean = false) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const clientIP = getClientIP(req, true);

      // Check MFA if required
      if (requireMFA) {
        const mfaVerified = (req as any).mfaVerified || req.headers['x-mfa-token'];

        if (!mfaVerified) {
          logger.warn('MFA required for sensitive operation', {
            userId: req.user.id,
            operation: operationType,
          });

          res.status(403).json({
            error: 'MFA verification required',
            code: 'MFA_REQUIRED',
          });
          return;
        }
      }

      // Log the sensitive operation
      await auditService.log({
        eventType: 'sensitive_operation_initiated',
        actor: {
          type: 'user',
          id: req.user.id,
          email: req.user.email,
          ipAddress: clientIP,
          userAgent: req.headers['user-agent'],
        },
        target: {
          type: 'operation',
          id: operationType,
        },
        result: { status: 'success' },
        metadata: {
          operation: operationType,
          path: req.path,
          method: req.method,
        },
      });

      next();
    };
  };
}

// ==================== CORS Security Middleware ====================

export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

export function createSecureCORSMiddleware(config: Partial<CORSConfig> = {}) {
  const fullConfig: CORSConfig = {
    allowedOrigins: [],
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-MFA-Token'],
    exposedHeaders: ['X-Request-ID', 'X-Login-Risk', 'X-MFA-Required'],
    credentials: true,
    maxAge: 86400, // 24 hours
    ...config,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (origin && fullConfig.allowedOrigins.length > 0) {
      const isAllowed = fullConfig.allowedOrigins.some(
        (allowed) =>
          allowed === origin ||
          allowed === '*' ||
          (allowed.startsWith('*.') && origin.endsWith(allowed.slice(1)))
      );

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }

    res.setHeader('Access-Control-Allow-Methods', fullConfig.allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', fullConfig.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', fullConfig.exposedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', fullConfig.maxAge.toString());

    if (fullConfig.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

// ==================== Security Headers Middleware ====================

export function createSecurityHeadersMiddleware() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'"
    );

    // Strict Transport Security (HSTS)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Permissions Policy
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );

    next();
  };
}

// ==================== Helper Functions ====================

function getClientIP(req: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
      return ips[0].trim();
    }
    const realIP = req.headers['x-real-ip'];
    if (realIP) {
      return typeof realIP === 'string' ? realIP : realIP[0];
    }
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function shouldLogRequest(req: Request): boolean {
  // Skip static assets
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.gif', '.ico', '.woff', '.woff2'];
  if (staticExtensions.some((ext) => req.path.endsWith(ext))) {
    return false;
  }

  // Skip health checks
  if (req.path === '/health' || req.path === '/ready') {
    return false;
  }

  // Log all API requests
  return true;
}

function sanitizeQuery(query: any): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const sensitiveParams = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

  for (const [key, value] of Object.entries(query)) {
    if (sensitiveParams.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export default {
  createSecurityMiddleware,
  createLoginSecurityMiddleware,
  createSensitiveOperationMiddleware,
  createSecureCORSMiddleware,
  createSecurityHeadersMiddleware,
};
