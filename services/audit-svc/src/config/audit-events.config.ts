/**
 * @module @skillancer/audit-svc/config/audit-events
 * Comprehensive audit event types, categories, and compliance mappings
 */

import { AuditCategory, ComplianceTag, RetentionPolicy } from '../types/index.js';

// =============================================================================
// AUDIT EVENT TYPES BY CATEGORY
// =============================================================================

/**
 * Authentication events - Login, logout, MFA, session management
 */
export const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  LOGOUT: 'AUTH_LOGOUT',
  TOKEN_REFRESH: 'AUTH_TOKEN_REFRESH',
  TOKEN_REVOKED: 'AUTH_TOKEN_REVOKED',
  PASSWORD_CHANGED: 'AUTH_PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED: 'AUTH_PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'AUTH_PASSWORD_RESET_COMPLETED',
  MFA_ENABLED: 'AUTH_MFA_ENABLED',
  MFA_DISABLED: 'AUTH_MFA_DISABLED',
  MFA_CHALLENGE_SUCCESS: 'AUTH_MFA_CHALLENGE_SUCCESS',
  MFA_CHALLENGE_FAILED: 'AUTH_MFA_CHALLENGE_FAILED',
  SESSION_CREATED: 'AUTH_SESSION_CREATED',
  SESSION_INVALIDATED: 'AUTH_SESSION_INVALIDATED',
  ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  ACCOUNT_UNLOCKED: 'AUTH_ACCOUNT_UNLOCKED',
  SSO_LOGIN: 'AUTH_SSO_LOGIN',
  API_KEY_CREATED: 'AUTH_API_KEY_CREATED',
  API_KEY_REVOKED: 'AUTH_API_KEY_REVOKED',
} as const;

/**
 * Authorization events - Permission and role changes
 */
export const AUTHZ_EVENTS = {
  PERMISSION_GRANTED: 'AUTHZ_PERMISSION_GRANTED',
  PERMISSION_REVOKED: 'AUTHZ_PERMISSION_REVOKED',
  ROLE_ASSIGNED: 'AUTHZ_ROLE_ASSIGNED',
  ROLE_REMOVED: 'AUTHZ_ROLE_REMOVED',
  ACCESS_DENIED: 'AUTHZ_ACCESS_DENIED',
  PRIVILEGE_ESCALATION: 'AUTHZ_PRIVILEGE_ESCALATION',
  TEAM_MEMBER_ADDED: 'AUTHZ_TEAM_MEMBER_ADDED',
  TEAM_MEMBER_REMOVED: 'AUTHZ_TEAM_MEMBER_REMOVED',
  OWNERSHIP_TRANSFERRED: 'AUTHZ_OWNERSHIP_TRANSFERRED',
} as const;

/**
 * User management events - Profile and account lifecycle
 */
export const USER_EVENTS = {
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  PROFILE_UPDATED: 'USER_PROFILE_UPDATED',
  EMAIL_CHANGED: 'USER_EMAIL_CHANGED',
  EMAIL_VERIFIED: 'USER_EMAIL_VERIFIED',
  PHONE_CHANGED: 'USER_PHONE_CHANGED',
  PHONE_VERIFIED: 'USER_PHONE_VERIFIED',
  AVATAR_UPDATED: 'USER_AVATAR_UPDATED',
  PREFERENCES_UPDATED: 'USER_PREFERENCES_UPDATED',
  NOTIFICATION_SETTINGS_UPDATED: 'USER_NOTIFICATION_SETTINGS_UPDATED',
  KYC_SUBMITTED: 'USER_KYC_SUBMITTED',
  KYC_APPROVED: 'USER_KYC_APPROVED',
  KYC_REJECTED: 'USER_KYC_REJECTED',
  IDENTITY_VERIFIED: 'USER_IDENTITY_VERIFIED',
} as const;

/**
 * Data access events - Read operations on sensitive data
 */
