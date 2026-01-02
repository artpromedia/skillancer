/**
 * Security Package - Main Export
 *
 * Comprehensive security and compliance framework for Skillancer platform.
 * Provides audit logging, data protection, threat detection, and compliance reporting.
 */

// ==================== Audit Module ====================
export {
  AuditService,
  SecurityEventSchema,
  SecurityEvent,
  SecurityEventType,
  SecurityEventCategory,
  AuditActor,
  AuditTarget,
  AuditResult,
  DataClassification,
  PIICategory,
  ConsentType,
  consentRequirements,
  DataSubjectRequest,
  RetentionPolicy,
  severityLevels,
  highRiskEventTypes,
  complianceRegulations,
} from './audit';

// ==================== Data Protection Module ====================
export {
  DataProtectionService,
  EncryptedData,
  AnonymizationMethod,
  ConsentRecord,
  DSRProcessingResult,
  RetentionPolicyResult,
  DataClassificationResult,
} from './data-protection';

// ==================== Threat Detection Module ====================
export {
  ThreatDetectionService,
  LoginAttempt,
  LoginRiskAnalysis,
  LoginRiskLevel,
  RequestAnalysis,
  ThreatType,
  BlockedIP,
  KnownDevice,
} from './threat-detection';

// ==================== Compliance Module ====================
export {
  ComplianceReportingService,
  ComplianceReport,
  ComplianceReportType,
  ComplianceReportSummary,
  ComplianceReportSection,
  ComplianceFinding,
  ComplianceEvidence,
  GDPRComplianceStatus,
} from './compliance';

// ==================== Routes Module ====================
export { createSecurityRouter, SecurityRouterDependencies } from './routes';

// ==================== Middleware Module ====================
export {
  createSecurityMiddleware,
  createLoginSecurityMiddleware,
  createSensitiveOperationMiddleware,
  createSecureCORSMiddleware,
  createSecurityHeadersMiddleware,
  SecurityMiddlewareConfig,
  AuthenticatedRequest,
  CORSConfig,
} from './middleware';

// ==================== Brute Force Protection Module ====================
export {
  BruteForceProtection,
  initializeBruteForceProtection,
  getBruteForceProtection,
  resetBruteForceProtection,
  type BruteForceConfig,
  type LoginAttemptResult,
  type LockoutInfo,
  type NotificationCallback,
} from './brute-force';

// ==================== Factory Function ====================

import { AuditService } from './audit';
import { BruteForceProtection, type BruteForceConfig } from './brute-force';
import { ComplianceReportingService } from './compliance';
import { DataProtectionService } from './data-protection';
import { ThreatDetectionService } from './threat-detection';

import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';

export interface SecurityServicesConfig {
  prisma: PrismaClient;
  redis: Redis;
  logger: {
    info(message: string, meta?: Record<string, any>): void;
    warn(message: string, meta?: Record<string, any>): void;
    error(message: string, meta?: Record<string, any>): void;
  };
  encryptionKey?: string;
  siemEndpoint?: string;
  geoipEnabled?: boolean;
  bruteForceConfig?: Partial<BruteForceConfig>;
}

export interface SecurityServices {
  auditService: AuditService;
  dataProtectionService: DataProtectionService;
  threatDetectionService: ThreatDetectionService;
  complianceReportingService: ComplianceReportingService;
  bruteForceProtection: BruteForceProtection;
}

/**
 * Create all security services with shared dependencies
 */
export function createSecurityServices(config: SecurityServicesConfig): SecurityServices {
  const { prisma, redis, logger, encryptionKey, geoipEnabled, bruteForceConfig } = config;

  // Create services
  const auditService = new AuditService(prisma, redis, logger);

  const dataProtectionService = new DataProtectionService(prisma, redis, logger, encryptionKey);

  const threatDetectionService = new ThreatDetectionService(prisma, redis, logger, geoipEnabled);

  const complianceReportingService = new ComplianceReportingService(
    prisma,
    redis,
    auditService,
    dataProtectionService,
    logger
  );

  const bruteForceProtection = new BruteForceProtection(redis, bruteForceConfig);

  return {
    auditService,
    dataProtectionService,
    threatDetectionService,
    complianceReportingService,
    bruteForceProtection,
  };
}

export default {
  createSecurityServices,
};
