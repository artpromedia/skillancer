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
  SecurityEventActor,
  SecurityEventTarget,
  SecurityEventResult,
  DataClassification,
  PIICategory,
  ConsentType,
  ConsentRecord,
  consentRequirements,
  DataSubjectRequest,
  RetentionPolicy,
  severityLevels,
  highRiskEventTypes,
  complianceRegulations,
} from './audit';

// ==================== Data Protection Module ====================
export { DataProtectionService, EncryptedData, AnonymizationConfig } from './data-protection';

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
  // @ts-nocheck - TODO: Factory function parameters need alignment with service constructors
  type NotificationCallback,
} from './brute-force';

// ==================== Factory Function ====================

import { AuditService } from './audit';
import { BruteForceProtection, type BruteForceConfig } from './brute-force';
import { ComplianceReportingService } from './compliance';
import { DataProtectionService } from './data-protection';
import { ThreatDetectionService } from './threat-detection';

import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export interface SecurityServicesConfig {
  prisma: PrismaClient;
  redis: Redis;
  auditQueue?: Queue;
  dataQueue?: Queue;
  alertQueue?: Queue;
  logger: {
    info(message: string, meta?: Record<string, any>): void;
    warn(message: string, meta?: Record<string, any>): void;
    error(message: string, meta?: Record<string, any>): void;
  };
  encryptionKey?: string;
  siemEndpoint?: string;
  geoipEnabled?: boolean;
  bruteForceConfig?: Partial<BruteForceConfig>;
  serviceName?: string;
  environment?: string;
  version?: string;
}

export interface SecurityServices {
  auditService: AuditService;
  dataProtectionService: DataProtectionService;
  threatDetectionService: ThreatDetectionService;
  complianceReportingService: ComplianceReportingService;
  bruteForceProtection: BruteForceProtection;
}

// Stub queue for when no real queue is provided
const stubQueue = {
  add: async () => ({ id: 'stub' }),
  on: () => {},
} as unknown as Queue;

/**
 * Create all security services with shared dependencies
 */
export function createSecurityServices(config: SecurityServicesConfig): SecurityServices {
  const {
    prisma,
    redis,
    auditQueue = stubQueue,
    dataQueue = stubQueue,
    alertQueue = stubQueue,
    logger,
    encryptionKey,
    bruteForceConfig,
    serviceName = 'skillancer',
    environment = 'development',
    version = '1.0.0',
  } = config;

  // Create services
  const auditService = new AuditService(prisma, redis, auditQueue, logger, {
    serviceName,
    environment,
    version,
  });

  const dataProtectionService = new DataProtectionService(
    prisma,
    redis,
    dataQueue,
    auditService,
    logger
  );

  const threatDetectionService = new ThreatDetectionService(
    redis,
    alertQueue,
    auditService,
    logger
  );

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

// ==================== Vulnerability Management ====================
export {
  VulnerabilityScanner,
  vulnerabilityScanner,
  Vulnerability,
  VulnerabilitySeverity,
  VulnerabilityStatus,
  VulnerabilitySource,
  ScanResult,
  ScanType,
  DependencyVulnerability,
} from './vulnerability-scanner';

export default {
  createSecurityServices,
};