export const DATA_ACCESS_EVENTS = {
  DATA_VIEWED: 'DATA_VIEWED',
  DATA_SEARCHED: 'DATA_SEARCHED',
  DATA_LISTED: 'DATA_LISTED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  DATA_DOWNLOADED: 'DATA_DOWNLOADED',
  REPORT_GENERATED: 'DATA_REPORT_GENERATED',
  BULK_READ: 'DATA_BULK_READ',
  SENSITIVE_DATA_ACCESSED: 'DATA_SENSITIVE_ACCESSED',
  PII_ACCESSED: 'DATA_PII_ACCESSED',
  FINANCIAL_DATA_ACCESSED: 'DATA_FINANCIAL_ACCESSED',
} as const;

/**
 * Data modification events - Create, update, delete operations
 */
export const DATA_MODIFICATION_EVENTS = {
  DATA_CREATED: 'DATA_CREATED',
  DATA_UPDATED: 'DATA_UPDATED',
  DATA_DELETED: 'DATA_DELETED',
  DATA_RESTORED: 'DATA_RESTORED',
  DATA_ARCHIVED: 'DATA_ARCHIVED',
  BULK_UPDATE: 'DATA_BULK_UPDATE',
  BULK_DELETE: 'DATA_BULK_DELETE',
  IMPORT_COMPLETED: 'DATA_IMPORT_COMPLETED',
} as const;

/**
 * Payment and billing events
 */
export const PAYMENT_EVENTS = {
  PAYMENT_INITIATED: 'PAYMENT_INITIATED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  PAYMENT_DISPUTED: 'PAYMENT_DISPUTED',
  PAYOUT_REQUESTED: 'PAYMENT_PAYOUT_REQUESTED',
  PAYOUT_COMPLETED: 'PAYMENT_PAYOUT_COMPLETED',
  PAYOUT_FAILED: 'PAYMENT_PAYOUT_FAILED',
  SUBSCRIPTION_CREATED: 'PAYMENT_SUBSCRIPTION_CREATED',
  SUBSCRIPTION_RENEWED: 'PAYMENT_SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_CANCELLED: 'PAYMENT_SUBSCRIPTION_CANCELLED',
  INVOICE_GENERATED: 'PAYMENT_INVOICE_GENERATED',
  INVOICE_PAID: 'PAYMENT_INVOICE_PAID',
  PAYMENT_METHOD_ADDED: 'PAYMENT_METHOD_ADDED',
  PAYMENT_METHOD_REMOVED: 'PAYMENT_METHOD_REMOVED',
  BANK_ACCOUNT_ADDED: 'PAYMENT_BANK_ACCOUNT_ADDED',
  BANK_ACCOUNT_VERIFIED: 'PAYMENT_BANK_ACCOUNT_VERIFIED',
  ESCROW_FUNDED: 'PAYMENT_ESCROW_FUNDED',
  ESCROW_RELEASED: 'PAYMENT_ESCROW_RELEASED',
  ESCROW_REFUNDED: 'PAYMENT_ESCROW_REFUNDED',
} as const;

/**
 * Contract and marketplace events
 */
export const CONTRACT_EVENTS = {
  CONTRACT_CREATED: 'CONTRACT_CREATED',
  CONTRACT_UPDATED: 'CONTRACT_UPDATED',
  CONTRACT_SUBMITTED: 'CONTRACT_SUBMITTED',
  CONTRACT_ACCEPTED: 'CONTRACT_ACCEPTED',
  CONTRACT_REJECTED: 'CONTRACT_REJECTED',
  CONTRACT_CANCELLED: 'CONTRACT_CANCELLED',
  CONTRACT_COMPLETED: 'CONTRACT_COMPLETED',
  CONTRACT_DISPUTED: 'CONTRACT_DISPUTED',
  MILESTONE_CREATED: 'CONTRACT_MILESTONE_CREATED',
  MILESTONE_UPDATED: 'CONTRACT_MILESTONE_UPDATED',
  MILESTONE_SUBMITTED: 'CONTRACT_MILESTONE_SUBMITTED',
  MILESTONE_APPROVED: 'CONTRACT_MILESTONE_APPROVED',
  MILESTONE_REJECTED: 'CONTRACT_MILESTONE_REJECTED',
  PROPOSAL_SUBMITTED: 'CONTRACT_PROPOSAL_SUBMITTED',
  PROPOSAL_WITHDRAWN: 'CONTRACT_PROPOSAL_WITHDRAWN',
  PROPOSAL_ACCEPTED: 'CONTRACT_PROPOSAL_ACCEPTED',
  PROPOSAL_REJECTED: 'CONTRACT_PROPOSAL_REJECTED',
  JOB_POSTED: 'CONTRACT_JOB_POSTED',
  JOB_UPDATED: 'CONTRACT_JOB_UPDATED',
  JOB_CLOSED: 'CONTRACT_JOB_CLOSED',
  JOB_REMOVED: 'CONTRACT_JOB_REMOVED',
} as const;

/**
 * SkillPod specific events
 */
export const SKILLPOD_EVENTS = {
  POD_CREATED: 'SKILLPOD_POD_CREATED',
  POD_UPDATED: 'SKILLPOD_POD_UPDATED',
  POD_PUBLISHED: 'SKILLPOD_POD_PUBLISHED',
  POD_UNPUBLISHED: 'SKILLPOD_POD_UNPUBLISHED',
  POD_ARCHIVED: 'SKILLPOD_POD_ARCHIVED',
  POD_MEMBER_ADDED: 'SKILLPOD_MEMBER_ADDED',
  POD_MEMBER_REMOVED: 'SKILLPOD_MEMBER_REMOVED',
  POD_MEMBER_ROLE_CHANGED: 'SKILLPOD_MEMBER_ROLE_CHANGED',
  POD_SETTINGS_UPDATED: 'SKILLPOD_SETTINGS_UPDATED',
  TASK_CREATED: 'SKILLPOD_TASK_CREATED',
  TASK_UPDATED: 'SKILLPOD_TASK_UPDATED',
  TASK_ASSIGNED: 'SKILLPOD_TASK_ASSIGNED',
  TASK_COMPLETED: 'SKILLPOD_TASK_COMPLETED',
  TIME_LOGGED: 'SKILLPOD_TIME_LOGGED',
  TIME_ADJUSTED: 'SKILLPOD_TIME_ADJUSTED',
  SPRINT_CREATED: 'SKILLPOD_SPRINT_CREATED',
  SPRINT_STARTED: 'SKILLPOD_SPRINT_STARTED',
  SPRINT_COMPLETED: 'SKILLPOD_SPRINT_COMPLETED',
} as const;

/**
 * Cockpit admin events
 */
export const COCKPIT_EVENTS = {
  ADMIN_LOGIN: 'COCKPIT_ADMIN_LOGIN',
  ADMIN_LOGOUT: 'COCKPIT_ADMIN_LOGOUT',
  USER_IMPERSONATION_STARTED: 'COCKPIT_IMPERSONATION_STARTED',
  USER_IMPERSONATION_ENDED: 'COCKPIT_IMPERSONATION_ENDED',
  SYSTEM_CONFIG_CHANGED: 'COCKPIT_SYSTEM_CONFIG_CHANGED',
  FEATURE_FLAG_TOGGLED: 'COCKPIT_FEATURE_FLAG_TOGGLED',
  USER_SUSPENDED_BY_ADMIN: 'COCKPIT_USER_SUSPENDED',
  USER_UNSUSPENDED_BY_ADMIN: 'COCKPIT_USER_UNSUSPENDED',
  DISPUTE_RESOLVED: 'COCKPIT_DISPUTE_RESOLVED',
  REFUND_ISSUED: 'COCKPIT_REFUND_ISSUED',
  PAYOUT_APPROVED: 'COCKPIT_PAYOUT_APPROVED',
  PAYOUT_REJECTED: 'COCKPIT_PAYOUT_REJECTED',
  REPORT_REVIEWED: 'COCKPIT_REPORT_REVIEWED',
  CONTENT_MODERATED: 'COCKPIT_CONTENT_MODERATED',
  AUDIT_LOG_EXPORTED: 'COCKPIT_AUDIT_EXPORTED',
  COMPLIANCE_REPORT_GENERATED: 'COCKPIT_COMPLIANCE_REPORT',
} as const;

/**
 * Security events
 */
export const SECURITY_EVENTS = {
  SUSPICIOUS_LOGIN_DETECTED: 'SECURITY_SUSPICIOUS_LOGIN',
  BRUTE_FORCE_DETECTED: 'SECURITY_BRUTE_FORCE',
  IP_BLOCKED: 'SECURITY_IP_BLOCKED',
  IP_UNBLOCKED: 'SECURITY_IP_UNBLOCKED',
  RATE_LIMIT_EXCEEDED: 'SECURITY_RATE_LIMIT',
  CSRF_DETECTED: 'SECURITY_CSRF_DETECTED',
  XSS_DETECTED: 'SECURITY_XSS_DETECTED',
  INJECTION_ATTEMPT: 'SECURITY_INJECTION_ATTEMPT',
  UNAUTHORIZED_ACCESS: 'SECURITY_UNAUTHORIZED_ACCESS',
  FRAUD_DETECTED: 'SECURITY_FRAUD_DETECTED',
  ACCOUNT_TAKEOVER_ATTEMPT: 'SECURITY_ACCOUNT_TAKEOVER',
  UNUSUAL_ACTIVITY: 'SECURITY_UNUSUAL_ACTIVITY',
  DATA_BREACH_DETECTED: 'SECURITY_DATA_BREACH',
  SECURITY_SCAN_COMPLETED: 'SECURITY_SCAN_COMPLETED',
} as const;

/**
 * Communication events
 */
export const COMMUNICATION_EVENTS = {
  MESSAGE_SENT: 'COMM_MESSAGE_SENT',
  MESSAGE_READ: 'COMM_MESSAGE_READ',
  ATTACHMENT_UPLOADED: 'COMM_ATTACHMENT_UPLOADED',
  ATTACHMENT_DOWNLOADED: 'COMM_ATTACHMENT_DOWNLOADED',
  NOTIFICATION_SENT: 'COMM_NOTIFICATION_SENT',
  EMAIL_SENT: 'COMM_EMAIL_SENT',
  SMS_SENT: 'COMM_SMS_SENT',
  WEBHOOK_DELIVERED: 'COMM_WEBHOOK_DELIVERED',
} as const;

/**
 * Compliance events
 */
export const COMPLIANCE_EVENTS = {
  GDPR_DATA_REQUEST: 'COMPLIANCE_GDPR_DATA_REQUEST',
  GDPR_DATA_EXPORTED: 'COMPLIANCE_GDPR_DATA_EXPORTED',
  GDPR_DATA_DELETED: 'COMPLIANCE_GDPR_DATA_DELETED',
  CONSENT_GRANTED: 'COMPLIANCE_CONSENT_GRANTED',
  CONSENT_REVOKED: 'COMPLIANCE_CONSENT_REVOKED',
  PRIVACY_POLICY_ACCEPTED: 'COMPLIANCE_PRIVACY_ACCEPTED',
  TERMS_ACCEPTED: 'COMPLIANCE_TERMS_ACCEPTED',
  AGE_VERIFICATION_COMPLETED: 'COMPLIANCE_AGE_VERIFIED',
  AUDIT_TRAIL_VERIFIED: 'COMPLIANCE_AUDIT_VERIFIED',
} as const;

/**
 * System events
 */
export const SYSTEM_EVENTS = {
  SERVICE_STARTED: 'SYSTEM_SERVICE_STARTED',
  SERVICE_STOPPED: 'SYSTEM_SERVICE_STOPPED',
  SERVICE_HEALTH_CHECK: 'SYSTEM_HEALTH_CHECK',
  DATABASE_MIGRATION: 'SYSTEM_DB_MIGRATION',
  CACHE_CLEARED: 'SYSTEM_CACHE_CLEARED',
  SCHEDULED_JOB_EXECUTED: 'SYSTEM_SCHEDULED_JOB',
  BACKUP_COMPLETED: 'SYSTEM_BACKUP_COMPLETED',
  RESTORE_COMPLETED: 'SYSTEM_RESTORE_COMPLETED',
  ERROR_THRESHOLD_EXCEEDED: 'SYSTEM_ERROR_THRESHOLD',
  MAINTENANCE_MODE_ENABLED: 'SYSTEM_MAINTENANCE_ENABLED',
  MAINTENANCE_MODE_DISABLED: 'SYSTEM_MAINTENANCE_DISABLED',
} as const;

/**
 * Review and rating events
 */
export const REVIEW_EVENTS = {
  REVIEW_SUBMITTED: 'REVIEW_SUBMITTED',
  REVIEW_UPDATED: 'REVIEW_UPDATED',
  REVIEW_DELETED: 'REVIEW_DELETED',
  REVIEW_FLAGGED: 'REVIEW_FLAGGED',
  REVIEW_HIDDEN: 'REVIEW_HIDDEN',
  REVIEW_RESTORED: 'REVIEW_RESTORED',
  RESPONSE_SUBMITTED: 'REVIEW_RESPONSE_SUBMITTED',
  FRAUD_REVIEW_DETECTED: 'REVIEW_FRAUD_DETECTED',
} as const;

// =============================================================================
// COMBINED EVENT TYPES
// =============================================================================

export const AUDIT_EVENT_TYPES = {
  ...AUTH_EVENTS,
  ...AUTHZ_EVENTS,
  ...USER_EVENTS,
  ...DATA_ACCESS_EVENTS,
  ...DATA_MODIFICATION_EVENTS,
  ...PAYMENT_EVENTS,
  ...CONTRACT_EVENTS,
  ...SKILLPOD_EVENTS,
  ...COCKPIT_EVENTS,
  ...SECURITY_EVENTS,
  ...COMMUNICATION_EVENTS,
  ...COMPLIANCE_EVENTS,
  ...SYSTEM_EVENTS,
  ...REVIEW_EVENTS,
} as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES];

// =============================================================================
// COMPLIANCE MAPPINGS
// =============================================================================

export interface ComplianceConfig {
  regulations: ComplianceTag[];
  retentionDays: number;
  retentionPolicy: RetentionPolicy;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  piiLevel: 'none' | 'low' | 'medium' | 'high';
  requiresEncryption: boolean;
  requiresImmediateAlert: boolean;
}

type EventComplianceMapping = {
  [K in AuditEventType]?: ComplianceConfig;
};

/**
 * Compliance mapping for each event type
 * Defines retention, regulations, and data classification
 */
export const EVENT_COMPLIANCE_MAPPING: EventComplianceMapping = {
  // Authentication - High security, SOC2 required
  [AUTH_EVENTS.LOGIN_SUCCESS]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 365,
    retentionPolicy: RetentionPolicy.STANDARD,
    dataClassification: 'internal',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: false,
  },
  [AUTH_EVENTS.LOGIN_FAILED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 365,
    retentionPolicy: RetentionPolicy.STANDARD,
    dataClassification: 'internal',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: true,
  },
  [AUTH_EVENTS.PASSWORD_CHANGED]: {
    regulations: [ComplianceTag.SOC2, ComplianceTag.GDPR],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [AUTH_EVENTS.MFA_ENABLED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'internal',
    piiLevel: 'none',
    requiresEncryption: false,
    requiresImmediateAlert: false,
  },
  [AUTH_EVENTS.MFA_DISABLED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'internal',
    piiLevel: 'none',
    requiresEncryption: false,
    requiresImmediateAlert: true,
  },
  [AUTH_EVENTS.ACCOUNT_LOCKED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 365,
    retentionPolicy: RetentionPolicy.STANDARD,
    dataClassification: 'internal',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: true,
  },

  // User management - GDPR + PII
  [USER_EVENTS.USER_CREATED]: {
    regulations: [ComplianceTag.SOC2, ComplianceTag.GDPR, ComplianceTag.PII],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'high',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [USER_EVENTS.USER_DELETED]: {
    regulations: [ComplianceTag.SOC2, ComplianceTag.GDPR],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'confidential',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [USER_EVENTS.EMAIL_CHANGED]: {
    regulations: [ComplianceTag.GDPR, ComplianceTag.PII],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'high',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [USER_EVENTS.KYC_APPROVED]: {
    regulations: [ComplianceTag.SOC2, ComplianceTag.PII],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'restricted',
    piiLevel: 'high',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },

  // Payment - PCI + SOC2
  [PAYMENT_EVENTS.PAYMENT_COMPLETED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [PAYMENT_EVENTS.PAYMENT_FAILED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: true,
  },
  [PAYMENT_EVENTS.PAYMENT_REFUNDED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'low',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [PAYMENT_EVENTS.PAYOUT_COMPLETED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [PAYMENT_EVENTS.BANK_ACCOUNT_ADDED]: {
    regulations: [ComplianceTag.SOC2, ComplianceTag.PII],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'restricted',
    piiLevel: 'high',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },

  // Security - Immediate alerts
  [SECURITY_EVENTS.SUSPICIOUS_LOGIN_DETECTED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: true,
  },
  [SECURITY_EVENTS.BRUTE_FORCE_DETECTED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: true,
  },
  [SECURITY_EVENTS.FRAUD_DETECTED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'restricted',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: true,
  },
  [SECURITY_EVENTS.DATA_BREACH_DETECTED]: {
    regulations: [ComplianceTag.SOC2, ComplianceTag.GDPR],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'restricted',
    piiLevel: 'high',
    requiresEncryption: true,
    requiresImmediateAlert: true,
  },
  [SECURITY_EVENTS.ACCOUNT_TAKEOVER_ATTEMPT]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'medium',
    requiresEncryption: false,
    requiresImmediateAlert: true,
  },

  // Cockpit admin - High audit
  [COCKPIT_EVENTS.USER_IMPERSONATION_STARTED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'restricted',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: true,
  },
  [COCKPIT_EVENTS.SYSTEM_CONFIG_CHANGED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'restricted',
    piiLevel: 'none',
    requiresEncryption: false,
    requiresImmediateAlert: false,
  },
  [COCKPIT_EVENTS.DISPUTE_RESOLVED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: false,
  },

  // Compliance - Permanent retention
  [COMPLIANCE_EVENTS.GDPR_DATA_REQUEST]: {
    regulations: [ComplianceTag.GDPR],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'restricted',
    piiLevel: 'high',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [COMPLIANCE_EVENTS.GDPR_DATA_DELETED]: {
    regulations: [ComplianceTag.GDPR],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'restricted',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [COMPLIANCE_EVENTS.CONSENT_GRANTED]: {
    regulations: [ComplianceTag.GDPR],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'confidential',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: false,
  },
  [COMPLIANCE_EVENTS.CONSENT_REVOKED]: {
    regulations: [ComplianceTag.GDPR],
    retentionDays: -1,
    retentionPolicy: RetentionPolicy.PERMANENT,
    dataClassification: 'confidential',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: false,
  },

  // Data access - Varies by sensitivity
  [DATA_ACCESS_EVENTS.SENSITIVE_DATA_ACCESSED]: {
    regulations: [ComplianceTag.SOC2, ComplianceTag.GDPR],
    retentionDays: 365,
    retentionPolicy: RetentionPolicy.STANDARD,
    dataClassification: 'confidential',
    piiLevel: 'high',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [DATA_ACCESS_EVENTS.PII_ACCESSED]: {
    regulations: [ComplianceTag.GDPR, ComplianceTag.PII],
    retentionDays: 365,
    retentionPolicy: RetentionPolicy.STANDARD,
    dataClassification: 'confidential',
    piiLevel: 'high',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },
  [DATA_ACCESS_EVENTS.DATA_EXPORTED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'medium',
    requiresEncryption: true,
    requiresImmediateAlert: false,
  },

  // Contracts - Standard business retention
  [CONTRACT_EVENTS.CONTRACT_CREATED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'internal',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: false,
  },
  [CONTRACT_EVENTS.CONTRACT_COMPLETED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'internal',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: false,
  },
  [CONTRACT_EVENTS.CONTRACT_DISPUTED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: true,
  },

  // Reviews - Fraud detection
  [REVIEW_EVENTS.FRAUD_REVIEW_DETECTED]: {
    regulations: [ComplianceTag.SOC2],
    retentionDays: 2555,
    retentionPolicy: RetentionPolicy.EXTENDED,
    dataClassification: 'confidential',
    piiLevel: 'low',
    requiresEncryption: false,
    requiresImmediateAlert: true,
  },
};

// =============================================================================
// SENSITIVE FIELDS FOR REDACTION
// =============================================================================

export const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'apiSecret',
  'creditCard',
  'cardNumber',
  'cvv',
  'cvc',
  'expirationDate',
  'ssn',
  'socialSecurity',
  'taxId',
  'bankAccount',
  'routingNumber',
  'accountNumber',
  'iban',
  'swift',
  'pin',
  'otp',
  'mfaCode',
  'securityAnswer',
  'privateKey',
  'encryptionKey',
] as const;

export type SensitiveField = (typeof SENSITIVE_FIELDS)[number];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get compliance config for an event type
 */
export function getComplianceConfig(eventType: AuditEventType): ComplianceConfig {
  const config = EVENT_COMPLIANCE_MAPPING[eventType];

  // Default config for unmapped events
  if (!config) {
    return {
      regulations: [ComplianceTag.SOC2],
      retentionDays: 365,
      retentionPolicy: RetentionPolicy.STANDARD,
      dataClassification: 'internal',
      piiLevel: 'none',
      requiresEncryption: false,
      requiresImmediateAlert: false,
    };
  }

  return config;
}

/**
 * Get category for an event type based on prefix
 */
export function getCategoryForEvent(eventType: string): AuditCategory {
  if (eventType.startsWith('AUTH_')) return AuditCategory.AUTHENTICATION;
  if (eventType.startsWith('AUTHZ_')) return AuditCategory.AUTHORIZATION;
  if (eventType.startsWith('USER_')) return AuditCategory.USER_MANAGEMENT;
  if (eventType.startsWith('DATA_')) {
    if (
      eventType.includes('VIEWED') ||
      eventType.includes('SEARCHED') ||
      eventType.includes('LISTED') ||
      eventType.includes('EXPORTED') ||
      eventType.includes('DOWNLOADED') ||
      eventType.includes('ACCESSED')
    ) {
      return AuditCategory.DATA_ACCESS;
    }
    return AuditCategory.DATA_MODIFICATION;
  }
  if (eventType.startsWith('PAYMENT_')) return AuditCategory.PAYMENT;
  if (eventType.startsWith('CONTRACT_')) return AuditCategory.CONTRACT;
  if (eventType.startsWith('SKILLPOD_')) return AuditCategory.SKILLPOD;
  if (eventType.startsWith('COCKPIT_')) return AuditCategory.COMPLIANCE;
  if (eventType.startsWith('SECURITY_')) return AuditCategory.SECURITY;
  if (eventType.startsWith('COMM_')) return AuditCategory.COMMUNICATION;
  if (eventType.startsWith('COMPLIANCE_')) return AuditCategory.COMPLIANCE;
  if (eventType.startsWith('SYSTEM_')) return AuditCategory.SYSTEM;
  if (eventType.startsWith('REVIEW_')) return AuditCategory.DATA_MODIFICATION;

  return AuditCategory.SYSTEM;
}

/**
 * Check if an event requires immediate alerting
 */
export function requiresImmediateAlert(eventType: AuditEventType): boolean {
  const config = EVENT_COMPLIANCE_MAPPING[eventType];
  return config?.requiresImmediateAlert ?? false;
}

/**
 * Get retention policy for an event type
 */
export function getRetentionPolicy(eventType: AuditEventType): RetentionPolicy {
  const config = EVENT_COMPLIANCE_MAPPING[eventType];
  return config?.retentionPolicy ?? RetentionPolicy.STANDARD;
}

/**
 * Get compliance tags for an event type
 */
export function getComplianceTags(eventType: AuditEventType): ComplianceTag[] {
  const config = EVENT_COMPLIANCE_MAPPING[eventType];
  return config?.regulations ?? [ComplianceTag.SOC2];
}
